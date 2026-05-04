import type { UsageDataMessage } from '@/core/types.js'
import {
  inferProviderFromModel,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseCursor(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.config/tokscale/cursor-cache')
  const files = scanDirectory(root, '*.csv')

  for (const path of files) {
    const messages = parseCursorFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseCursorFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  const content = data.toString('utf-8')
  const lines = content.split(/\r?\n/)
  const header = lines[0]
  if (!header || !header.includes('Date') || !header.includes('Model')) {
    return []
  }

  const headerFields = parseCsvLine(header)
  const hasKindColumn = headerFields.some((f) => f.trim() === 'Kind')
  const columnCount = headerFields.length

  let modelIdx: number
  let inputCacheWriteIdx: number
  let inputNoCacheIdx: number
  let cacheReadIdx: number
  let outputIdx: number
  let costIdx: number

  if (hasKindColumn && columnCount >= 11) {
    // v3 format
    modelIdx = 4
    inputCacheWriteIdx = 6
    inputNoCacheIdx = 7
    cacheReadIdx = 8
    outputIdx = 9
    costIdx = 11
  } else if (hasKindColumn) {
    // v2 format
    modelIdx = 2
    inputCacheWriteIdx = 3
    inputNoCacheIdx = 4
    cacheReadIdx = 5
    outputIdx = 6
    costIdx = 8
  } else {
    // v1 format
    modelIdx = 1
    inputCacheWriteIdx = 2
    inputNoCacheIdx = 3
    cacheReadIdx = 4
    outputIdx = 5
    costIdx = 7
  }

  const messages: UsageDataMessage[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const fields = parseCsvLine(line)
    const minFields = costIdx + 1
    if (fields.length < minFields) continue

    const dateStr = fields[0].trim().replace(/^"|"$/g, '')
    const model = fields[modelIdx].trim().replace(/^"|"$/g, '')
    const inputWithCacheWrite = parseInt(
      fields[inputCacheWriteIdx].trim().replace(/^"|"$/g, '') || '0',
      10
    )
    const inputWithoutCacheWrite = parseInt(
      fields[inputNoCacheIdx].trim().replace(/^"|"$/g, '') || '0',
      10
    )
    const cacheRead = parseInt(
      fields[cacheReadIdx].trim().replace(/^"|"$/g, '') || '0',
      10
    )
    const outputTokens = parseInt(
      fields[outputIdx].trim().replace(/^"|"$/g, '') || '0',
      10
    )
    if (!model) continue

    const timestamp = parseDateToTimestamp(dateStr)
    if (timestamp === 0) continue

    const cacheWrite = Math.max(0, inputWithCacheWrite - inputWithoutCacheWrite)
    const input = inputWithoutCacheWrite

    messages.push({
      app: 'cursor',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: model,
        provider: inferProviderFromModel(model),
      },
      tokens: {
        input: Math.max(0, input),
        output: Math.max(0, outputTokens),
        reasoning: 0,
        cacheInput: Math.max(0, cacheRead),
        cacheOutput: cacheWrite,
      },
    })
  }

  return messages
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let start = 0
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      fields.push(line.slice(start, i))
      start = i + 1
    }
  }

  fields.push(line.slice(start))
  return fields
}

function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0

  // ISO 8601 with milliseconds
  const parsed = Date.parse(dateStr)
  if (!isNaN(parsed)) return parsed

  // Date-only format: use noon UTC
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
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
