import { UsageDataMessage } from '@/core/types.js'
import { describe, expect, it, vi } from 'vitest'
import { renderOverviewToSvg } from './overview-svg.js'
import { computeOverview } from './overview.js'

vi.mock('@/core/price-detector.js', () => ({
  initializePriceDetector: vi.fn().mockResolvedValue({
    getInputPrice: () => 2e-6,
    getOutputPrice: () => 8e-6,
    getCacheInputPrice: () => 0.4e-6,
    getCacheOutputPrice: () => 8e-6,
  }),
}))

function makeMessage(partial: Partial<UsageDataMessage>): UsageDataMessage {
  return {
    source: 'opencode',
    agent: 'default',
    type: 'assistant',
    date: new Date('2026-08-10T10:00:00'),
    model: { id: 'gpt-5', provider: 'openai' },
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheInput: 0,
      cacheOutput: 0,
    },
    project: { name: 'mytokens', path: '/Users/sayad/Desktop/mytokens' },
    ...partial,
  }
}

describe('computeOverview', () => {
  it('aggregates totals, daily series, composition and rankings', async () => {
    const messages = [
      makeMessage({
        source: 'opencode',
        agent: 'build',
        date: new Date('2026-08-10T10:00:00'),
        model: { id: 'gpt-5', provider: 'openai' },
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      }),
      makeMessage({
        source: 'codex',
        agent: 'agent',
        date: new Date('2026-08-10T12:00:00'),
        model: { id: 'claude-4', provider: 'anthropic' },
        tokens: {
          input: 200,
          output: 100,
          reasoning: 0,
          cacheInput: 50,
          cacheOutput: 0,
        },
      }),
      makeMessage({
        source: 'opencode',
        agent: 'default',
        date: new Date('2026-08-11T09:00:00'),
        model: { id: 'gpt-5', provider: 'openai' },
        tokens: {
          input: 300,
          output: 0,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      }),
    ]

    const overview = await computeOverview(messages, {
      dateStart: new Date('2026-08-10'),
      dateEnd: new Date('2026-08-12'),
    })

    expect(overview.totalTokens).toBe(2150)
    expect(overview.totalMessages).toBe(3)
    expect(overview.activeDays).toBe(2)
    expect(overview.totalCost).toBeCloseTo(0.00782, 5)
    expect(overview.topModel).toBe('gpt-5')
    expect(overview.topSource).toBe('opencode')

    expect(overview.daily).toHaveLength(2)
    expect(overview.daily[0]).toMatchObject({ label: '08/10', total: 1850 })
    expect(overview.daily[1]).toMatchObject({ label: '08/11', total: 300 })

    expect(overview.composition).toEqual([
      { id: 'input', name: 'Input', value: 1500, color: '#6366f1' },
      { id: 'output', name: 'Output', value: 600, color: '#8b5cf6' },
      { id: 'reasoning', name: 'Reasoning', value: 0, color: '#f59e0b' },
      { id: 'cache', name: 'Cache', value: 50, color: '#10b981' },
    ])

    expect(overview.models[0]).toMatchObject({ name: 'gpt-5', value: 1800 })
    expect(overview.models[1]).toMatchObject({ name: 'claude-4', value: 350 })
    expect(overview.sources[0]).toMatchObject({ name: 'opencode', value: 1800 })
    expect(overview.providers[0]).toMatchObject({ name: 'openai', value: 1800 })
    expect(overview.projects[0]).toMatchObject({
      name: 'mytokens',
      value: 2150,
    })
  })

  it('aggregates trend data by the selected usage period', async () => {
    const messages = [
      makeMessage({
        date: new Date('2026-08-10T10:00:00'),
        tokens: {
          input: 100,
          output: 0,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      }),
      makeMessage({
        date: new Date('2026-08-11T10:00:00'),
        tokens: {
          input: 200,
          output: 0,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      }),
    ]

    const overview = await computeOverview(messages, {
      dateStart: null,
      dateEnd: null,
      usageBy: 'week',
    })

    expect(overview.daily).toEqual([
      expect.objectContaining({ label: '08/10', total: 300 }),
    ])
  })

  it('adds zero-value periods to keep daily trends time-aligned', async () => {
    const messages = [
      makeMessage({
        date: new Date('2026-08-10T10:00:00'),
        tokens: {
          input: 100,
          output: 0,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      }),
      makeMessage({
        date: new Date('2026-08-12T10:00:00'),
        tokens: {
          input: 200,
          output: 0,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      }),
    ]

    const overview = await computeOverview(messages, {
      dateStart: null,
      dateEnd: null,
    })

    expect(overview.activeDays).toBe(2)
    expect(overview.daily).toEqual([
      expect.objectContaining({ label: '08/10', total: 100 }),
      expect.objectContaining({ label: '08/11', total: 0 }),
      expect.objectContaining({ label: '08/12', total: 200 }),
    ])
  })

  it('collapses overflow entries into Others', async () => {
    const messages = Array.from({ length: 9 }, (_, index) =>
      makeMessage({
        project: { name: `project-${index}`, path: `/p/${index}` },
        tokens: {
          input: 100,
          output: 0,
          reasoning: 0,
          cacheInput: 0,
          cacheOutput: 0,
        },
      })
    )

    const overview = await computeOverview(messages, {
      dateStart: null,
      dateEnd: null,
      projects: 8,
    })

    expect(overview.models).toHaveLength(1)
    expect(overview.projects).toHaveLength(9)
    expect(overview.projects[overview.projects.length - 1]).toMatchObject({
      name: 'Others',
      value: 100,
    })
  })

  it('omits projects when the configured count is zero', async () => {
    const overview = await computeOverview(
      [
        makeMessage({
          tokens: {
            input: 100,
            output: 0,
            reasoning: 0,
            cacheInput: 0,
            cacheOutput: 0,
          },
        }),
      ],
      { dateStart: null, dateEnd: null, projects: 0 }
    )

    expect(overview.projects).toEqual([])
  })

  it('throws when there are no messages', async () => {
    await expect(
      computeOverview([], { dateStart: null, dateEnd: null })
    ).rejects.toThrow('No data to export.')
  })
})

describe('renderOverviewToSvg', () => {
  it('produces a single self-contained svg with all sections', () => {
    const overview = {
      dateStart: null,
      dateEnd: null,
      dataStart: new Date('2026-08-10T10:00:00'),
      dataEnd: new Date('2026-08-11T09:00:00'),
      totalTokens: 2150,
      totalCost: 0.00782,
      totalMessages: 3,
      activeDays: 2,
      topModel: 'gpt-5',
      topSource: 'opencode',
      daily: [
        {
          label: '08/10',
          total: 1850,
          input: 1200,
          output: 600,
          reasoning: 0,
          cache: 50,
          cost: 0.006,
        },
        {
          label: '08/11',
          total: 300,
          input: 300,
          output: 0,
          reasoning: 0,
          cache: 0,
          cost: 0.0006,
        },
      ],
      composition: [
        { id: 'input', name: 'Input', value: 1500, color: '#6366f1' },
        { id: 'output', name: 'Output', value: 600, color: '#8b5cf6' },
        { id: 'reasoning', name: 'Reasoning', value: 0, color: '#f59e0b' },
        { id: 'cache', name: 'Cache', value: 50, color: '#10b981' },
      ],
      models: [
        { id: 'gpt-5', name: 'gpt-5', value: 1800, color: '#7b44e9' },
        { id: 'claude-4', name: 'claude-4', value: 350, color: '#64a659' },
      ],
      sources: [
        { id: 'opencode', name: 'opencode', value: 1800, color: '#7b44e9' },
        { id: 'codex', name: 'codex', value: 350, color: '#64a659' },
      ],
      providers: [
        { id: 'openai', name: 'openai', value: 1800, color: '#7b44e9' },
        { id: 'anthropic', name: 'anthropic', value: 350, color: '#64a659' },
      ],
      agents: [
        { id: 'build', name: 'build', value: 1500, color: '#7b44e9' },
        { id: 'agent', name: 'agent', value: 350, color: '#64a659' },
        { id: 'default', name: 'default', value: 300, color: '#9ca3af' },
      ],
      projects: [
        { id: 'mytokens', name: 'mytokens', value: 2150, color: '#7b44e9' },
      ],
    }

    const svg = renderOverviewToSvg(overview)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('AI Coding Usage Overview')
    expect(svg).toContain('TOTAL TOKENS')
    expect(svg).toContain('Usage Over Time')
    expect(svg).toContain('TOKENS')
    expect(svg).toContain('COST')
    expect(svg).toContain('Token Composition')
    expect(svg).toContain('Models')
    expect(svg).toContain('Sources')
    expect(svg).toContain('Providers')
    expect(svg).toContain('Agents')
    expect(svg).toContain('Projects')
    expect(svg).toContain('08/10')
  })

  it('omits the projects section when there are no projects', () => {
    const base = {
      dateStart: null,
      dateEnd: null,
      dataStart: null,
      dataEnd: null,
      totalTokens: 0,
      totalCost: 0,
      totalMessages: 0,
      activeDays: 0,
      topModel: '—',
      topSource: '—',
      daily: [],
      composition: [],
      models: [],
      sources: [],
      providers: [],
      agents: [],
    }
    const svg = renderOverviewToSvg({ ...base, projects: [] })

    expect(svg).not.toContain('Top Projects')
  })
})
