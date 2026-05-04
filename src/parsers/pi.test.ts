import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parsePi } from './pi.js'

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

describe('parsePi', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parsePi()
    expect(result).toEqual([])
  })

  it('parses session header and assistant messages', async () => {
    const dir = join(tempHome, '.pi', 'agent', 'sessions')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'session', id: 'ses-1', cwd: '/home/alice/project' }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          model: 'gpt-4o',
          provider: 'openai',
          usage: { input: 100, output: 50, cacheRead: 10, cacheWrite: 5 },
        },
        timestamp: '2024-12-01T10:00:00Z',
      }),
    ]
    writeFileSync(join(dir, 'session.jsonl'), lines.join('\n'))

    const result = await parsePi()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('pi')
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].model.provider).toBe('openai')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(10)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].project?.path).toBe('/home/alice/project')
  })

  it('skips non-assistant messages', async () => {
    const dir = join(tempHome, '.pi', 'agent', 'sessions')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'session', id: 'ses-1' }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'user',
          model: 'gpt-4o',
          provider: 'openai',
          usage: { input: 100, output: 50 },
        },
      }),
    ]
    writeFileSync(join(dir, 'session.jsonl'), lines.join('\n'))

    const result = await parsePi()
    expect(result).toHaveLength(0)
  })

  it('aborts on invalid first line', async () => {
    const dir = join(tempHome, '.pi', 'agent', 'sessions')
    mkdirSync(dir, { recursive: true })
    const lines = [
      JSON.stringify({ type: 'not-session', id: 'ses-1' }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          model: 'gpt-4o',
          provider: 'openai',
          usage: { input: 100, output: 50 },
        },
      }),
    ]
    writeFileSync(join(dir, 'session.jsonl'), lines.join('\n'))

    const result = await parsePi()
    expect(result).toHaveLength(0)
  })
})
