import type { UsageDataMessage } from '@/core/types.js'
import {
  fileModifiedTimestampMs,
  readFileOrNone,
  resolveHome,
  scanDirectory,
} from '@/helpers/parser.js'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WireLine {
  timestamp?: number
  message?: WireMessage
  type?: string
}

interface WireMessage {
  type: string
  payload?: StatusPayload
}

interface StatusPayload {
  token_usage?: TokenUsage
  message_id?: string
}

interface TokenUsage {
  input_other?: number
  output?: number
  input_cache_read?: number
  input_cache_creation?: number
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function parseKimi(): Promise<UsageDataMessage[]> {
  const results: UsageDataMessage[] = []

  const root = resolveHome('~/.kimi/sessions')
  const files = scanDirectory(root, '*.jsonl')

  for (const path of files) {
    if (basename(path) !== 'wire.jsonl') continue
    const messages = parseKimiFile(path)
    results.push(...messages)
  }

  return results
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseKimiFile(path: string): UsageDataMessage[] {
  const data = readFileOrNone(path)
  if (!data) return []

  const model = readModelFromConfig(path)
  const fallbackTimestamp = fileModifiedTimestampMs(path)

  const lines = data.toString('utf-8').split(/\r?\n/)
  const messages: UsageDataMessage[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let wireLine: WireLine
    try {
      wireLine = JSON.parse(trimmed) as WireLine
    } catch {
      continue
    }

    if (wireLine.type === 'metadata') continue
    if (!wireLine.message) continue
    if (wireLine.message.type !== 'StatusUpdate') continue

    const payload = wireLine.message.payload
    if (!payload) continue

    const tokenUsage = payload.token_usage
    if (!tokenUsage) continue

    const input = Math.max(0, tokenUsage.input_other || 0)
    const output = Math.max(0, tokenUsage.output || 0)
    const cacheRead = Math.max(0, tokenUsage.input_cache_read || 0)
    const cacheWrite = Math.max(0, tokenUsage.input_cache_creation || 0)

    if (input + output + cacheRead + cacheWrite === 0) continue

    const timestamp = wireLine.timestamp
      ? wireLine.timestamp * 1000
      : fallbackTimestamp

    messages.push({
      app: 'kimi',
      mode: 'chat',
      type: 'assistant',
      date: new Date(timestamp),
      model: {
        id: model,
        provider: 'moonshot',
      },
      tokens: {
        input,
        output,
        reasoning: 0,
        cacheInput: cacheRead,
        cacheOutput: cacheWrite,
      },
    })
  }

  return messages
}

function readModelFromConfig(wirePath: string): string {
  const sessionsDir = dirname(dirname(dirname(wirePath)))
  const configPath = join(sessionsDir, 'config.json')

  try {
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content) as { model?: string }
    if (config.model && config.model.trim()) {
      return config.model.trim()
    }
  } catch {
    // fall through
  }

  return 'kimi-for-coding'
}
