import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCopilot } from './copilot.js'

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

describe('parseCopilot', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no copilot usage file exists', async () => {
    const result = await parseCopilot()
    expect(result).toEqual([])
  })

  it('parses a chat span', async () => {
    const copilotDir = join(tempHome, '.copilot')
    mkdirSync(copilotDir, { recursive: true })
    const content = `{"type":"span","traceId":"trace-1","spanId":"span-1","name":"chat claude-sonnet-4","startTime":[1775934260,133000000],"endTime":[1775934264,967317833],"attributes":{"gen_ai.operation.name":"chat","gen_ai.request.model":"claude-sonnet-4","gen_ai.response.model":"claude-sonnet-4","gen_ai.conversation.id":"conv-1","gen_ai.usage.input_tokens":19452,"gen_ai.usage.output_tokens":281,"gen_ai.usage.cache_read.input_tokens":123,"gen_ai.usage.reasoning.output_tokens":128,"github.copilot.interaction_id":"interaction-1"}}`
    writeFileSync(join(copilotDir, 'usage.jsonl'), content)

    const result = await parseCopilot()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('copilot')
    expect(result[0].model.id).toBe('claude-sonnet-4')
    expect(result[0].model.provider).toBe('anthropic')
    expect(result[0].tokens.input).toBe(19329)
    expect(result[0].tokens.output).toBe(281)
    expect(result[0].tokens.cacheInput).toBe(123)
    expect(result[0].tokens.reasoning).toBe(128)
  })

  it('ignores non-chat spans', async () => {
    const copilotDir = join(tempHome, '.copilot')
    mkdirSync(copilotDir, { recursive: true })
    const lines = [
      `{"type":"span","traceId":"trace-1","spanId":"tool-1","name":"execute_tool rg","attributes":{"gen_ai.operation.name":"execute_tool","gen_ai.tool.name":"rg"}}`,
      `{"type":"span","traceId":"trace-1","spanId":"invoke-1","name":"invoke_agent","attributes":{"gen_ai.operation.name":"invoke_agent","gen_ai.usage.input_tokens":999,"gen_ai.usage.output_tokens":111}}`,
      `{"type":"span","traceId":"trace-1","spanId":"chat-1","name":"chat gpt-5.4-mini","endTime":[1775934264,967317833],"attributes":{"gen_ai.operation.name":"chat","gen_ai.response.model":"gpt-5.4-mini","gen_ai.usage.input_tokens":10,"gen_ai.usage.output_tokens":5}}`,
    ]
    writeFileSync(join(copilotDir, 'usage.jsonl'), lines.join('\n'))

    const result = await parseCopilot()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-5.4-mini')
    expect(result[0].tokens.input).toBe(10)
    expect(result[0].tokens.output).toBe(5)
  })

  it('normalizes cache read out of input', async () => {
    const copilotDir = join(tempHome, '.copilot')
    mkdirSync(copilotDir, { recursive: true })
    const content = `{"type":"span","traceId":"trace-cache","spanId":"span-cache","name":"chat gpt-5.4","endTime":[1775934264,967317833],"attributes":{"gen_ai.operation.name":"chat","gen_ai.response.model":"gpt-5.4","gen_ai.usage.input_tokens":1000,"gen_ai.usage.output_tokens":20,"gen_ai.usage.cache_read.input_tokens":200,"gen_ai.usage.cache_write.input_tokens":50}}`
    writeFileSync(join(copilotDir, 'usage.jsonl'), content)

    const result = await parseCopilot()
    expect(result).toHaveLength(1)
    expect(result[0].tokens.input).toBe(800)
    expect(result[0].tokens.output).toBe(20)
    expect(result[0].tokens.cacheInput).toBe(200)
    expect(result[0].tokens.cacheOutput).toBe(50)
  })

  it('falls back to trace id and generic provider', async () => {
    const copilotDir = join(tempHome, '.copilot')
    mkdirSync(copilotDir, { recursive: true })
    const content = `{"type":"span","traceId":"trace-fallback","spanId":"span-fallback","name":"chat custom-model","attributes":{"gen_ai.operation.name":"chat","gen_ai.request.model":"custom-model","gen_ai.usage.input_tokens":"7","gen_ai.usage.output_tokens":"9"}}`
    writeFileSync(join(copilotDir, 'usage.jsonl'), content)

    const result = await parseCopilot()
    expect(result).toHaveLength(1)
    expect(result[0].model.provider).toBe('github-copilot')
    expect(result[0].tokens.input).toBe(7)
    expect(result[0].tokens.output).toBe(9)
  })
})
