import { describe, expect, it } from 'vitest'
import type { ChatMessage, LongTermMemory } from '../../src/shared'
import { ARCMIND_PERSONA_PROMPT, buildChatContext, buildSystemPrompt } from '../../src/main/ai/context'

describe('ArcMind chat context', () => {
  it('always includes the ArcMind persona prompt', () => {
    expect(buildSystemPrompt([])).toBe(ARCMIND_PERSONA_PROMPT)
    expect(buildSystemPrompt([])).toContain('克制、可靠、注重隐私')
    expect(buildSystemPrompt([])).toContain(':::report')
    expect(buildSystemPrompt([])).toContain(':::choices')
  })

  it('injects only enabled long-term memories', () => {
    const prompt = buildSystemPrompt([memory('m1', '用户喜欢简短回答。', true), memory('m2', '已禁用的内容。', false)])

    expect(prompt).toContain('用户喜欢简短回答。')
    expect(prompt).not.toContain('已禁用的内容。')
  })

  it('keeps memory injection separate from the conversation window', () => {
    const context = buildChatContext({
      maxContextMessages: 1,
      memories: [memory('m1', '用户希望 ArcMind 保持克制。', true)],
      messages: [message('1', 'assistant', 'ready'), message('2', 'user', 'continue')]
    })

    expect(context).toHaveLength(2)
    expect(context[0]).toMatchObject({ role: 'system' })
    expect(context[0].content).toContain('用户希望 ArcMind 保持克制。')
    expect(context[1]).toEqual({ role: 'user', content: 'continue' })
  })
})

function memory(id: string, content: string, enabled: boolean): LongTermMemory {
  return {
    id,
    content,
    enabled,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  }
}

function message(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id,
    role,
    content,
    createdAt: new Date(0).toISOString()
  }
}
