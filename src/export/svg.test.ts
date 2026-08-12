import { RenderDataItem, RenderScreenOptions } from '@/render/types.js'
import { describe, expect, it } from 'vitest'
import { computeAxisLabels, computeChartModel, computeSegmentWidths } from './chart.js'
import { renderChartToSvg, renderDashboardToSvg } from './svg.js'
import { ChartModel } from './types.js'

function makeOptions(): RenderScreenOptions {
  return {
    showBy: 'day',
    screenWidth: 80,
    screenPadding: 1,
    enabledApps: null,
    disabledApps: null,
    enabledModes: null,
    disabledModes: null,
    enabledModels: null,
    disabledModels: null,
    enabledProjects: null,
    disabledProjects: null,
    enabledProviders: null,
    disabledProviders: null,
    dateStart: null,
    dateEnd: null,
  }
}

function makeModel(): ChartModel {
  return {
    title: 'Test & Chart',
    valueUnit: 'none',
    rows: [
      {
        key: '2026/08/10',
        total: 150,
        segments: [
          { id: 'a', value: 100 },
          { id: 'b', value: 50 },
        ],
      },
      { key: '2026/08/11', total: 50, segments: [{ id: 'a', value: 50 }] },
    ],
    ids: ['a', 'b'],
    idToMeta: new Map([
      ['a', { name: 'Model A' }],
      ['b', { name: 'Model & B' }],
    ]),
    idToHex: new Map([
      ['a', '#7b44e9'],
      ['b', '#64a659'],
    ]),
    idToTotal: new Map([
      ['a', 150],
      ['b', 50],
    ]),
    legend: [
      { id: 'a', name: 'Model A', color: '#7b44e9', value: 150 },
      { id: 'b', name: 'Model & B', color: '#64a659', value: 50 },
    ],
    grandTotal: 200,
    maxTotal: 150,
  }
}

describe('computeSegmentWidths', () => {
  it('distributes widths proportional to values', () => {
    const result = computeSegmentWidths(
      100,
      [
        { id: 'a', value: 70 },
        { id: 'b', value: 30 },
      ],
      100
    )

    expect(result).toEqual([
      { id: 'a', value: 70, width: 70 },
      { id: 'b', value: 30, width: 30 },
    ])
  })

  it('gives every non-zero segment at least 1 unit', () => {
    const result = computeSegmentWidths(
      101,
      [
        { id: 'a', value: 100 },
        { id: 'b', value: 1 },
      ],
      10
    )

    expect(result.reduce((sum, s) => sum + s.width, 0)).toBe(10)
    expect(result.every((s) => s.width >= 1)).toBe(true)
  })
})

describe('computeAxisLabels', () => {
  it('starts at 0 and ends at maxTotal', () => {
    const labels = computeAxisLabels(1000, 800, 'none')

    expect(labels[0].text).toBe('0')
    expect(labels[labels.length - 1].text).toBe('1K')
    expect(labels.length).toBeGreaterThanOrEqual(2)
  })

  it('uses dollar unit when requested', () => {
    const labels = computeAxisLabels(2000, 800, 'dollar')
    expect(labels[labels.length - 1].text).toBe('$2K')
  })
})

describe('computeChartModel', () => {
  it('groups items by date and sums values per id', async () => {
    const items: RenderDataItem[] = [
      { id: 'a', name: 'Model A', date: new Date('2026-08-10'), value: 60 },
      { id: 'b', name: 'Model B', date: new Date('2026-08-10'), value: 40 },
      { id: 'a', name: 'Model A', date: new Date('2026-08-11'), value: 30 },
    ]

    const model = await computeChartModel(items, makeOptions(), 'Models', 'none')

    expect(model.rows).toHaveLength(2)
    expect(model.rows[0]).toMatchObject({
      key: '2026/08/10',
      total: 100,
    })
    expect(model.rows[0].segments).toEqual([
      { id: 'a', value: 60 },
      { id: 'b', value: 40 },
    ])
    expect(model.idToTotal.get('a')).toBe(90)
    expect(model.grandTotal).toBe(130)
    expect(model.maxTotal).toBe(100)
    expect(model.legend[0]).toMatchObject({ id: 'a', value: 90 })
  })
})

describe('renderChartToSvg', () => {
  it('produces a self-contained svg document', () => {
    const svg = renderChartToSvg(makeModel())

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('width="1000"')
  })

  it('renders one rect per bar segment with its color', () => {
    const svg = renderChartToSvg(makeModel())

    expect(svg).toContain('fill="#7b44e9"')
    expect(svg).toContain('fill="#64a659"')
  })

  it('includes date labels, title, axis labels and legend totals', () => {
    const svg = renderChartToSvg(makeModel())

    expect(svg).toContain('2026/08/10')
    expect(svg).toContain('2026/08/11')
    expect(svg).toContain('Test &amp; Chart')
    expect(svg).toContain('150')
    expect(svg).toContain('Total')
  })

  it('xml-escapes special characters in names', () => {
    const svg = renderChartToSvg(makeModel())

    expect(svg).toContain('Model &amp; B')
    expect(svg).not.toContain('Test & Chart>')
    expect(svg).not.toContain('Model & B<')
  })
})

describe('renderDashboardToSvg', () => {
  it('stacks multiple screens into one document', () => {
    const first = makeModel()
    const second = { ...makeModel(), title: 'Second Screen' }

    const svg = renderDashboardToSvg([first, second])

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Test &amp; Chart')
    expect(svg).toContain('Second Screen')
  })
})
