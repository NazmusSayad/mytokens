import type { UsageDataMessage } from '@/core/types.js'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let originalUserProfile: string | undefined
let originalHome: string | undefined
let tempHome: string

function setupTempHome(): string {
  tempHome = mkdtempSync(join(tmpdir(), 'mgroups-home-'))
  originalUserProfile = process.env.USERPROFILE
  originalHome = process.env.HOME
  process.env.USERPROFILE = tempHome
  process.env.HOME = tempHome
  return tempHome
}

function restoreHome() {
  if (originalUserProfile !== undefined) {
    process.env.USERPROFILE = originalUserProfile
  } else {
    delete process.env.USERPROFILE
  }
  if (originalHome !== undefined) {
    process.env.HOME = originalHome
  } else {
    delete process.env.HOME
  }
}

function homePath(...segments: string[]): string {
  return join(tempHome, '.mytokens', ...segments)
}

function messageWithModel(id: string, provider = 'unknown'): UsageDataMessage {
  return {
    source: 'test',
    agent: 'default',
    type: 'assistant',
    date: new Date('2024-03-01T10:00:00Z'),
    model: { id, provider },
    tokens: {
      input: 1,
      output: 2,
      reasoning: 0,
      cacheInput: 0,
      cacheOutput: 0,
    },
  }
}

