import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCodex } from './codex.js'

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

describe('parseCodex', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no codex usage file exists', async () => {
    const result = await parseCodex()
    expect(result).toEqual([])
  })

  it('parses headless usage line', async () => {
    const codexDir = join(tempHome, '.codex')
    mkdirSync(codexDir, { recursive: true })
    const content = `{"type":"turn.completed","model":"gpt-4o-mini","usage":{"input_tokens":120,"cached_input_tokens":20,"output_tokens":30}}`
    writeFileSync(join(codexDir, 'usage.jsonl'), content)

    const result = await parseCodex()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-4o-mini')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(30)
    expect(result[0].tokens.cacheInput).toBe(20)
  })

  it('computes token deltas from total and last usage', async () => {
    const codexDir = join(tempHome, '.codex')
    mkdirSync(codexDir, { recursive: true })
    const lines = [
      `{"type":"turn_context","payload":{"model":"gpt-5.2"}}`,
      `{"timestamp":"2026-01-01T00:00:01Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5},"last_token_usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5}}}}`,
      `{"timestamp":"2026-01-01T00:00:02Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":110,"cached_input_tokens":22,"output_tokens":33,"reasoning_output_tokens":6},"last_token_usage":{"input_tokens":10,"cached_input_tokens":2,"output_tokens":3,"reasoning_output_tokens":1}}}}`,
    ]
    writeFileSync(join(codexDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseCodex()
    expect(result).toHaveLength(2)
    expect(result[0].tokens.input).toBe(80)
    expect(result[0].tokens.output).toBe(30)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.reasoning).toBe(5)
    expect(result[1].tokens.input).toBe(8)
    expect(result[1].tokens.output).toBe(3)
    expect(result[1].tokens.cacheInput).toBe(2)
    expect(result[1].tokens.reasoning).toBe(1)
  })

  it('skips stale regression totals', async () => {
    const codexDir = join(tempHome, '.codex')
    mkdirSync(codexDir, { recursive: true })
    const lines = [
      `{"type":"turn_context","payload":{"model":"gpt-5.2"}}`,
      `{"timestamp":"2026-01-01T00:00:01Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5},"last_token_usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5}}}}`,
      `{"timestamp":"2026-01-01T00:00:02Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":109,"cached_input_tokens":21,"output_tokens":32,"reasoning_output_tokens":6},"last_token_usage":{"input_tokens":9,"cached_input_tokens":1,"output_tokens":2,"reasoning_output_tokens":0}}}}`,
      `{"timestamp":"2026-01-01T00:00:03Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":119,"cached_input_tokens":23,"output_tokens":35,"reasoning_output_tokens":6},"last_token_usage":{"input_tokens":10,"cached_input_tokens":2,"output_tokens":3,"reasoning_output_tokens":0}}}}`,
    ]
    writeFileSync(join(codexDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseCodex()
    expect(result).toHaveLength(3)
    // Stale snapshot skipped, so third message uses line4 last_usage
    expect(result[2].tokens.input).toBe(8)
    expect(result[2].tokens.output).toBe(3)
  })

  it('extracts workspace from session_meta cwd', async () => {
    const codexDir = join(tempHome, '.codex')
    mkdirSync(codexDir, { recursive: true })
    const lines = [
      `{"type":"session_meta","payload":{"source":"chat","model_provider":"openai","agent_nickname":"builder","cwd":"/Users/alice/codex-demo"}}`,
      `{"type":"turn_context","payload":{"model":"gpt-5.4"}}`,
      `{"timestamp":"2026-01-01T00:00:01Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":10,"cached_input_tokens":2,"output_tokens":3},"last_token_usage":{"input_tokens":10,"cached_input_tokens":2,"output_tokens":3}}}}`,
    ]
    writeFileSync(join(codexDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseCodex()
    expect(result).toHaveLength(1)
    expect(result[0].project?.path).toBe('/Users/alice/codex-demo')
  })
})
