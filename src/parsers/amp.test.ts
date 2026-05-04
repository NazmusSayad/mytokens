import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseAmp } from './amp.js'

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

describe('parseAmp', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseAmp()
    expect(result).toEqual([])
  })

  it('parses thread with message usage', async () => {
    const dir = join(tempHome, '.local', 'share', 'amp', 'threads')
    mkdirSync(dir, { recursive: true })
    const thread = {
      id: 'T-1',
      created: 1700000000000,
      messages: [
        {
          role: 'assistant',
          messageId: 1,
          usage: {
            model: 'claude-sonnet-4',
            inputTokens: 100,
            outputTokens: 50,
            cacheReadInputTokens: 20,
            cacheCreationInputTokens: 5,
            credits: 0.01,
          },
        },
      ],
    }
    writeFileSync(join(dir, 'T-1.json'), JSON.stringify(thread))

    const result = await parseAmp()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('amp')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
  })

  it('merges ledger records with matching message records', async () => {
    const dir = join(tempHome, '.local', 'share', 'amp', 'threads')
    mkdirSync(dir, { recursive: true })
    const thread = {
      id: 'T-1',
      created: 1700000000000,
      messages: [
        {
          role: 'assistant',
          messageId: 1,
          usage: {
            model: 'gpt-4o',
            inputTokens: 100,
            outputTokens: 50,
            cacheReadInputTokens: 20,
            cacheCreationInputTokens: 5,
            credits: 0.01,
          },
        },
      ],
      usageLedger: {
        events: [
          {
            timestamp: '2024-12-01T10:00:00Z',
            model: 'gpt-4o',
            credits: 0.015,
            tokens: {
              input: 100,
              output: 50,
              cacheReadInputTokens: 20,
              cacheCreationInputTokens: 5,
            },
            toMessageId: 1,
          },
        ],
      },
    }
    writeFileSync(join(dir, 'T-1.json'), JSON.stringify(thread))

    const result = await parseAmp()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].tokens.input).toBe(100)
  })

  it('skips non-T- prefixed files', async () => {
    const dir = join(tempHome, '.local', 'share', 'amp', 'threads')
    mkdirSync(dir, { recursive: true })
    const thread = {
      id: 'other',
      messages: [
        {
          role: 'assistant',
          usage: { model: 'gpt-4o', inputTokens: 10, outputTokens: 5 },
        },
      ],
    }
    writeFileSync(join(dir, 'other.json'), JSON.stringify(thread))

    const result = await parseAmp()
    expect(result).toHaveLength(0)
  })
})