function stubFailingFetch() {
  const fetchStub = vi.fn(async () => {
    throw new Error('network down')
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function stubFetchByResponse(responses: Record<string, unknown>) {
  const fetchStub = vi.fn(async (url: string | URL | RequestInfo) => {
    const key = String(url)
    if (!(key in responses)) {
      throw new Error(`Unexpected fetch url: ${key}`)
    }
    return { ok: true, json: async () => responses[key] }
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

describe('model-groups', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
    vi.unstubAllGlobals()
  })

  async function freshModule() {
    vi.resetModules()
    return await import('./model-groups.js')
  }

  const REMOTE_URL =
    'https://raw.githubusercontent.com/NazmusSayad/mytokens/main/groups.json'
  const MODELS_DEV_URL = 'https://models.dev/api.json'

  function stubCatalogFetch(groupsPayload: unknown, catalogPayload: unknown) {
    return stubFetchByResponse({
      [REMOTE_URL]: groupsPayload,
      [MODELS_DEV_URL]: catalogPayload,
    })
  }

  describe('applyModelGroups', () => {
    function resolution(
      groups: Record<string, { provider: string; model: string }>,
      nonFreeIds: string[] = []
    ) {
      return { groups, nonFreeIds: new Set(nonFreeIds) }
    }

    it('rewrites id and provider on match', async () => {
      const { applyModelGroups } = await freshModule()
      const grouped = applyModelGroups(
        resolution({
          'gpt-4o-2024-08-13': { provider: 'openai', model: 'gpt-4o' },
        }),
        messageWithModel('gpt-4o-2024-08-13').model
      )
      expect(grouped.id).toBe('gpt-4o')
      expect(grouped.provider).toBe('openai')
    })

    it('auto-groups free variants when the provider has the non-free model', async () => {
      const { applyModelGroups } = await freshModule()
      const grouped = applyModelGroups(
        resolution({}, ['deepseek::deepseek-v4-flash']),
        messageWithModel('deepseek-v4-flash-free', 'deepseek').model
      )
      expect(grouped.id).toBe('deepseek-v4-flash')
    })

    it('keeps the id when no non-free counterpart exists for the provider', async () => {
      const { applyModelGroups } = await freshModule()
      const original = messageWithModel('some-model-free').model
      const grouped = applyModelGroups(resolution({}, []), original)
      expect(grouped).toBe(original)
    })

    it('returns the original model when there is no match', async () => {
      const { applyModelGroups } = await freshModule()
      const original = messageWithModel('gpt-4o').model
      const grouped = applyModelGroups(
        resolution({
          'other-id': { provider: 'openai', model: 'gpt-4o' },
        }),
        original
      )
      expect(grouped).toBe(original)
    })

    it('groups gateway org-prefixed ids to the direct provider when known', async () => {
      const { applyModelGroups } = await freshModule()
      const grouped = applyModelGroups(
        resolution({}, ['openai::gpt-oss-120b']),
        messageWithModel('openai/gpt-oss-120b', 'openrouter').model
      )
      expect(grouped.id).toBe('gpt-oss-120b')
      expect(grouped.provider).toBe('openai')
    })

    it('keeps gateway ids when the prefix is not a known provider', async () => {
      const { applyModelGroups } = await freshModule()
      const original = messageWithModel('stealth/ox-alpha', 'openrouter').model
      const grouped = applyModelGroups(resolution({}, []), original)
      expect(grouped).toBe(original)
    })

    it('keeps gateway ids when the direct provider lacks that model', async () => {
      const { applyModelGroups } = await freshModule()
      const original = messageWithModel(
        'deepseek/deepseek-v4-flash-0731',
        'vercel'
      ).model
      const grouped = applyModelGroups(
        resolution({}, ['deepseek::deepseek-v4-flash']),
        original
      )
      expect(grouped).toBe(original)
    })

    it('ignores org-prefixed ids for providers outside the gateway list', async () => {
      const { applyModelGroups } = await freshModule()
      const original = messageWithModel(
        'qwen/qwen3.6-max-preview',
        'kilo'
      ).model
      const grouped = applyModelGroups(
        resolution({}, ['qwen::qwen3.6-max-preview']),
        original
      )
      expect(grouped).toBe(original)
    })

    it('prefers same-provider free-suffix grouping over the gateway prefix rule', async () => {
      const { applyModelGroups } = await freshModule()
      const grouped = applyModelGroups(
        resolution({}, ['openrouter::z-ai/glm-5.2', 'zai::glm-5.2']),
        messageWithModel('z-ai/glm-5.2:free', 'openrouter').model
      )
      expect(grouped.id).toBe('z-ai/glm-5.2')
      expect(grouped.provider).toBe('openrouter')
    })
  })

  describe('loadModelGroups', () => {
    it('downloads the remote groups, persists them and applies local overrides', async () => {
      mkdirSync(homePath(), { recursive: true })
      writeFileSync(
        homePath('groups.json'),
        JSON.stringify({
          'user-model': { provider: 'user-provider', model: 'user-model' },
          'shared-model': { provider: 'local-provider', model: 'local-name' },
        })
      )

      const fetchStub = stubCatalogFetch(
        {
          'remote-model': { provider: 'openai', model: 'remote-name' },
          'shared-model': { provider: 'remote-provider', model: 'remote-name' },
          'broken-entry': { provider: 'openai' },
          'numeric-entry': 42,
        },
        { deepseek: { models: { 'deepseek-v4-flash': {} } } }
      )

      const { loadModelGroups } = await freshModule()
      const resolved = await loadModelGroups()

      expect(fetchStub).toHaveBeenCalledTimes(2)
      expect(resolved.groups).toEqual({
        'remote-model': { provider: 'openai', model: 'remote-name' },
        'shared-model': { provider: 'local-provider', model: 'local-name' },
        'user-model': { provider: 'user-provider', model: 'user-model' },
      })
      expect(resolved.nonFreeIds.has('deepseek::deepseek-v4-flash')).toBe(true)

      const persisted = JSON.parse(
        readFileSync(homePath('cache', 'model-groups.json'), 'utf-8')
      ) as Record<string, unknown>
      expect(persisted['remote-model']).toEqual({
        provider: 'openai',
        model: 'remote-name',
      })
      expect(persisted['broken-entry']).toBeUndefined()
      expect(persisted['numeric-entry']).toBeUndefined()
    })

    it('falls back to the persisted download when offline', async () => {
      mkdirSync(homePath('cache'), { recursive: true })
      writeFileSync(
        homePath('cache', 'model-groups.json'),
        JSON.stringify({
          'cached-model': { provider: 'openai', model: 'cached-name' },
          invalid: null,
        })
      )

      const fetchStub = stubFailingFetch()

      const { loadModelGroups } = await freshModule()
      const resolved = await loadModelGroups()

      expect(fetchStub).toHaveBeenCalledTimes(2)
      expect(resolved.groups).toEqual({
        'cached-model': { provider: 'openai', model: 'cached-name' },
      })
    })

    it('returns empty groups when offline and nothing is persisted', async () => {
      mkdirSync(homePath(), { recursive: true })

      stubFailingFetch()

      const { loadModelGroups } = await freshModule()
      const resolved = await loadModelGroups()

      expect(resolved.groups).toEqual({})
    })

    it('skips the catalog fetch when auto-grouping is disabled', async () => {
      mkdirSync(homePath(), { recursive: true })

      const fetchStub = stubCatalogFetch(
        {
          'remote-model': { provider: 'openai', model: 'remote-name' },
        },
        { deepseek: { models: { 'deepseek-v4-flash': {} } } }
      )

      const { applyModelGroups, loadModelGroups } = await freshModule()
      const resolved = await loadModelGroups({ auto: false })

      expect(fetchStub).toHaveBeenCalledTimes(1)
      expect(resolved.groups).toEqual({
        'remote-model': { provider: 'openai', model: 'remote-name' },
      })
      expect(resolved.nonFreeIds.size).toBe(0)

      const grouped = applyModelGroups(
        resolved,
        messageWithModel('deepseek-v4-flash-free', 'deepseek').model
      )
      expect(grouped.id).toBe('deepseek-v4-flash-free')

      const explicit = applyModelGroups(
        resolved,
        messageWithModel('remote-model', 'openai').model
      )
      expect(explicit.id).toBe('remote-name')
    })

    it('skips the remote download when defaults are disabled and uses only local overrides', async () => {
      mkdirSync(homePath(), { recursive: true })
      writeFileSync(
        homePath('groups.json'),
        JSON.stringify({
          'local-model': { provider: 'local-provider', model: 'local-name' },
        })
      )
      mkdirSync(homePath('cache'), { recursive: true })
      writeFileSync(
        homePath('cache', 'model-groups.json'),
        JSON.stringify({
          'cached-model': { provider: 'openai', model: 'cached-name' },
        })
      )

      const fetchStub = stubFailingFetch()

      const { loadModelGroups } = await freshModule()
      const resolved = await loadModelGroups({ defaults: false })

      expect(fetchStub).toHaveBeenCalledTimes(1)
      expect(resolved.groups).toEqual({
        'local-model': { provider: 'local-provider', model: 'local-name' },
      })
    })

    it('ignores the fetch cache when fresh is requested but still writes through', async () => {
      mkdirSync(homePath(), { recursive: true })

      const seedFetch = stubCatalogFetch(
        {
          'seeded-model': { provider: 'openai', model: 'seeded-name' },
        },
        {}
      )
      const seeded = await freshModule()
      await seeded.loadModelGroups()
      expect(seedFetch).toHaveBeenCalledTimes(2)

      const refetchStub = stubCatalogFetch(
        {
          'fresh-model': { provider: 'openai', model: 'fresh-name' },
        },
        {}
      )

      const { loadModelGroups } = await freshModule()
      const resolved = await loadModelGroups({ fresh: true })

      expect(refetchStub).toHaveBeenCalledTimes(2)
      expect(resolved.groups).toEqual({
        'fresh-model': { provider: 'openai', model: 'fresh-name' },
      })
    })
  })
})
