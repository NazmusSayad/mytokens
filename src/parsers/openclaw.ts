import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'
import { existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, join } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionIndex {
  [key: string]: SessionEntry
}

interface SessionEntry {
  sessionId: string
  sessionFile?: string
}

interface OpenClawEntry {
  type: string
  message?: OpenClawMessage
  customType?: string
  data?: OpenClawModelData
  modelId?: string
  provider?: string
}

interface OpenClawMessage {
  role?: string
  usage?: OpenClawUsage
  timestamp?: number
  provider?: string
  model?: string
}

interface OpenClawModelData {
  provider?: string
  modelId?: string
}

interface OpenClawUsage {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  totalTokens?: number
  cost?: { total?: number }
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseOpenClaw(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.openclaw/agents')
  const files = scanDirectory(root, '*.json')

  for (const path of files) {
    if (basename(path) === 'sessions.json') {
      const messages = parseOpenClawIndex(path)
      results.push(...messages)
    }
  }

  const jsonlFiles = scanDirectory(root, '*.jsonl')
  for (const path of jsonlFiles) {
    const messages = parseOpenClawTranscript(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseOpenClawIndex(indexPath: string): UsageDataMessage[] {
  const data = readFileOrNone(indexPath)
  if (!data) return []

  let index: SessionIndex
  try {
    index = JSON.parse(data.toString('utf-8')) as SessionIndex
  } catch {
    return []
  }

  const indexDir = dirname(indexPath)
  const allMessages: UsageDataMessage[] = []

  for (const entry of Object.values(index)) {
    const sessionPath = resolveSessionPath(indexDir, entry)
    if (existsSync(sessionPath)) {
      const messages = parseOpenClawSession(sessionPath, entry.sessionId)
      allMessages.push(...messages)
    }
  }

  return allMessages
}

function resolveSessionPath(indexDir: string, entry: SessionEntry): string {
  if (entry.sessionFile && entry.sessionFile.trim()) {
    const trimmed = entry.sessionFile.trim()
    if (isAbsolute(trimmed)) {
      return trimmed
    }
    return join(indexDir, trimmed)
  }
  return join(indexDir, `${entry.sessionId}.jsonl`)
}

function parseOpenClawTranscript(transcriptPath: string): UsageDataMessage[] {
  const fileName = basename(transcriptPath)
  const dotIndex = fileName.indexOf('.jsonl')
  if (dotIndex === -1) return []

  const sessionId = fileName.slice(0, dotIndex)
  if (!sessionId) return []

  return parseOpenClawSession(transcriptPath, sessionId)
}

function parseOpenClawSession(
  sessionPath: string,
  _sessionId: string
): UsageDataMessage[] {
  const data = readFileOrNone(sessionPath)
  if (!data) return []

  const fileMtime = fileModifiedTimestampMs(sessionPath)
  const lines = data.toString('utf-8').split(/\r?\n/)
  const messages: UsageDataMessage[] = []

  let currentModel: string | undefined
  let currentProvider: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let entry: OpenClawEntry
    try {
      entry = JSON.parse(trimmed) as OpenClawEntry
    } catch {
      continue
    }

    switch (entry.type) {
      case 'model_change': {
        if (entry.modelId) currentModel = entry.modelId
        if (entry.provider) currentProvider = entry.provider
        break
      }
      case 'custom': {
        if (entry.customType !== 'model-snapshot') break
        if (entry.data?.modelId) currentModel = entry.data.modelId
        if (entry.data?.provider) currentProvider = entry.data.provider
        break
      }
      case 'message': {
        if (!entry.message) break
        if (entry.message.role !== 'assistant') break
        if (!entry.message.usage) break

        const usage = entry.message.usage
        const model = entry.message.model || currentModel
        const provider = entry.message.provider || currentProvider || 'unknown'

        if (!model) break

        currentModel = model
        currentProvider = provider

        const timestamp = entry.message.timestamp || fileMtime

        messages.push({
          app: 'openclaw',
          mode: 'chat',
          type: 'assistant',
          date: new Date(timestamp),
          model: {
            id: model,
            provider,
          },
          tokens: {
            input: Math.max(0, usage.input || 0),
            output: Math.max(0, usage.output || 0),
            reasoning: 0,
            cacheInput: Math.max(0, usage.cacheRead || 0),
            cacheOutput: Math.max(0, usage.cacheWrite || 0),
          },
        })
        break
      }
    }
  }

  return messages
}
