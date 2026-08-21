import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
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

// ─── Protobuf encoding helpers ───────────────────────────────────────────────

function encodeVarint(value: number): number[] {
  const out: number[] = []
  let current = value
  while (true) {
    let byte = current & 0x7f
    current = Math.floor(current / 128)
    if (current !== 0) byte |= 0x80
    out.push(byte)
    if (current === 0) break
  }
  return out
}

function encVarint(field: number, value: number): Uint8Array {
  const key = encodeVarint(field * 8)
  return new Uint8Array([...key, ...encodeVarint(value)])
}

function encLen(field: number, payload: Uint8Array | string): Uint8Array {
  const bytes =
    typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload
  return new Uint8Array([
    ...encodeVarint(field * 8 + 2),
    ...encodeVarint(bytes.length),
    ...bytes,
  ])
}

interface GenRowOptions {
  model?: string
  display?: string
  responseId?: string
  systemPrompt?: number
  newInput?: number
  cacheRead?: number
  output?: number
  thinking?: number
  timestamp?: { seconds: number; nanos?: number }
}

function buildGenMetadataBlob(options: GenRowOptions): Uint8Array {
  const usageParts: Uint8Array[] = []
  if (options.systemPrompt !== undefined)
    usageParts.push(encVarint(1, options.systemPrompt))
  if (options.newInput !== undefined)
    usageParts.push(encVarint(2, options.newInput))
  if (options.cacheRead !== undefined)
    usageParts.push(encVarint(5, options.cacheRead))
  if (options.output !== undefined)
    usageParts.push(encVarint(9, options.output))
  if (options.thinking !== undefined)
    usageParts.push(encVarint(10, options.thinking))
  if (options.responseId !== undefined)
    usageParts.push(encLen(11, options.responseId))

  const chatModelParts: Uint8Array[] = [encLen(4, concat(usageParts))]
  if (options.timestamp) {
    const ts = concat([
      encVarint(1, options.timestamp.seconds),
      ...(options.timestamp.nanos !== undefined
        ? [encVarint(2, options.timestamp.nanos)]
        : []),
    ])
    chatModelParts.push(encLen(9, encLen(4, ts)))
  }
  if (options.model !== undefined)
    chatModelParts.push(encLen(19, options.model))
  if (options.display !== undefined)
    chatModelParts.push(encLen(21, options.display))

  return encLen(1, concat(chatModelParts))
}

function buildTrajectoryBlob(seconds: number): Uint8Array {
  return encLen(2, concat([encVarint(1, seconds), encVarint(2, 0)]))
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function writeConversationDb(
  name: string,
  blobs: Uint8Array[],
  trajectorySeconds?: number
) {
  const dir = join(tempHome, '.gemini', 'antigravity-cli', 'conversations')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  const db = new DatabaseSync(path)
  db.exec(
    'CREATE TABLE gen_metadata (idx integer, data blob, size integer NOT NULL DEFAULT 0);'
  )
  if (trajectorySeconds !== undefined) {
    db.exec('CREATE TABLE trajectory_metadata_blob (id text, data blob);')
    db.prepare(
      'INSERT INTO trajectory_metadata_blob (id, data) VALUES (?, ?)'
    ).run('main', buildTrajectoryBlob(trajectorySeconds))
  }
  const insert = db.prepare(
    'INSERT INTO gen_metadata (idx, data, size) VALUES (?, ?, 0)'
  )
  blobs.forEach((blob, idx) => insert.run(idx, blob))
  db.close()
  return path
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseAntigravity', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no conversations exist', async () => {
    const result = await parseAntigravity()
    expect(result).toEqual([])
  })

  it('parses tokens, model and per-generation timestamp', async () => {
    writeConversationDb(
      'conv-1.db',
      [
        buildGenMetadataBlob({
          model: 'gemini-3-flash',
          responseId: 'resp-1',
          systemPrompt: 1132,
          newInput: 500,
          cacheRead: 16000,
          output: 300,
          thinking: 40,
          timestamp: { seconds: 1787336121, nanos: 250_000_000 },
        }),
      ],
      1780000000
    )

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('antigravity')
    expect(result[0].model.id).toBe('gemini-3-flash')
    expect(result[0].model.provider).toBe('google')
    expect(result[0].tokens.input).toBe(1632)
    expect(result[0].tokens.cacheInput).toBe(16000)
    expect(result[0].tokens.output).toBe(300)
    expect(result[0].tokens.reasoning).toBe(40)
    expect(result[0].date.getTime()).toBe(1787336121250)
  })

  it('falls back to session timestamp when generation has none', async () => {
    writeConversationDb(
      'conv-1.db',
      [
        buildGenMetadataBlob({
          model: 'gemini-3-flash',
          responseId: 'resp-1',
          newInput: 10,
          output: 5,
        }),
      ],
      1780000000
    )

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
    expect(result[0].date.getTime()).toBe(1780000000000)
  })

  it('dedupes repeated response ids', async () => {
    function row() {
      return buildGenMetadataBlob({
        model: 'gemini-3-flash',
        responseId: 'resp-dup',
        newInput: 10,
        output: 5,
      })
    }
    writeConversationDb('conv-1.db', [row(), row()], 1780000000)

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
  })

  it('skips rows with all-zero usage', async () => {
    writeConversationDb(
      'conv-1.db',
      [
        buildGenMetadataBlob({ model: 'gemini-3-flash', responseId: 'zero' }),
        buildGenMetadataBlob({
          model: 'gemini-3-flash',
          responseId: 'real',
          newInput: 10,
          output: 5,
        }),
      ],
      1780000000
    )

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gemini-3-flash')
  })

  it('recovers missing model from display label of sibling rows', async () => {
    writeConversationDb(
      'conv-1.db',
      [
        buildGenMetadataBlob({
          model: 'gemini-3.6-flash',
          display: 'Gemini 3.6 Flash (High)',
          responseId: 'resp-0',
          newInput: 10,
          output: 5,
        }),
        buildGenMetadataBlob({
          display: 'Gemini 3.6 Flash (High)',
          responseId: 'resp-1',
          newInput: 10,
          output: 5,
        }),
      ],
      1780000000
    )

    const result = await parseAntigravity()
    expect(result).toHaveLength(2)
    expect(result[1].model.id).toBe('gemini-3.6-flash')
  })

  it('keeps routing label as raw model id', async () => {
    writeConversationDb(
      'conv-1.db',
      [
        buildGenMetadataBlob({
          model: 'gemini-default',
          responseId: 'resp-0',
          newInput: 10,
          output: 5,
        }),
      ],
      1780000000
    )

    const result = await parseAntigravity()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gemini-default')
  })

  it('parses multiple conversation databases', async () => {
    writeConversationDb(
      'a.db',
      [
        buildGenMetadataBlob({
          model: 'gemini-3-flash',
          responseId: 'r-a',
          newInput: 10,
          output: 5,
        }),
      ],
      1780000000
    )
    writeConversationDb(
      'b.db',
      [
        buildGenMetadataBlob({
          model: 'gemini-3.7-pro',
          responseId: 'r-b',
          newInput: 20,
          output: 7,
        }),
      ],
      1780000100
    )

    const result = await parseAntigravity()
    expect(result).toHaveLength(2)
    expect(result.map((m) => m.model.id).sort()).toEqual([
      'gemini-3-flash',
      'gemini-3.7-pro',
    ])
  })
})
