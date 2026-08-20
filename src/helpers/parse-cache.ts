import { MYTOKENS_PARSE_CACHE_PATH } from '@/config.js'
import type { UsageDataMessage } from '@/core/types.js'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

const PARSE_CACHE_VERSION = 1
const PARSE_CACHE_MAX_ENTRIES = 20_000

type StoredMessage = Omit<UsageDataMessage, 'date'> & { date: string }

type ParseCacheFile = {
  version: number
  entries: Record<string, StoredMessage[]>
}

let cacheEntries: Map<string, StoredMessage[]> | undefined
let cacheDirty = false

function loadCache(): Map<string, StoredMessage[]> {
  if (cacheEntries) return cacheEntries

  cacheEntries = new Map()
  try {
    const parsed = JSON.parse(
      readFileSync(MYTOKENS_PARSE_CACHE_PATH, 'utf-8')
    ) as ParseCacheFile
    if (
      parsed.version === PARSE_CACHE_VERSION &&
      parsed.entries &&
      typeof parsed.entries === 'object'
    ) {
      for (const [key, messages] of Object.entries(parsed.entries)) {
        if (Array.isArray(messages)) cacheEntries.set(key, messages)
      }
    }
  } catch {
    // missing or corrupt cache starts empty
  }
  return cacheEntries
}

function fileIdentityKey(path: string): string | undefined {
  try {
    const stat = statSync(path)
    let key = `${path}|${stat.mtimeMs}|${stat.size}`

    try {
      const wal = statSync(`${path}-wal`)
      key += `|${wal.mtimeMs}|${wal.size}`
    } catch {
      // no sqlite wal sidecar
    }

    return key
  } catch {
    return undefined
  }
}

export function getCachedFileMessages(
  path: string
): UsageDataMessage[] | undefined {
  const key = fileIdentityKey(path)
  if (!key) return undefined

  const stored = loadCache().get(key)
  if (!stored) return undefined

  return stored.map((message) => ({
    ...message,
    date: new Date(message.date),
  }))
}

export function storeFileMessages(
  path: string,
  messages: UsageDataMessage[]
): void {
  const key = fileIdentityKey(path)
  if (!key) return

  const serialized: StoredMessage[] = messages.map((message) => ({
    ...message,
    date: message.date.toISOString(),
  }))
  const entries = loadCache()
  entries.delete(key)
  entries.set(key, serialized)
  cacheDirty = true
}

export function cachedFileMessages(
  path: string,
  parse: () => UsageDataMessage[]
): UsageDataMessage[] {
  const cached = getCachedFileMessages(path)
  if (cached) return cached

  const messages = parse()
  storeFileMessages(path, messages)
  return messages
}

export function flushFileMessagesCache(): void {
  if (!cacheDirty || !cacheEntries) return

  while (cacheEntries.size > PARSE_CACHE_MAX_ENTRIES) {
    const oldest = cacheEntries.keys().next()
    if (oldest.done) break
    cacheEntries.delete(oldest.value)
  }

  const payload: ParseCacheFile = {
    version: PARSE_CACHE_VERSION,
    entries: Object.fromEntries(cacheEntries),
  }

  try {
    mkdirSync(dirname(MYTOKENS_PARSE_CACHE_PATH), { recursive: true })
    const tmpPath = `${MYTOKENS_PARSE_CACHE_PATH}.tmp`
    writeFileSync(tmpPath, JSON.stringify(payload))
    renameSync(tmpPath, MYTOKENS_PARSE_CACHE_PATH)
    cacheDirty = false
  } catch {
    // cache write failures must not affect parsing results
  }
}
