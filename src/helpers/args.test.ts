import { describe, expect, it } from 'vitest'
import { resolveDateRange } from './args.js'

const day = 24 * 60 * 60 * 1000

function expectedDayAlignedStart(end: Date, daysBack: number): number {
  return new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - daysBack
  ).getTime()
}

describe('resolveDateRange', () => {
  it('returns null range when no options and no defaults', () => {
    const range = resolveDateRange({})
    expect(range.dateStart).toBeNull()
    expect(range.dateEnd).toBeNull()
  })

  it('defaults to lastDays window when nothing is set', () => {
    const before = Date.now()
    const range = resolveDateRange({}, { lastDays: 30 })
    const after = Date.now()

    expect(range.dateEnd).not.toBeNull()
    expect(range.dateStart).not.toBeNull()
    expect(range.dateEnd!.getTime()).toBeGreaterThanOrEqual(before)
    expect(range.dateEnd!.getTime()).toBeLessThanOrEqual(after)
    expect(range.dateStart!.getTime()).toBe(
      expectedDayAlignedStart(range.dateEnd!, 29)
    )
  })

  it('defaults to single day when lastDays is 1', () => {
    const range = resolveDateRange({}, { lastDays: 1 })
    expect(range.dateStart!.getTime()).toBe(
      expectedDayAlignedStart(range.dateEnd!, 0)
    )
  })

  it('explicit from/to bypass the default', () => {
    const range = resolveDateRange(
      { from: '2024-01-01', to: '2024-01-31' },
      { lastDays: 30 }
    )
    expect(range.dateStart).toEqual(new Date('2024-01-01'))
    expect(range.dateEnd).toEqual(new Date('2024-01-31'))
  })

  it('shorthand flags bypass the default', () => {
    const range = resolveDateRange({ today: true }, { lastDays: 30 })
    expect(range.dateEnd!.getTime() - range.dateStart!.getTime()).toBe(day)
  })

  it('--last keeps its own semantics regardless of defaults', () => {
    const range = resolveDateRange({ last: 7 }, { lastDays: 30 })
    expect(range.dateStart!.getTime()).toBe(
      expectedDayAlignedStart(range.dateEnd!, 6)
    )
  })

  it('returns null range when --all is set, bypassing defaults', () => {
    const range = resolveDateRange({ all: true }, { lastDays: 30 })
    expect(range.dateStart).toBeNull()
    expect(range.dateEnd).toBeNull()
  })

  it('still rejects --all combined with other shorthands', () => {
    expect(() =>
      resolveDateRange({ all: true, today: true }, { lastDays: 30 })
    ).toThrow()
  })

  it('still rejects --all combined with --from', () => {
    expect(() =>
      resolveDateRange({ all: true, from: '2024-01-01' }, { lastDays: 30 })
    ).toThrow()
  })

  it('still rejects conflicting shorthands', () => {
    expect(() =>
      resolveDateRange({ today: true, yesterday: true }, { lastDays: 30 })
    ).toThrow()
  })

  it('still rejects --from combined with shorthands', () => {
    expect(() =>
      resolveDateRange({ from: '2024-01-01', today: true }, { lastDays: 30 })
    ).toThrow()
  })
})
