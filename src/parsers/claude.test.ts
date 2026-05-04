import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseClaude } from './claude.js'

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

describe('parseClaude', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no claude usage file exists', async () => {
    const result = await parseClaude()
    expect(result).toEqual([])
  })

  it('parses a single assistant message', async () => {
    const claudeDir = join(tempHome, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    const content = `{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}`
    writeFileSync(join(claudeDir, 'usage.jsonl'), content)

    const result = await parseClaude()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('claude')
    expect(result[0].model.id).toBe('claude-3-5-sonnet')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(0)
    expect(result[0].tokens.cacheOutput).toBe(0)
    expect(result[0].type).toBe('assistant')
  })

  it('deduplicates streaming duplicates with per-field max', async () => {
    const claudeDir = join(tempHome, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    const lines = [
      `{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":10,"output_tokens":31}}}`,
      `{"type":"assistant","timestamp":"2024-12-01T10:00:00.100Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":10,"output_tokens":31}}}`,
      `{"type":"assistant","timestamp":"2024-12-01T10:00:00.200Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":10,"output_tokens":300}}}`,
    ]
    writeFileSync(join(claudeDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseClaude()
    expect(result).toHaveLength(1)
    expect(result[0].tokens.output).toBe(300)
    expect(result[0].tokens.input).toBe(10)
  })

  it('detects workspace from project path', async () => {
    const projectDir = join(tempHome, '.claude', 'projects', 'myproject')
    mkdirSync(projectDir, { recursive: true })
    const content = `{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","message":{"model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}`
    writeFileSync(join(projectDir, 'session.jsonl'), content)

    const result = await parseClaude()
    expect(result).toHaveLength(1)
    expect(result[0].project).toBeDefined()
    expect(result[0].project?.path).toBe('myproject')
  })

  it('prefers cwd over encoded project directory name', async () => {
    const projectDir = join(tempHome, '.claude', 'projects', 'C--Users-test-Desktop')
    mkdirSync(projectDir, { recursive: true })
    const content = `{"type":"assistant","timestamp":"2024-12-01T10:00:00.000Z","cwd":"C:\\\\Users\\\\test\\\\Desktop","message":{"model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}`
    writeFileSync(join(projectDir, 'session.jsonl'), content)

    const result = await parseClaude()
    expect(result).toHaveLength(1)
    expect(result[0].project).toBeDefined()
    expect(result[0].project?.path).toBe('C:/Users/test/Desktop')
    expect(result[0].project?.name).toBe('Desktop')
  })

  it('skips user messages and processes only assistant', async () => {
    const claudeDir = join(tempHome, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    const lines = [
      `{"type":"user","timestamp":"2024-12-01T10:00:00.000Z","message":{"content":"Hello"}}`,
      `{"type":"assistant","timestamp":"2024-12-01T10:00:01.000Z","requestId":"req_001","message":{"id":"msg_001","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"output_tokens":50}}}`,
    ]
    writeFileSync(join(claudeDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseClaude()
    expect(result).toHaveLength(1)
    expect(result[0].tokens.input).toBe(100)
  })

  it('parses headless stream events', async () => {
    const claudeDir = join(tempHome, '.claude')
    mkdirSync(claudeDir, { recursive: true })
    const lines = [
      `{"type":"message_start","timestamp":"2025-01-01T00:00:00Z","message":{"id":"msg_1","model":"claude-3-5-sonnet","usage":{"input_tokens":200,"cache_read_input_tokens":20,"cache_creation_input_tokens":5}}}`,
      `{"type":"message_delta","usage":{"output_tokens":80}}`,
      `{"type":"message_stop"}`,
    ]
    writeFileSync(join(claudeDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseClaude()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('claude-3-5-sonnet')
    expect(result[0].tokens.input).toBe(200)
    expect(result[0].tokens.output).toBe(80)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
  })
})
