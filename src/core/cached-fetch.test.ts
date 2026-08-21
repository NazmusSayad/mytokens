import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let originalUserProfile: string | undefined
let originalHome: string | undefined
let tempHome: string

function setupTempHome(): string {
  tempHome = mkdtempSync(join(tmpdir(), 'fcache-home-'))
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

function stubFetch(payload: unknown) {
  const fetchStub = vi.fn(async () => ({
    ok: true,
    json: async () => payload,
  }))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function stubFailingFetch() {
  const fetchStub = vi.fn(async () => {
    throw new Error('network down')
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

describe('cached-fetch', () => {
  beforeEach(() => {
    setupTempHome()
    mkdirSync(join(tempHome, '.mytokens'), { recursive: true })
  })

  afterEach(() => {
    restoreHome()
    vi.unstubAllGlobals()
  })

  async function freshModule() {
    vi.resetModules()
    return await import('./cached-fetch.js')
  }

  it('serves repeat calls for the same url from cache', async () => {
    const { cachedFetchJSON } = await freshModule()
    const fetchStub = stubFetch({ hello: 'world' })

    const first = await cachedFetchJSON('https://example.com/data')
    const second = await cachedFetchJSON('https://example.com/data')

    expect(first).toEqual({ hello: 'world' })
    expect(second).toEqual({ hello: 'world' })
    expect(fetchStub).toHaveBeenCalledTimes(1)
  })

  it('refetches when fresh is requested', async () => {
    const { cachedFetchJSON } = await freshModule()
    const fetchStub = stubFetch({ hello: 'world' })

    await cachedFetchJSON('https://example.com/data', { fresh: true })
    await cachedFetchJSON('https://example.com/data', { fresh: true })

    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('still stores fetched data so later runs can use the cache', async () => {
    stubFetch({ hello: 'world' })
    const firstRun = await freshModule()
    await firstRun.cachedFetchJSON('https://example.com/data', {
      fresh: true,
    })

    const secondRun = await freshModule()
    const failingFetch = stubFailingFetch()

    const data = await secondRun.cachedFetchJSON('https://example.com/data')

    expect(data).toEqual({ hello: 'world' })
    expect(failingFetch).not.toHaveBeenCalled()
  })
})
