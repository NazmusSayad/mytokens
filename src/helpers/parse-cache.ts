import {
  MYTOKENS_LEGACY_PARSE_CACHE_PATH,
  MYTOKENS_PARSE_CACHE_PATH,
} from '@/config.js'
import type { UsageDataMessage } from '@/core/types.js'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

const PARSE_CACHE_VERSION = 2
const PARSE_CACHE_MAX_ENTRIES = 20_000

type StoredMessage = Omit<UsageDataMessage, 'date'> & { date: string }

type CacheEntry = {
  identity: string
  messages: StoredMessage[]
}

type ParseCacheFile = {
  version: number
  entries: Record<string, CacheEntry>
}

let cacheEntries: Map<string, CacheEntry> | undefined
let cacheDirty = false
let cacheDisabled = false

function loadCache(): Map<string, CacheEntry> {
  if (cacheEntries) return cacheEntries

  cacheEntries = new Map()
  try {
    unlinkSync(MYTOKENS_LEGACY_PARSE_CACHE_PATH)
  } catch {
    // no legacy cache file on disk
  }
  try {
    const parsed = JSON.parse(
      readFileSync(MYTOKENS_PARSE_CACHE_PATH, 'utf-8')
    ) as ParseCacheFile
    if (
      parsed.version === PARSE_CACHE_VERSION &&
      parsed.entries &&
      typeof parsed.entries === 'object'
    ) {
      for (const [path, entry] of Object.entries(parsed.entries)) {
        if (
          entry &&
          typeof entry.identity === 'string' &&
          Array.isArray(entry.messages)
        ) {
          cacheEntries.set(path, entry)
        }
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

export function disableFileMessagesCache(): void {
  cacheDisabled = true
}

export function clearFileMessagesCache(): void {
  cacheEntries = new Map()
  cacheDirty = false
  try {
    unlinkSync(MYTOKENS_PARSE_CACHE_PATH)
  } catch {
    // no cache file on disk
  }
  try {
    unlinkSync(MYTOKENS_LEGACY_PARSE_CACHE_PATH)
  } catch {
    // no legacy cache file on disk
  }
}

export function getCachedFileMessages(
  path: string
): UsageDataMessage[] | undefined {
  if (cacheDisabled) return undefined

  const identity = fileIdentityKey(path)
  if (!identity) return undefined

  const entry = loadCache().get(path)
  if (!entry || entry.identity !== identity) return undefined

  return entry.messages.map((message) => ({
    ...message,
    date: new Date(message.date),
  }))
}

export function storeFileMessages(
  path: string,
  messages: UsageDataMessage[]
): void {
  if (cacheDisabled) return

  const identity = fileIdentityKey(path)
  if (!identity) return

  const serialized: StoredMessage[] = messages.map((message) => ({
    ...message,
    date: message.date.toISOString(),
  }))
  const entries = loadCache()
  entries.delete(path)
  entries.set(path, { identity, messages: serialized })
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

export type FileMessagesCacheEntry = {
  path: string
  messages: number
  bytes: number
}

export function listFileMessagesCache(): FileMessagesCacheEntry[] {
  const result: FileMessagesCacheEntry[] = []
  for (const [path, entry] of loadCache()) {
    result.push({
      path,
      messages: entry.messages.length,
      bytes: Buffer.byteLength(JSON.stringify(entry)),
    })
  }
  return result.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

export type FileMessagesCacheInfo = {
  existsOnDisk: boolean
  fileBytes: number
  entries: number
  messages: number
}

export function getFileMessagesCacheInfo(): FileMessagesCacheInfo {
  let existsOnDisk = false
  let fileBytes = 0
  try {
    fileBytes = statSync(MYTOKENS_PARSE_CACHE_PATH).size
    existsOnDisk = true
  } catch {
    // no cache file on disk yet
  }

  let messages = 0
  for (const entry of loadCache().values()) {
    messages += entry.messages.length
  }

  return {
    existsOnDisk,
    fileBytes,
    entries: loadCache().size,
    messages,
  }
}
