import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../src/shared'
import { ConversationRepository } from '../../src/main/storage/conversationRepository'

let tempDir: string | null = null

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe('ConversationRepository', () => {
  it('creates, lists, renames, clears and deletes conversations', async () => {
    const repository = await createRepository()
    const conversation = await repository.createConversation('First chat')

    await repository.saveConversationMessages(conversation.id, [message('m1', 'user', 'hello')])
    await repository.renameConversation(conversation.id, 'Renamed')

    const summaries = await repository.listConversations()
    expect(summaries[0]).toMatchObject({ title: 'Renamed', messageCount: 1 })

    const cleared = await repository.clearConversation(conversation.id)
    expect(cleared?.messages).toEqual([])

    await repository.deleteConversation(conversation.id)
    expect(await repository.listConversations()).toEqual([])
    await repository.close()
  })

  it('persists conversations across repository instances', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-history-'))
    const first = new ConversationRepository(tempDir)
    await first.initialize()
    const conversation = await first.createConversation('Persisted')
    await first.saveConversationMessages(conversation.id, [message('m1', 'user', 'hello'), message('m2', 'assistant', 'hi')])
    await first.close()

    const second = new ConversationRepository(tempDir)
    await second.initialize()
    const restored = await second.getMostRecentConversation()

    expect(restored.title).toBe('Persisted')
    expect(restored.messages.map((item) => item.content)).toEqual(['hello', 'hi'])
    await second.close()
  })

  it('serializes overlapping persistence writes so the latest state wins', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-history-'))
    const first = new ConversationRepository(tempDir)
    await first.initialize()
    const conversation = await first.createConversation('Concurrent')

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        first.saveConversationMessages(conversation.id, [
          message(`m${index}`, 'user', `message ${index}`),
          message(`a${index}`, 'assistant', `reply ${index}`)
        ])
      )
    )
    await first.close()

    const second = new ConversationRepository(tempDir)
    await second.initialize()
    const restored = await second.getConversation(conversation.id)

    expect(restored?.messages.map((item) => item.content)).toEqual(['message 7', 'reply 7'])
    await second.close()
  })

  it('creates, edits, disables, deletes and persists long-term memories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'arcmind-history-'))
    const first = new ConversationRepository(tempDir)
    await first.initialize()

    const created = await first.createMemory('Prefers concise answers.')
    expect(created).toMatchObject({ content: 'Prefers concise answers.', enabled: true })

    const updated = await first.updateMemory(created.id, 'Prefers concise and calm answers.')
    expect(updated?.content).toBe('Prefers concise and calm answers.')

    await first.setMemoryEnabled(created.id, false)
    expect(await first.listEnabledMemories()).toEqual([])
    await first.close()

    const second = new ConversationRepository(tempDir)
    await second.initialize()
    const restored = await second.listMemories()
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ content: 'Prefers concise and calm answers.', enabled: false })

    await second.deleteMemory(created.id)
    expect(await second.listMemories()).toEqual([])
    await second.close()
  })
})

async function createRepository(): Promise<ConversationRepository> {
  tempDir = await mkdtemp(join(tmpdir(), 'arcmind-history-'))
  const repository = new ConversationRepository(tempDir)
  await repository.initialize()
  return repository
}

function message(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id,
    role,
    content,
    createdAt: new Date(Number(id.replace(/\D/g, '')) || 0).toISOString()
  }
}
