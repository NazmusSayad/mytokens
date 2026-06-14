import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseSynthetic } from './synthetic.js'

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

describe('parseSynthetic', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no db exists', async () => {
    const result = await parseSynthetic()
    expect(result).toEqual([])
  })

  it('parses messages table', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'octofriend')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'octofriend.db')
    const db = new DatabaseSync(dbPath)
    db.exec(
      `CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_tokens INTEGER,
        cache_write_tokens INTEGER,
        reasoning_tokens INTEGER,
        cost REAL,
        timestamp INTEGER,
        session_id TEXT,
        provider TEXT
      );
      INSERT INTO messages (id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, timestamp, provider)
      VALUES ('msg-1', 'gpt-4o', 100, 50, 20, 5, 2, 1700000000, 'openai');`
    )
    db.close()

    const result = await parseSynthetic()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('synthetic')
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].model.provider).toBe('openai')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(5)
    expect(result[0].tokens.reasoning).toBe(2)
  })

  it('falls back to token_usage table', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'octofriend')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'octofriend.db')
    const db = new DatabaseSync(dbPath)
    db.exec(
      `CREATE TABLE token_usage (
        id TEXT PRIMARY KEY,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        timestamp INTEGER,
        session_id TEXT
      );
      INSERT INTO token_usage (id, model, input_tokens, output_tokens, timestamp)
      VALUES ('tu-1', 'gpt-4o', 10, 5, 1700000000);`
    )
    db.close()

    const result = await parseSynthetic()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('synthetic')
    expect(result[0].tokens.input).toBe(10)
    expect(result[0].tokens.output).toBe(5)
  })

  it('normalizes hf: model prefix', async () => {
    const dbDir = join(tempHome, '.local', 'share', 'octofriend')
    mkdirSync(dbDir, { recursive: true })
    const dbPath = join(dbDir, 'octofriend.db')
    const db = new DatabaseSync(dbPath)
    db.exec(
      `CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_tokens INTEGER,
        cache_write_tokens INTEGER,
        reasoning_tokens INTEGER,
        cost REAL,
        timestamp INTEGER,
        session_id TEXT,
        provider TEXT
      );
      INSERT INTO messages (id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, timestamp, provider)
      VALUES ('msg-1', 'HF:meta-llama/Llama-2-7b', 10, 5, 0, 0, 0, 1700000000, 'hf');`
    )
    db.close()

    const result = await parseSynthetic()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('llama-2-7b')
  })
})
