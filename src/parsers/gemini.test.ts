import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseGemini } from './gemini.js'

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

describe('parseGemini', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no gemini files exist', async () => {
    const result = await parseGemini()
    expect(result).toEqual([])
  })

  it('parses legacy structured session JSON', async () => {
    const geminiDir = join(tempHome, '.gemini', 'tmp', 'abc123')
    mkdirSync(geminiDir, { recursive: true })
    const json = JSON.stringify({
      sessionId: 'ses_123',
      projectHash: 'abc123',
      startTime: '2025-06-15T12:00:00Z',
      lastUpdated: '2025-06-15T12:30:00Z',
      messages: [
        {
          id: 'msg_1',
          timestamp: '2025-06-15T12:00:00Z',
          type: 'user',
        },
        {
          id: 'msg_2',
          timestamp: '2025-06-15T12:01:00Z',
          type: 'gemini',
          model: 'gemini-2.0-flash',
          tokens: {
            input: 15,
            output: 20,
            cached: 5,
            thoughts: 2,
            tool: 0,
            total: 37,
          },
        },
      ],
    })
    writeFileSync(join(geminiDir, 'session-test.json'), json)

    const result = await parseGemini()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gemini-2.0-flash')
    expect(result[0].tokens.input).toBe(10)
    expect(result[0].tokens.output).toBe(20)
    expect(result[0].tokens.cacheInput).toBe(5)
  })

  it('parses headless JSONL stream', async () => {
    const geminiDir = join(tempHome, '.gemini', 'tmp', 'abc123')
    mkdirSync(geminiDir, { recursive: true })
    const lines = [
      `{"type":"init","model":"gemini-2.5-pro","session_id":"session-1"}`,
      `{"type":"result","stats":{"input_tokens":10,"output_tokens":20}}`,
    ]
    writeFileSync(join(geminiDir, 'stream.jsonl'), lines.join('\n'))

    const result = await parseGemini()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gemini-2.5-pro')
    expect(result[0].tokens.input).toBe(10)
    expect(result[0].tokens.output).toBe(20)
  })

  it('normalizes cached input in headless JSONL', async () => {
    const geminiDir = join(tempHome, '.gemini', 'tmp', 'abc123')
    mkdirSync(geminiDir, { recursive: true })
    const lines = [
      `{"type":"init","model":"gemini-2.5-pro","session_id":"session-1"}`,
      `{"type":"result","stats":{"input_tokens":12,"output_tokens":20,"cached_tokens":5,"thoughts_tokens":3}}`,
    ]
    writeFileSync(join(geminiDir, 'stream.jsonl'), lines.join('\n'))

    const result = await parseGemini()
    expect(result).toHaveLength(1)
    expect(result[0].tokens.input).toBe(7)
    expect(result[0].tokens.output).toBe(20)
    expect(result[0].tokens.cacheInput).toBe(5)
    expect(result[0].tokens.reasoning).toBe(3)
  })

  it('rejects files outside valid gemini path', async () => {
    const geminiDir = join(tempHome, '.gemini', 'tmp', 'abc123', 'backup')
    mkdirSync(geminiDir, { recursive: true })
    const json = JSON.stringify({
      sessionId: 'ses_123',
      projectHash: 'abc123',
      startTime: '2025-06-15T12:00:00Z',
      lastUpdated: '2025-06-15T12:30:00Z',
      messages: [
        {
          id: 'msg_2',
          type: 'gemini',
          model: 'gemini-2.0-flash',
          tokens: { input: 10, output: 20 },
        },
      ],
    })
    writeFileSync(join(geminiDir, 'nested.json'), json)

    const result = await parseGemini()
    expect(result).toHaveLength(0)
  })

  it('parses modern chats directory JSON', async () => {
    const chatsDir = join(tempHome, '.gemini', 'tmp', '123', 'chats')
    mkdirSync(chatsDir, { recursive: true })
    const json = JSON.stringify({
      sessionId: 'ses_123',
      projectHash: 'abc123',
      startTime: '2025-06-15T12:00:00Z',
      lastUpdated: '2025-06-15T12:30:00Z',
      messages: [
        {
          id: 'msg_2',
          timestamp: '2025-06-15T12:01:00Z',
          type: 'gemini',
          model: 'gemini-2.0-flash',
          tokens: { input: 10, output: 20 },
        },
      ],
    })
    writeFileSync(join(chatsDir, 'uuid-file.json'), json)

    const result = await parseGemini()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gemini-2.0-flash')
    expect(result[0].tokens.input).toBe(10)
    expect(result[0].tokens.output).toBe(20)
  })
})
