import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseAntigravity } from './antigravity.js'

let originalUserProfile: string | undefined
let originalHome: string | undefined
let tempHome: string

function setupTempHome(): string {
  tempHome = mkdtempSync(join(tmpdir(), 'home-'))
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

describe('parseAntigravity', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseAntigravity()
    expect(result).toEqual([])
  })

  it('parses session_meta + usage rows', async () => {
    const dir = join(tempHome, '.config', 'antigravity-cache', 'sessions')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'session_meta', modelId: 'gpt-4o' }),
      JSON.stringify({
        type: 'usage',
        sessionId: 'ses-1',
        timestamp: 1700000000000,
        input: 100,
        output: 50,
        cacheRead: 20,
        cacheWrite: 5,
        reasoning: 2,
      }),
    ]
    writeFileSync(join(dir, 'session.jsonl'), lines.join('\n'))

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('antigravity')
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].tokens.reasoning).toBe(2)
  })

  it('skips zero-token usage rows', async () => {
    const dir = join(tempHome, '.config', 'antigravity-cache', 'sessions')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'session_meta', modelId: 'gpt-4o' }),
      JSON.stringify({
        type: 'usage',
        sessionId: 'ses-1',
        timestamp: 1700000000000,
        input: 0,
        output: 0,
      }),
    ]
    writeFileSync(join(dir, 'session.jsonl'), lines.join('\n'))

    const result = await parseAntigravity()
    expect(result).toHaveLength(0)
  })

  it('falls back to entry modelId over session meta', async () => {
    const dir = join(tempHome, '.config', 'antigravity-cache', 'sessions')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'session_meta', modelId: 'gpt-4o' }),
      JSON.stringify({
        type: 'usage',
        sessionId: 'ses-1',
        timestamp: 1700000000000,
        modelId: 'claude-sonnet-4',
        input: 10,
        output: 5,
      }),
    ]
    writeFileSync(join(dir, 'session.jsonl'), lines.join('\n'))

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
  })
})
