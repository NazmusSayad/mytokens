import type { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import {
  fileModifiedTimestampMs,
  inferProviderFromModel,
  resolveHome,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KiloMessage {
  id?: string
  session_id?: string
  role: string
  modelID?: string
  providerID?: string
  cost?: number
  tokens?: KiloTokens
  time?: KiloTime
  agent?: string
  mode?: string
}

interface KiloTokens {
  input: number
  output: number
  reasoning?: number
  cache: KiloCache
}

interface KiloCache {
  read: number
  write: number
}

interface KiloTime {
  created: number
  completed?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseKilo(): Promise<UsageDataMessage[]> {
  const dbPath = resolveHome('~/.local/share/kilo/kilo.db')
  const db = await readSQLiteDB(dbPath)
  if (!db) return []

  const fallbackTimestamp = fileModifiedTimestampMs(dbPath)

  try {
    const rows = await sqliteAll(
      db,
      `
        SELECT m.id, m.data
        FROM message m
        WHERE json_extract(m.data, '$.role') = 'assistant'
          AND json_extract(m.data, '$.tokens') IS NOT NULL
      `
    )

    const messages: UsageDataMessage[] = []
    for (const row of rows) {
      const dataJson = String(row.data || '{}')
      let msg: KiloMessage
      try {
        msg = JSON.parse(dataJson) as KiloMessage
      } catch {
        continue
      }

      if (msg.role !== 'assistant') continue
      if (!msg.tokens) continue
      if (!msg.modelID) continue

      const modelId = msg.modelID
      const provider =
        msg.providerID || inferProviderFromModel(modelId) || 'kilo'
      const timestamp = msg.time?.created ? msg.time.created : fallbackTimestamp

      const tokens = msg.tokens
      messages.push({
        app: 'kilo',
        mode: msg.agent || msg.mode ? 'agent' : 'chat',
        type: 'assistant',
        date: new Date(timestamp),
        model: {
          id: modelId,
          provider,
        },
        tokens: {
          input: Math.max(0, tokens.input || 0),
          output: Math.max(0, tokens.output || 0),
          reasoning: Math.max(0, tokens.reasoning || 0),
          cacheInput: Math.max(0, tokens.cache.read || 0),
          cacheOutput: Math.max(0, tokens.cache.write || 0),
        },
      })
    }

    db.close()
    return messages
  } catch {
    db.close()
    return []
  }
}
