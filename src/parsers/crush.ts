import type { UsageDataMessage } from '@/core/types.js'
import { readSQLiteDB, sqliteAll } from '@/helpers/db.js'
import { resolveHome } from '@/helpers/parser.js'
import { readFileSync } from 'node:fs'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseCrush(): Promise<UsageDataMessage[]> {
  const dbPaths = discoverCrushDbs()

  for (const dbPath of dbPaths) {
    const db = await readSQLiteDB(dbPath)
    if (!db) continue

    try {
      const messages = await parseCrushSqlite(db, dbPath)
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

function discoverCrushDbs(): string[] {
  const results: string[] = []

  const xdgPath = resolveHome('~/.local/share/crush/projects.json')
  try {
    const content = readFileSync(xdgPath, 'utf-8')
    const projects = JSON.parse(content) as Array<{ path?: string }>
    for (const project of projects) {
      if (project.path) {
        results.push(`${project.path}/crush.db`)
      }
    }
  } catch {
    // fall through
  }

  return results
}

async function parseCrushSqlite(
  db: import('sqlite3').Database,
  _dbPath: string
): Promise<UsageDataMessage[]> {
  const rootSessions = await sqliteAll(
    db,
    `
      SELECT id, cost, created_at, updated_at
      FROM sessions
      WHERE parent_session_id IS NULL
        AND (COALESCE(message_count, 0) > 0 OR COALESCE(cost, 0) > 0)
      ORDER BY created_at ASC
    `
  )

  if (rootSessions.length === 0) return []

  const assistantRows = await sqliteAll(
    db,
    `
      WITH RECURSIVE session_tree(root_session_id, session_id) AS (
        SELECT id, id
        FROM sessions
        WHERE parent_session_id IS NULL
        UNION ALL
        SELECT st.root_session_id, s.id
        FROM sessions s
        JOIN session_tree st ON s.parent_session_id = st.session_id
      )
      SELECT st.root_session_id, m.created_at
      FROM session_tree st
      JOIN messages m ON m.session_id = st.session_id
      WHERE m.role = 'assistant'
      ORDER BY st.root_session_id ASC, m.created_at ASC
    `
  )

  const assistantBuckets = new Map<
    string,
    Map<string, { timestampMs: number; messageCount: number }>
  >()

  for (const row of assistantRows) {
    const sessionId = String(row.root_session_id || '')
    const createdAt = Number(row.created_at || 0)
    const timestampMs = normalizeCrushTimestampMs(createdAt)
    if (timestampMs === undefined) continue

    const localDay = localDayKey(timestampMs)
    if (!localDay) continue

    if (!assistantBuckets.has(sessionId)) {
      assistantBuckets.set(sessionId, new Map())
    }
    const dayMap = assistantBuckets.get(sessionId)!

    if (!dayMap.has(localDay)) {
      dayMap.set(localDay, { timestampMs, messageCount: 0 })
    }
    const bucket = dayMap.get(localDay)!
    bucket.timestampMs = Math.min(bucket.timestampMs, timestampMs)
    bucket.messageCount++
  }

  const messages: UsageDataMessage[] = []

  for (const row of rootSessions) {
    const sessionId = String(row.id || '')
    const cost = Math.max(0, Number(row.cost || 0))
    const createdAt = Number(row.created_at || 0)
    const updatedAt = Number(row.updated_at || 0)

    const dayBucketsMap = assistantBuckets.get(sessionId)
    if (dayBucketsMap) {
      const dayBuckets = Array.from(dayBucketsMap.values()).sort(
        (a, b) => a.timestampMs - b.timestampMs
      )
      const totalAssistantMessages = dayBuckets.reduce(
        (sum, b) => sum + b.messageCount,
        0
      )
      const safeCost = cost
      let allocatedCost = 0

      for (let i = 0; i < dayBuckets.length; i++) {
        const bucket = dayBuckets[i]
        const bucketCost =
          i + 1 === dayBuckets.length
            ? Math.max(0, safeCost - allocatedCost)
            : safeCost * (bucket.messageCount / totalAssistantMessages)
        allocatedCost += bucketCost

        messages.push({
          app: 'crush',
          mode: 'chat',
          type: 'assistant',
          date: new Date(bucket.timestampMs),
          model: {
            id: 'session-total',
            provider: 'crush',
          },
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cacheInput: 0,
            cacheOutput: 0,
          },
        })
      }
      continue
    }

    if (cost <= 0) continue

    const timestampMs = fallbackSessionTimestampMs(updatedAt, createdAt)
    if (timestampMs === undefined) continue

    messages.push({
      app: 'crush',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestampMs),
      model: {
        id: 'session-total',
        provider: 'crush',
      },
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheInput: 0,
        cacheOutput: 0,
      },
    })
  }

  messages.sort((a, b) => a.date.getTime() - b.date.getTime())

  return messages
}

function normalizeCrushTimestampMs(raw: number): number | undefined {
  if (raw <= 0) return undefined
  if (raw >= 100_000_000_000) return raw
  return raw * 1000
}

function localDayKey(timestampMs: number): string | undefined {
  try {
    const date = new Date(timestampMs)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return undefined
  }
}

function fallbackSessionTimestampMs(
  updatedAt: number,
  createdAt: number
): number | undefined {
  return (
    normalizeCrushTimestampMs(updatedAt) ?? normalizeCrushTimestampMs(createdAt)
  )
}
