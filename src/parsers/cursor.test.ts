import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseCursor } from './cursor.js'

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

describe('parseCursor', () => {
  beforeEach(() => {
    setupTempHome()
  })

  afterEach(() => {
    restoreHome()
  })

  it('returns empty array when no files exist', async () => {
    const result = await parseCursor()
    expect(result).toEqual([])
  })

  it('parses v1 CSV format', async () => {
    const dir = join(tempHome, '.config', 'tokscale', 'cursor-cache')
    mkdirSync(dir, { recursive: true })
    const csv = [
      'Date,Model,Input (cache write),Input (no cache),Cache Read,Output,Total,Cost',
      '2024-12-01T10:00:00Z,gpt-4o,120,100,20,50,190,0.01',
    ].join('\n')
    writeFileSync(join(dir, 'usage.csv'), csv)

    const result = await parseCursor()
    expect(result).toHaveLength(1)
    expect(result[0].app).toBe('cursor')
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
    expect(result[0].tokens.cacheInput).toBe(20)
    expect(result[0].tokens.cacheOutput).toBe(20)
  })

  it('parses v2 CSV format with Kind column', async () => {
    const dir = join(tempHome, '.config', 'tokscale', 'cursor-cache')
    mkdirSync(dir, { recursive: true })
    const csv = [
      'Date,Kind,Model,Input (cache write),Input (no cache),Cache Read,Output,Total,Cost',
      '2024-12-01T10:00:00Z,chat,gpt-4o,120,100,20,50,190,0.01',
    ].join('\n')
    writeFileSync(join(dir, 'usage.csv'), csv)

    const result = await parseCursor()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
  })

  it('parses v3 CSV format with 11+ columns', async () => {
    const dir = join(tempHome, '.config', 'tokscale', 'cursor-cache')
    mkdirSync(dir, { recursive: true })
    const csv = [
      'Date,A,B,Kind,Model,C,Input (cache write),Input (no cache),Cache Read,Output,Total,Cost',
      '2024-12-01T10:00:00Z,x,y,chat,gpt-4o,z,120,100,20,50,190,0.01',
    ].join('\n')
    writeFileSync(join(dir, 'usage.csv'), csv)

    const result = await parseCursor()
    expect(result).toHaveLength(1)
    expect(result[0].model.id).toBe('gpt-4o')
    expect(result[0].tokens.input).toBe(100)
    expect(result[0].tokens.output).toBe(50)
  })

  it('skips rows with invalid date', async () => {
    const dir = join(tempHome, '.config', 'tokscale', 'cursor-cache')
    mkdirSync(dir, { recursive: true })
    const csv = [
      'Date,Model,Input (cache write),Input (no cache),Cache Read,Output,Total,Cost',
      'invalid,gpt-4o,120,100,20,50,190,0.01',
    ].join('\n')
    writeFileSync(join(dir, 'usage.csv'), csv)

    const result = await parseCursor()
    expect(result).toHaveLength(0)
  })
})
