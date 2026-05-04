import type { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import { resolveHome } from '@/helpers/parser.js'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseSynthetic(): Promise<UsageDataMessage[]> {
  const paths = [
    resolveHome('~/.local/share/octofriend/octofriend.db'),
    resolveHome('~/Library/Application Support/octofriend/octofriend.db'),
  ]

  for (const dbPath of paths) {
    const db = await readSQLiteDB(dbPath)
    if (!db) continue

    try {
      const messages = await parseOctofriendSqlite(db)
      db.close()
      return messages
    } catch {
      db.close()
      continue
    }
  }

  return []
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function parseOctofriendSqlite(
  db: import('sqlite3').Database
): Promise<UsageDataMessage[]> {
  // Check if token-tracking tables exist
  const tableRows = await sqliteAll(
    db,
    `SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name IN ('messages', 'sessions', 'token_usage')`
  )
  const hasMessagesTable = Number(tableRows[0]?.cnt || 0) > 0
  if (!hasMessagesTable) return []

  const messages: UsageDataMessage[] = []

  // Try 'messages' table first
  try {
    const rows = await sqliteAll(
      db,
      `
        SELECT
          id, model, input_tokens, output_tokens,
          cache_read_tokens, cache_write_tokens, reasoning_tokens,
          cost, timestamp, session_id, provider
        FROM messages
        WHERE input_tokens IS NOT NULL OR output_tokens IS NOT NULL
      `
    )

    for (const row of rows) {
      const modelId = String(row.model || '')
      const input = Math.max(0, Number(row.input_tokens || 0))
      const output = Math.max(0, Number(row.output_tokens || 0))
      const cacheRead = Math.max(0, Number(row.cache_read_tokens || 0))
      const cacheWrite = Math.max(0, Number(row.cache_write_tokens || 0))
      const reasoning = Math.max(0, Number(row.reasoning_tokens || 0))

      if (input + output + cacheRead + cacheWrite + reasoning === 0) continue

      const timestamp = Number(row.timestamp || 0)
      const tsMs = timestamp > 1e12 ? timestamp : timestamp * 1000

      messages.push({
        app: 'synthetic',
        mode: 'chat',
        type: 'assistant',
        date: new Date(tsMs),
        model: {
          id: normalizeSyntheticModel(modelId),
          provider: String(row.provider || 'synthetic'),
        },
        tokens: {
          input,
          output,
          reasoning,
          cacheInput: cacheRead,
          cacheOutput: cacheWrite,
        },
      })
    }
  } catch {
    // fall through to token_usage
  }

  // Try 'token_usage' table as alternative
  if (messages.length === 0) {
    try {
      const rows = await sqliteAll(
        db,
        `
          SELECT id, model, input_tokens, output_tokens, timestamp, session_id
          FROM token_usage
          WHERE input_tokens > 0 OR output_tokens > 0
        `
      )

      for (const row of rows) {
        const modelId = String(row.model || '')
        const input = Math.max(0, Number(row.input_tokens || 0))
        const output = Math.max(0, Number(row.output_tokens || 0))

        if (input + output === 0) continue

        const timestamp = Number(row.timestamp || 0)
        const tsMs = timestamp > 1e12 ? timestamp : timestamp * 1000

        messages.push({
          app: 'synthetic',
          mode: 'chat',
          type: 'assistant',
          date: new Date(tsMs),
          model: {
            id: normalizeSyntheticModel(modelId),
            provider: 'synthetic',
          },
          tokens: {
            input,
            output,
            reasoning: 0,
            cacheInput: 0,
            cacheOutput: 0,
          },
        })
      }
    } catch {
      // no token_usage table
    }
  }

  return messages
}

function normalizeSyntheticModel(modelId: string): string {
  const lower = modelId.toLowerCase()

  if (lower.startsWith('hf:')) {
    const rest = lower.slice(3)
    const slashIdx = rest.indexOf('/')
    if (slashIdx !== -1) return rest.slice(slashIdx + 1)
    return rest
  }

  if (lower.startsWith('accounts/')) {
    const rest = lower.slice(9)
    const modelsIdx = rest.indexOf('/models/')
    if (modelsIdx !== -1) return rest.slice(modelsIdx + 8)
  }

  return lower
}
