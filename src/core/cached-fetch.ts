import {
  CACHE_VALIDITY_DURATION,
  OPENUSAGE_CACHE_REGISTRY_PATH,
} from '@/config.js'
import {
  readFileAsJSON,
  writeFileAsJSON,
  writeFileForced,
} from '@/helpers/fs.js'
import chalk from 'chalk'
import path from 'path'
import { ulid } from 'ulid'

function readRegistry() {
  return (
    readFileAsJSON<
      Record<
        string,
        {
          timestamp: number
          filePath: string
        }
      >
    >(OPENUSAGE_CACHE_REGISTRY_PATH) ?? {}
  )
}

function writeCache(url: string, data: Record<string, unknown>) {
  const registry = readRegistry()

  const previousEntry = registry[url]
  const cacheFilePath = previousEntry
    ? previousEntry.filePath
    : path.join(path.dirname(OPENUSAGE_CACHE_REGISTRY_PATH), ulid())

  registry[url] = { timestamp: Date.now(), filePath: cacheFilePath }

  writeFileForced(cacheFilePath, JSON.stringify(data))
  writeFileAsJSON(OPENUSAGE_CACHE_REGISTRY_PATH, registry)
}

function readFromCache<T>(url: string): T | null {
  const registry = readRegistry()

  const entry = registry[url]
  if (!entry) return null

  const isCacheInvalid = Date.now() - entry.timestamp > CACHE_VALIDITY_DURATION
  if (isCacheInvalid) return null

  const cacheContent = readFileAsJSON<Record<string, unknown>>(entry.filePath)
  if (!cacheContent) return null

  return cacheContent as T
}

export async function cachedFetchJSON<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const cachedData = readFromCache<T>(url)
  if (cachedData) {
    console.log(chalk.gray(`Using cached data for ${url}`))
    return cachedData
  }

  const response = await fetch(url, init)
  const data = (await response.json()) as unknown as Record<string, unknown>
  writeCache(url, data)

  console.log(chalk.blue(`Fetched fresh data for ${url}`))
  return data as T
}
