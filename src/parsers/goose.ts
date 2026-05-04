import type { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import {
  canonicalProvider,
  inferProviderFromModel,
  resolveHome,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GooseModelConfig {
  model_name: string
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseGoose(): Promise<UsageDataMessage[]> {
  const paths = [
    resolveHome('~/.local/share/goose/sessions/sessions.db'),
    resolveHome('~/Library/Application Support/goose/sessions/sessions.db'),
    resolveHome('~/.local/share/Block/goose/sessions/sessions.db'),
  ]

  if (process.env.GOOSE_PATH_ROOT) {
    paths.unshift(`${process.env.GOOSE_PATH_ROOT}/data/sessions/sessions.db`)
  }

  for (const dbPath of paths) {
    const db = await readSQLiteDB(dbPath)
    if (!db) continue

    try {
      const rows = await sqliteAll(
        db,
        `
          SELECT
            id,
            model_config_json,
            provider_name,
            created_at,
            total_tokens,
            input_tokens,
            output_tokens,
            accumulated_total_tokens,
            accumulated_input_tokens,
            accumulated_output_tokens
          FROM sessions
          WHERE model_config_json IS NOT NULL
            AND TRIM(model_config_json) != ''
        `
      )

      const messages: UsageDataMessage[] = []
      for (const row of rows) {
        const modelConfigJson = String(row.model_config_json || '')
        const modelId = parseModelConfig(modelConfigJson)
        if (!modelId) continue

        const providerName = row.provider_name
          ? String(row.provider_name)
          : undefined
        const provider =
          (providerName &&
            canonicalProvider(providerName.trim()) !== undefined &&
            canonicalProvider(providerName.trim())) ||
          inferProviderFromModel(modelId) ||
          'goose'

        const createdAt = String(row.created_at || '')
        const createdAtTs = parseCreatedAt(createdAt)

        const input = Math.max(
          0,
          Number(row.accumulated_input_tokens || row.input_tokens || 0)
        )
        const output = Math.max(
          0,
          Number(row.accumulated_output_tokens || row.output_tokens || 0)
        )
        const total = Math.max(
          0,
          Number(row.accumulated_total_tokens || row.total_tokens || 0)
        )

        if (input === 0 && output === 0 && total === 0) continue

        const reasoning = total > input + output ? total - input - output : 0

        messages.push({
          app: 'goose',
          mode: 'chat',
          type: 'assistant',
          date: new Date(timestampSecsToMs(createdAtTs)),
          model: {
            id: modelId,
            provider,
          },
          tokens: {
            input,
            output,
            reasoning,
            cacheInput: 0,
            cacheOutput: 0,
          },
        })
      }

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

function parseModelConfig(json: string): string | undefined {
  try {
    const config = JSON.parse(json) as GooseModelConfig
    const name = config.model_name.trim()
    return name || undefined
  } catch {
    return undefined
  }
}

function timestampSecsToMs(timestamp: number): number {
  if (timestamp > 1e12) return timestamp
  return timestamp * 1000
}

function parseCreatedAt(s: string): number {
  if (!s) return 0
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return parsed

  // Try SQLite timestamp format
  const sqliteMatch = s.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  )
  if (sqliteMatch) {
    const date = new Date(
      parseInt(sqliteMatch[1]),
      parseInt(sqliteMatch[2]) - 1,
      parseInt(sqliteMatch[3]),
      parseInt(sqliteMatch[4]),
      parseInt(sqliteMatch[5]),
      parseInt(sqliteMatch[6])
    )
    return date.getTime()
  }

  // Try date-only format
  const dateMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    const date = new Date(
      parseInt(dateMatch[1]),
      parseInt(dateMatch[2]) - 1,
      parseInt(dateMatch[3]),
      12,
      0,
      0
    )
    return date.getTime()
  }

  return 0
}
