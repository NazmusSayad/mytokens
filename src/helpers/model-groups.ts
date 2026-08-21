import { MYTOKENS_GROUPS_PATH } from '@/config.js'
import {
  fetchModelsDotDev,
  ModelsDotDevResponse,
} from '@/core/fetch-models-dot-dev.js'
import type { UsageDataModel } from '@/core/types.js'
import { readFileAsJSON } from '@/helpers/fs.js'

export type ModelGroupEntry = {
  provider: string
  model: string
}

export type ModelGroups = Record<string, ModelGroupEntry>

export type ResolvedModelGroups = {
  groups: ModelGroups
  nonFreeIds: Set<string>
}

// Gateways whose model ids follow the "<org>/<model>" structure of the
// upstream provider. Only these get auto-grouped to the direct provider.
const ORG_PREFIXED_GATEWAYS = new Set(['openrouter', 'vercel'])

function isModelGroupEntry(value: unknown): value is ModelGroupEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  if (typeof entry.provider !== 'string') return false
  if (typeof entry.model !== 'string') return false
  return true
}

function sanitizeModelGroups(value: unknown): ModelGroups {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const result: ModelGroups = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isModelGroupEntry(entry)) continue
    result[key] = entry
  }
  return result
}

async function readLocalGroups(): Promise<ModelGroups> {
  return sanitizeModelGroups(
    await readFileAsJSON<unknown>(MYTOKENS_GROUPS_PATH)
  )
}

function collectNonFreeIds(response: ModelsDotDevResponse): Set<string> {
  const ids = new Set<string>()
  for (const [provider, info] of Object.entries(response)) {
    for (const modelId of Object.keys(info.models ?? {})) {
      ids.add(`${provider}::${modelId}`)
    }
  }
  return ids
}

async function fetchNonFreeIds(fresh?: boolean): Promise<Set<string>> {
  try {
    return collectNonFreeIds(await fetchModelsDotDev({ fresh }))
  } catch {
    return new Set()
  }
}

export type LoadModelGroupsOptions = {
  auto?: boolean
  fresh?: boolean
}

export async function loadModelGroups(
  options: LoadModelGroupsOptions = {}
): Promise<ResolvedModelGroups> {
  const [localGroups, nonFreeIds] = await Promise.all([
    readLocalGroups(),
    options.auto === false
      ? Promise.resolve(new Set<string>())
      : fetchNonFreeIds(options.fresh),
  ])

  return {
    groups: localGroups,
    nonFreeIds,
  }
}

export function applyModelGroups(
  resolved: ResolvedModelGroups,
  model: UsageDataModel
): UsageDataModel {
  const entry = resolved.groups[model.id]
  if (entry) {
    return {
      ...model,
      id: entry.model,
      provider: entry.provider,
    }
  }

  const nonFreeId = model.id.replace(/([-:_.\/])free$/i, '')
  if (
    nonFreeId !== model.id &&
    resolved.nonFreeIds.has(`${model.provider}::${nonFreeId}`)
  ) {
    return {
      ...model,
      id: nonFreeId,
    }
  }

  if (ORG_PREFIXED_GATEWAYS.has(model.provider)) {
    const slashIndex = model.id.indexOf('/')
    if (slashIndex > 0) {
      const provider = model.id.slice(0, slashIndex)
      const id = model.id.slice(slashIndex + 1)
      if (id && resolved.nonFreeIds.has(`${provider}::${id}`)) {
        return {
          ...model,
          provider,
          id,
        }
      }
    }
  }

  return model
}
