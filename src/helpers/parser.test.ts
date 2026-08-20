import type { UsageDataMessage } from '@/core/types.js'
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filePredatesRange, filterMessagesByDateRange } from './parser.js'

function messageAt(timestamp: number): UsageDataMessage {
  return {
    source: 'test',
    agent: 'default',
    type: 'assistant',
    date: new Date(timestamp),
    model: { id: 'gpt-4o', provider: 'openai' },
    tokens: {
      input: 1,
      output: 1,
      reasoning: 0,
      cacheInput: 0,
      cacheOutput: 0,
    },
  }
}

const day = 24 * 60 * 60 * 1000
const jan1 = new Date('2024-01-01T00:00:00Z').getTime()
const messages = [
  messageAt(jan1),
  messageAt(jan1 + day),
  messageAt(jan1 + 2 * day),
]

describe('filterMessagesByDateRange', () => {
  it('returns input unchanged when range is undefined', () => {
    expect(filterMessagesByDateRange(messages)).toBe(messages)
  })

  it('returns input unchanged when both bounds are null', () => {
    expect(filterMessagesByDateRange(messages, { from: null, to: null })).toBe(
      messages
    )
  })

  it('keeps messages on or after the from bound', () => {
    const result = filterMessagesByDateRange(messages, {
      from: new Date(jan1 + day),
      to: null,
    })
    expect(result).toHaveLength(2)
    expect(result[0].date.getTime()).toBe(jan1 + day)
  })

  it('keeps messages on or before the to bound', () => {
    const result = filterMessagesByDateRange(messages, {
      from: null,
      to: new Date(jan1 + day),
    })
    expect(result).toHaveLength(2)
    expect(result[1].date.getTime()).toBe(jan1 + day)
  })

  it('applies both bounds inclusively', () => {
    const result = filterMessagesByDateRange(messages, {
      from: new Date(jan1),
      to: new Date(jan1 + day),
    })
    expect(result).toHaveLength(2)
  })

  it('returns empty array when everything is out of range', () => {
    const result = filterMessagesByDateRange(messages, {
      from: new Date(jan1 + 10 * day),
      to: new Date(jan1 + 20 * day),
    })
    expect(result).toEqual([])
  })
})

describe('filePredatesRange', () => {
  function createFileWithMtime(mtime: Date): string {
    const dir = mkdtempSync(join(tmpdir(), 'range-'))
    const path = join(dir, 'log.jsonl')
    writeFileSync(path, '{}')
    utimesSync(path, mtime, mtime)
    return path
  }

  it('returns false when no range is given', () => {
    const path = createFileWithMtime(new Date(0))
    expect(filePredatesRange(path)).toBe(false)
  })

  it('returns false when range has no from bound', () => {
    const path = createFileWithMtime(new Date(0))
    expect(filePredatesRange(path, { from: null, to: null })).toBe(false)
  })

  it('returns true when file mtime is before the from bound', () => {
    const path = createFileWithMtime(new Date('2024-01-01T00:00:00Z'))
    expect(
      filePredatesRange(path, {
        from: new Date('2024-06-01T00:00:00Z'),
        to: null,
      })
    ).toBe(true)
  })

  it('returns false when file mtime is after the from bound', () => {
    const path = createFileWithMtime(new Date('2024-06-15T00:00:00Z'))
    expect(
      filePredatesRange(path, {
        from: new Date('2024-06-01T00:00:00Z'),
        to: null,
      })
    ).toBe(false)
  })
})
