import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Database, SqlJsStatic } from 'sql.js'
import initSqlJs from 'sql.js/dist/sql-asm.js'
import type { ChatMessage, ConversationState, ConversationSummary, LongTermMemory } from '../../shared'

const SCHEMA_VERSION = 2

interface ConversationRow {
  id: string
  title: string
  status: ConversationState['status']
  active_request_id: string | null
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  conversation_id: string
  role: ChatMessage['role']
  content: string
  created_at: string
}

interface MemoryRow {
  id: string
  content: string
  enabled: number
  created_at: string
  updated_at: string
}

export class ConversationRepository {
  private readonly filePath: string
  private sqlite: SqlJsStatic | null = null
  private db: Database | null = null
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(userDataPath: string, fileName = 'arc-history.sqlite') {
    this.filePath = join(userDataPath, fileName)
  }

  async initialize(): Promise<void> {
    this.sqlite = await initSqlJs()
    await mkdir(dirname(this.filePath), { recursive: true })

    try {
      const bytes = await readFile(this.filePath)
      this.db = new this.sqlite.Database(bytes)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        throw error
      }
      this.db = new this.sqlite.Database()
    }

    this.migrate()
    await this.persist()
  }

  async createConversation(title = '新的会话'): Promise<ConversationState> {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    this.database.run(
      `INSERT INTO conversations (id, title, status, active_request_id, created_at, updated_at)
       VALUES (?, ?, 'idle', NULL, ?, ?)`,
      [id, title.trim() || '新的会话', now, now]
    )
    await this.persist()
    return this.getConversation(id) as Promise<ConversationState>
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const rows = this.database.exec(
      `SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id) AS message_count
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id
       GROUP BY c.id
       ORDER BY c.updated_at DESC`
    )

    if (rows.length === 0) {
      return []
    }

    return rows[0].values.map((value: unknown[]) => ({
      id: String(value[0]),
      title: String(value[1]),
      createdAt: String(value[2]),
      updatedAt: String(value[3]),
      messageCount: Number(value[4])
    }))
  }

  async getConversation(id: string): Promise<ConversationState | null> {
    const conversation = this.getConversationRow(id)
    if (!conversation) {
      return null
    }

    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      activeRequestId: conversation.active_request_id,
      updatedAt: conversation.updated_at,
      messages: this.getMessages(id)
    }
  }

  async getMostRecentConversation(): Promise<ConversationState> {
    const summaries = await this.listConversations()
    const existing = summaries[0] ? await this.getConversation(summaries[0].id) : null
    return existing ?? this.createConversation('新的会话')
  }

  async renameConversation(id: string, title: string): Promise<ConversationState | null> {
    const now = new Date().toISOString()
    this.database.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title.trim() || '未命名会话', now, id])
    await this.persist()
    return this.getConversation(id)
  }

  async deleteConversation(id: string): Promise<void> {
    this.database.run('DELETE FROM conversations WHERE id = ?', [id])
    await this.persist()
  }

  async clearConversation(id: string): Promise<ConversationState | null> {
    const now = new Date().toISOString()
    this.database.run('DELETE FROM messages WHERE conversation_id = ?', [id])
    this.database.run("UPDATE conversations SET status = 'idle', active_request_id = NULL, updated_at = ? WHERE id = ?", [now, id])
    await this.persist()
    return this.getConversation(id)
  }

  async saveConversationMessages(conversationId: string, messages: ChatMessage[]): Promise<ConversationState | null> {
    const now = new Date().toISOString()
    this.database.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId])
    const insert = this.database.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )

    try {
      for (const message of messages) {
        insert.run([message.id, conversationId, message.role, message.content, message.createdAt])
      }
    } finally {
      insert.free()
    }

    this.database.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId])
    await this.persist()
    return this.getConversation(conversationId)
  }

  async appendMessage(conversationId: string, message: ChatMessage): Promise<void> {
    const now = new Date().toISOString()
    this.database.run(
      `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [message.id, conversationId, message.role, message.content, message.createdAt]
    )
    this.database.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId])
    await this.persist()
  }

  async listMemories(): Promise<LongTermMemory[]> {
    const rows = this.database.exec(
      `SELECT id, content, enabled, created_at, updated_at
       FROM memories
       ORDER BY updated_at DESC`
    )

    if (rows.length === 0) {
      return []
    }

    return rows[0].values.map((value: unknown[]) =>
      memoryFromRow({
        id: String(value[0]),
        content: String(value[1]),
        enabled: Number(value[2]),
        created_at: String(value[3]),
        updated_at: String(value[4])
      })
    )
  }

  async listEnabledMemories(): Promise<LongTermMemory[]> {
    const rows = this.database.exec(
      `SELECT id, content, enabled, created_at, updated_at
       FROM memories
       WHERE enabled = 1
       ORDER BY updated_at DESC`
    )

    if (rows.length === 0) {
      return []
    }

    return rows[0].values.map((value: unknown[]) =>
      memoryFromRow({
        id: String(value[0]),
        content: String(value[1]),
        enabled: Number(value[2]),
        created_at: String(value[3]),
        updated_at: String(value[4])
      })
    )
  }

  async createMemory(content: string): Promise<LongTermMemory> {
    const trimmed = normalizeMemoryContent(content)
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    this.database.run(
      `INSERT INTO memories (id, content, enabled, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)`,
      [id, trimmed, now, now]
    )
    await this.persist()
    return (await this.getMemory(id)) as LongTermMemory
  }

  async updateMemory(id: string, content: string): Promise<LongTermMemory | null> {
    const trimmed = normalizeMemoryContent(content)
    const now = new Date().toISOString()
    this.database.run('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?', [trimmed, now, id])
    await this.persist()
    return this.getMemory(id)
  }

  async setMemoryEnabled(id: string, enabled: boolean): Promise<LongTermMemory | null> {
    const now = new Date().toISOString()
    this.database.run('UPDATE memories SET enabled = ?, updated_at = ? WHERE id = ?', [enabled ? 1 : 0, now, id])
    await this.persist()
    return this.getMemory(id)
  }

  async deleteMemory(id: string): Promise<void> {
    this.database.run('DELETE FROM memories WHERE id = ?', [id])
    await this.persist()
  }

  async close(): Promise<void> {
    await this.persist()
    this.db?.close()
    this.db = null
  }

  private migrate(): void {
    this.database.run('PRAGMA foreign_keys = ON')
    this.database.run(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    this.database.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        active_request_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    this.database.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `)
    this.database.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    this.database.run('CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)')
    this.database.run('CREATE INDEX IF NOT EXISTS idx_memories_enabled_updated ON memories(enabled, updated_at)')
    this.database.run('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', ['schema_version', String(SCHEMA_VERSION)])
  }

  private getConversationRow(id: string): ConversationRow | null {
    const statement = this.database.prepare('SELECT id, title, status, active_request_id, created_at, updated_at FROM conversations WHERE id = ?')
    try {
      statement.bind([id])
      if (!statement.step()) {
        return null
      }
      return statement.getAsObject() as unknown as ConversationRow
    } finally {
      statement.free()
    }
  }

  private getMessages(conversationId: string): ChatMessage[] {
    const rows = this.database.exec(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = '${escapeSqlString(conversationId)}'
       ORDER BY created_at ASC`
    )

    if (rows.length === 0) {
      return []
    }

    return rows[0].values.map((value: unknown[]) => {
      const row: MessageRow = {
        id: String(value[0]),
        conversation_id: String(value[1]),
        role: String(value[2]) as ChatMessage['role'],
        content: String(value[3]),
        created_at: String(value[4])
      }
      return {
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at
      }
    })
  }

  private async getMemory(id: string): Promise<LongTermMemory | null> {
    const statement = this.database.prepare('SELECT id, content, enabled, created_at, updated_at FROM memories WHERE id = ?')
    try {
      statement.bind([id])
      if (!statement.step()) {
        return null
      }
      return memoryFromRow(statement.getAsObject() as unknown as MemoryRow)
    } finally {
      statement.free()
    }
  }

  private async persist(): Promise<void> {
    const write = this.persistQueue.catch(() => undefined).then(async () => {
      if (!this.db) {
        return
      }
      await writeFile(this.filePath, this.db.export())
    })
    this.persistQueue = write
    await write
  }

  private get database(): Database {
    if (!this.db) {
      throw new Error('Conversation repository is not initialized.')
    }
    return this.db
  }
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

function normalizeMemoryContent(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    throw new Error('记忆内容不能为空。')
  }
  return trimmed
}

function memoryFromRow(row: MemoryRow): LongTermMemory {
  return {
    id: row.id,
    content: row.content,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
