import type { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import {
  canonicalProvider,
  inferProviderFromModel,
  resolveHome,
} from '@/helpers/parser.js'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseHermes(): Promise<UsageDataMessage[]> {
  const paths = [
    resolveHome('~/.hermes/state.db'),
    resolveHome('~/Library/Application Support/hermes/state.db'),
  ]

  if (process.env.HERMES_HOME) {
    paths.unshift(`${process.env.HERMES_HOME}/state.db`)
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
          model,
          billing_provider,
          started_at,
          message_count,
          input_tokens,
          output_tokens,
          cache_read_tokens,
          cache_write_tokens,
          reasoning_tokens,
          estimated_cost_usd,
          actual_cost_usd
        FROM sessions
        WHERE model IS NOT NULL
          AND TRIM(model) != ''
          AND (
            COALESCE(input_tokens, 0) > 0 OR
            COALESCE(output_tokens, 0) > 0 OR
            COALESCE(cache_read_tokens, 0) > 0 OR
            COALESCE(cache_write_tokens, 0) > 0 OR
            COALESCE(reasoning_tokens, 0) > 0 OR
            COALESCE(actual_cost_usd, estimated_cost_usd, 0) > 0
          )
      `
      )

      const messages: UsageDataMessage[] = []
      for (const row of rows) {
        const modelId = String(row.model || '')
        const billingProvider = row.billing_provider
          ? String(row.billing_provider)
          : undefined
        const startedAt = Number(row.started_at || 0)
        const input = Math.max(0, Number(row.input_tokens || 0))
        const output = Math.max(0, Number(row.output_tokens || 0))
        const cacheRead = Math.max(0, Number(row.cache_read_tokens || 0))
        const cacheWrite = Math.max(0, Number(row.cache_write_tokens || 0))
        const reasoning = Math.max(0, Number(row.reasoning_tokens || 0))

        if (
          input === 0 &&
          output === 0 &&
          cacheRead === 0 &&
          cacheWrite === 0 &&
          reasoning === 0
        ) {
          continue
        }

        const provider =
          (billingProvider && canonicalProvider(billingProvider.trim())) ||
          inferProviderFromModel(modelId)

        const timestamp = timestampSecsToMs(startedAt)

        messages.push({
          app: 'hermes',
          mode: 'chat',
          type: 'assistant',
          date: new Date(timestamp),
          model: {
            id: modelId,
            provider,
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

function timestampSecsToMs(timestamp: number): number {
  if (timestamp > 1e12) return timestamp
  return timestamp * 1000
}
