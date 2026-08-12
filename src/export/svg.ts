import { formatHumanReadableNumber } from '@/render/utils.js'
import { computeAxisLabels, computeSegmentWidths } from './chart.js'
import { ChartLegendItem, ChartModel } from './types.js'

const SVG_WIDTH = 1000
const PADDING = 32
const CONTENT_X = PADDING
const CONTENT_WIDTH = SVG_WIDTH - PADDING * 2
const DATE_LABEL_WIDTH = 120
const BAR_X = CONTENT_X + DATE_LABEL_WIDTH
const BAR_WIDTH = CONTENT_WIDTH - DATE_LABEL_WIDTH
const ROW_HEIGHT = 26
const BAR_HEIGHT = 18
const TITLE_HEIGHT = 44
const AXIS_HEIGHT = 26
const LEGEND_ROW_HEIGHT = 22
const BLOCK_GAP = 40
const FONT =
  "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"

export function renderChartToSvg(model: ChartModel): string {
  return renderDashboardToSvg([model])
}

export function renderDashboardToSvg(models: ChartModel[]): string {
  const blocks = models.map(renderBlock)
  const totalHeight =
    PADDING * 2 +
    blocks.reduce((sum, block) => sum + block.height, 0) +
    BLOCK_GAP * Math.max(0, blocks.length - 1)

  let y = PADDING
  const body: string[] = []
  for (const block of blocks) {
    body.push(`<g transform="translate(0 ${y})">\n${block.svg}\n</g>`)
    y += block.height + BLOCK_GAP
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${totalHeight}" viewBox="0 0 ${SVG_WIDTH} ${totalHeight}">
  <rect width="100%" height="100%" fill="#ffffff"/>
${body.join('\n')}
</svg>`
}

function renderBlock(model: ChartModel): { svg: string; height: number } {
  const parts: string[] = []
  let y = 0

  parts.push(
    `<text x="${CONTENT_X}" y="${y + 24}" font-size="20" font-weight="700" fill="#111827" font-family="${FONT}">${escapeXml(model.title)}</text>`
  )
  y += TITLE_HEIGHT

  for (const row of model.rows) {
    const rowY = y
    const segments = computeSegmentWidths(row.total, row.segments, BAR_WIDTH)

    parts.push(
      `<text x="${CONTENT_X}" y="${rowY + 13}" font-size="12" fill="#6b7280" font-family="${FONT}">${escapeXml(row.key)}</text>`
    )

    let x = BAR_X
    for (const segment of segments) {
      const hex = model.idToHex.get(segment.id) ?? '#9ca3af'
      parts.push(
        `<rect x="${x}" y="${rowY}" width="${segment.width}" height="${BAR_HEIGHT}" rx="2" fill="${hex}"/>`
      )

      if (segment.width >= 36) {
        const percent = `${Math.round((segment.value / row.total) * 100)}%`
        const textX = x + segment.width / 2
        parts.push(
          `<text x="${textX}" y="${rowY + 13}" font-size="10" text-anchor="middle" fill="${textColorFor(hex)}" font-family="${FONT}">${percent}</text>`
        )
      }

      x += segment.width
    }

    y += ROW_HEIGHT
  }

  parts.push(
    `<line x1="${BAR_X}" y1="${y}" x2="${BAR_X + BAR_WIDTH}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`
  )

  const axisLabels = computeAxisLabels(
    model.maxTotal,
    BAR_WIDTH,
    model.valueUnit
  )
  for (const label of axisLabels) {
    const textX = BAR_X + label.pos
    let anchor = 'middle'
    if (label.pos <= 4) {
      anchor = 'start'
    } else if (label.pos + label.text.length >= BAR_WIDTH - 4) {
      anchor = 'end'
    }
    parts.push(
      `<text x="${textX}" y="${y + 16}" font-size="11" fill="#9ca3af" text-anchor="${anchor}" font-family="${FONT}">${escapeXml(label.text)}</text>`
    )
  }
  y += AXIS_HEIGHT

  const legendRows = computeLegendRows(model)
  for (const row of legendRows) {
    parts.push(renderLegendRow(model, row, y + 15))
    y += LEGEND_ROW_HEIGHT
  }

  return { svg: parts.join('\n'), height: y }
}

function computeLegendRows(model: ChartModel): ChartLegendItem[][] {
  const rows: ChartLegendItem[][] = []
  let current: ChartLegendItem[] = []
  let currentWidth = 0

  function addItem(item: ChartLegendItem, width: number) {
    if (current.length > 0 && currentWidth + ITEM_GAP + width > CONTENT_WIDTH) {
      rows.push(current)
      current = []
      currentWidth = 0
    }
    current.push(item)
    currentWidth += currentWidth === 0 ? width : ITEM_GAP + width
  }

  for (const item of model.legend) {
    addItem(item, legendItemWidth(model, item))
  }

  const grandTotal = {
    id: undefined,
    name: 'Total',
    value: model.grandTotal,
  }
  addItem(grandTotal, legendItemWidth(model, grandTotal))

  if (current.length > 0) {
    rows.push(current)
  }

  return rows
}

const ITEM_GAP = 20
const SWATCH_WIDTH = 12
const SWATCH_GAP = 6
const CHAR_WIDTH = 6.6

function legendItemWidth(model: ChartModel, item: ChartLegendItem): number {
  const totalText = `(${formatHumanReadableNumber(
    item.value.toFixed(2),
    model.valueUnit
  )})`
  return (
    SWATCH_WIDTH +
    SWATCH_GAP +
    item.name.length * CHAR_WIDTH +
    totalText.length * CHAR_WIDTH +
    4
  )
}

function renderLegendRow(
  model: ChartModel,
  items: ChartLegendItem[],
  y: number
): string {
  let x = CONTENT_X
  const parts: string[] = []

  for (const item of items) {
    const totalText = formatHumanReadableNumber(
      item.value.toFixed(2),
      model.valueUnit
    )

    if (item.color) {
      parts.push(
        `<rect x="${x}" y="${y - 9}" width="${SWATCH_WIDTH}" height="${SWATCH_WIDTH}" rx="2" fill="${item.color}"/>`
      )
      x += SWATCH_WIDTH + SWATCH_GAP
      parts.push(
        `<text x="${x}" y="${y}" font-size="11" fill="#374151" font-family="${FONT}">${escapeXml(item.name)}</text>`
      )
      x += item.name.length * CHAR_WIDTH
    } else {
      parts.push(`<circle cx="${x + 6}" cy="${y - 3}" r="6" fill="#111827"/>`)
      x += SWATCH_WIDTH + SWATCH_GAP
      parts.push(
        `<text x="${x}" y="${y}" font-size="11" fill="#111827" font-weight="600" font-family="${FONT}">${escapeXml(item.name)}</text>`
      )
      x += item.name.length * CHAR_WIDTH
    }

    const dimText = `(${totalText})`
    parts.push(
      `<text x="${x}" y="${y}" font-size="11" fill="#9ca3af" font-family="${FONT}">${escapeXml(dimText)}</text>`
    )
    x += dimText.length * CHAR_WIDTH + ITEM_GAP
  }

  return parts.join('\n')
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function textColorFor(hex: string): string {
  const h = hex.replace(/^#/, '')
  const r = Number.parseInt(h.slice(0, 2), 16) / 255
  const g = Number.parseInt(h.slice(2, 4), 16) / 255
  const b = Number.parseInt(h.slice(4, 6), 16) / 255
  function linearize(c: number) {
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  return luminance > 0.179 ? '#111827' : '#ffffff'
}
