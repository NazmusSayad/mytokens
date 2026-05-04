import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PiSessionHeader {
  type: string
  id: string
  timestamp?: string
  cwd?: string
}

interface PiSessionEntry {
  type: string
  id?: string
  parentId?: string
  timestamp?: string
  message?: PiMessage
}

interface PiMessage {
  role?: string
  usage?: PiUsage
  model?: string
  provider?: string
}

interface PiUsage {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  totalTokens?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parsePi(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.pi/agent/sessions')
  const files = scanDirectory(root, '*.jsonl')

  for (const path of files) {
    const messages = parsePiFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parsePiFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  const fallbackTimestamp = fileModifiedTimestampMs(path)
  const lines = data.toString('utf-8').split(/\r?\n/)
  const messages: UsageDataMessage[] = []

  let sessionId: string | undefined
  let workspaceKey: string | undefined
  let workspaceLabel: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (sessionId === undefined) {
      let header: PiSessionHeader
      try {
        header = JSON.parse(trimmed) as PiSessionHeader
      } catch {
        return []
      }
      if (header.type !== 'session') return []
      sessionId = header.id
      workspaceKey = header.cwd || undefined
      workspaceLabel = workspaceKey
        ? workspaceKey.split('/').filter(Boolean).pop()
        : undefined
      continue
    }

    let entry: PiSessionEntry
    try {
      entry = JSON.parse(trimmed) as PiSessionEntry
    } catch {
      continue
    }

    if (entry.type !== 'message') continue
    if (!entry.message) continue
    if (entry.message.role !== 'assistant') continue
    if (!entry.message.usage) continue
    if (!entry.message.model) continue
    if (!entry.message.provider) continue

    const usage = entry.message.usage
    const input = Math.max(0, usage.input || 0)
    const output = Math.max(0, usage.output || 0)
    const cacheRead = Math.max(0, usage.cacheRead || 0)
    const cacheWrite = Math.max(0, usage.cacheWrite || 0)

    const timestamp = entry.timestamp
      ? Date.parse(entry.timestamp)
      : fallbackTimestamp

    const msg: UsageDataMessage = {
      app: 'pi',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: entry.message.model,
        provider: entry.message.provider,
      },
      tokens: {
        input,
        output,
        reasoning: 0,
        cacheInput: cacheRead,
        cacheOutput: cacheWrite,
      },
    }

    if (workspaceKey || workspaceLabel) {
      msg.project = {
        name: workspaceLabel,
        path: workspaceKey,
      }
    }

    messages.push(msg)
  }

  return messages
}
