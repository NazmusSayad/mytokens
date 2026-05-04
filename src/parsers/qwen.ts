import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  normalizeWorkspaceKey,
  readFileOrNone,
  resolveHome,
  scanDirectory,
  workspaceLabelFromKey,
} from '@/helpers/parser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QwenLine {
  type?: string
  model?: string
  timestamp?: string
  sessionId?: string
  usageMetadata?: QwenUsageMetadata
}

interface QwenUsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  thoughtsTokenCount?: number
  cachedContentTokenCount?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseQwen(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.qwen/projects')
  const files = scanDirectory(root, '*.jsonl')

  for (const path of files) {
    const messages = parseQwenFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseQwenFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  const fileMtime = fileModifiedTimestampMs(path)
  const { workspaceKey, workspaceLabel } = qwenWorkspaceFromPath(path)

  const lines = data.toString('utf-8').split(/\r?\n/)
  const messages: UsageDataMessage[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let qwenLine: QwenLine
    try {
      qwenLine = JSON.parse(trimmed) as QwenLine
    } catch {
      continue
    }

    if (qwenLine.type !== 'assistant') continue
    if (!qwenLine.usageMetadata) continue

    const usage = qwenLine.usageMetadata
    const input = Math.max(0, usage.promptTokenCount || 0)
    const output = Math.max(0, usage.candidatesTokenCount || 0)
    const reasoning = Math.max(0, usage.thoughtsTokenCount || 0)
    const cacheRead = Math.max(0, usage.cachedContentTokenCount || 0)

    if (input + output + cacheRead + reasoning === 0) continue

    const model = qwenLine.model || 'unknown'
    const timestamp = qwenLine.timestamp
      ? Date.parse(qwenLine.timestamp)
      : fileMtime

    const msg: UsageDataMessage = {
      app: 'qwen',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: model,
        provider: 'qwen',
      },
      tokens: {
        input,
        output,
        reasoning,
        cacheInput: cacheRead,
        cacheOutput: 0,
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

function qwenWorkspaceFromPath(path: string): {
  workspaceKey: string | undefined
  workspaceLabel: string | undefined
} {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')

  for (let i = parts.length - 1; i >= 3; i--) {
    if (parts[i - 3] === 'projects' && parts[i - 1] === 'chats') {
      const key = normalizeWorkspaceKey(parts[i - 2])
      const label = key ? workspaceLabelFromKey(key) : undefined
      return { workspaceKey: key, workspaceLabel: label }
    }
  }

  return { workspaceKey: undefined, workspaceLabel: undefined }
}
