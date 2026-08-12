import { RenderValueUnit } from '@/render/types.js'
import { formatHumanReadableNumber } from '@/render/utils.js'
import {
  OverviewDailyPoint,
  OverviewRankItem,
  OverviewSummary,
  OverviewTokenSlice,
} from './overview.js'
import { DEFAULT_EXPORT_THEME, EXPORT_THEMES } from './themes.js'
import { ExportTheme, ExportThemeId } from './types.js'

const SVG_WIDTH = 1200
const PADDING = 36
const CONTENT_X = PADDING
const CONTENT_WIDTH = SVG_WIDTH - PADDING * 2
const CARD_GAP = 16
const SECTION_GAP = 34
const FONT =
  "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"

export function renderOverviewToSvg(
  model: OverviewSummary,
  themeId: ExportThemeId = DEFAULT_EXPORT_THEME
): string {
  const theme = EXPORT_THEMES[themeId]
  const sections = [
    renderHeader(model, theme),
    renderStatCards(model, theme),
    renderActivitySection(model.daily, theme),
    renderCompositionSection(model.composition, theme),
    renderRankingsSection(model, theme),
  ]
  if (model.projects.length > 0) {
    sections.push(renderProjectsSection(model.projects, theme))
  }

  let y = PADDING
  const body: string[] = []
  for (const section of sections) {
    body.push(`<g transform="translate(0 ${y})">\n${section.svg}\n</g>`)
    y += section.height
  }

  const totalHeight = y
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${totalHeight}" viewBox="0 0 ${SVG_WIDTH} ${totalHeight}">
  <rect width="100%" height="100%" fill="${theme.background}"/>
${body.join('\n')}
</svg>`
}

// ─── Header ──────────────────────────────────────────────────────────────────

function renderHeader(model: OverviewSummary, theme: ExportTheme): Section {
  return {
    svg: `<text x="${CONTENT_X}" y="34" font-size="26" font-weight="700" fill="${theme.ink}" font-family="${FONT}">AI Coding Usage Overview</text>
<text x="${CONTENT_X}" y="56" font-size="13" fill="${theme.muted}" font-family="${FONT}">${escapeXml(formatRange(model.dateStart, model.dateEnd))}</text>
<line x1="${CONTENT_X}" y1="72" x2="${CONTENT_X + CONTENT_WIDTH}" y2="72" stroke="${theme.border}" stroke-width="1"/>`,
    height: 72,
  }
}

function formatRange(dateStart: Date | null, dateEnd: Date | null): string {
  if (dateStart && dateEnd) {
    return `${formatDate(dateStart)} – ${formatDate(dateEnd)}`
  }
  if (dateStart) {
    return `From ${formatDate(dateStart)}`
  }
  if (dateEnd) {
    return `Until ${formatDate(dateEnd)}`
  }
  return 'All time'
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// ─── Stat cards ──────────────────────────────────────────────────────────────

function renderStatCards(model: OverviewSummary, theme: ExportTheme): Section {
  const cards: StatCard[] = [
    {
      label: 'Total Tokens',
      value: formatHumanReadableNumber(model.totalTokens, 'none'),
      sub: `top model ${truncate(model.topModel, 20)}`,
    },
    {
      label: 'Est. Cost',
      value: formatHumanReadableNumber(model.totalCost, 'dollar'),
      sub: 'across filtered range',
    },
    {
      label: 'Messages',
      value: formatHumanReadableNumber(model.totalMessages, 'none'),
      sub: 'assistant messages',
    },
    {
      label: 'Active Days',
      value: String(model.activeDays),
      sub: `top app ${truncate(model.topApp, 20)}`,
    },
  ]

  const cardWidth =
    (CONTENT_WIDTH - CARD_GAP * (cards.length - 1)) / cards.length
  const cardHeight = 88
  const parts: string[] = []

  cards.forEach((card, index) => {
    const x = CONTENT_X + index * (cardWidth + CARD_GAP)
    parts.push(`<rect x="${x}" y="0" width="${cardWidth}" height="${cardHeight}" rx="10" fill="${theme.cardFill}"/>
<text x="${x + 16}" y="26" font-size="11" fill="${theme.muted}" font-family="${FONT}">${escapeXml(card.label.toUpperCase())}</text>
<text x="${x + 16}" y="54" font-size="24" font-weight="700" fill="${theme.ink}" font-family="${FONT}">${escapeXml(card.value)}</text>
<text x="${x + 16}" y="74" font-size="10.5" fill="${theme.faint}" font-family="${FONT}">${escapeXml(card.sub)}</text>`)
  })

  return { svg: parts.join('\n'), height: cardHeight + SECTION_GAP }
}

// ─── Activity (tokens & cost over time) ─────────────────────────────────────

function renderActivitySection(
  daily: OverviewDailyPoint[],
  theme: ExportTheme
): Section {
  const titleHeight = 30
  const chartHeight = 210
  const panelWidth = (CONTENT_WIDTH - 20) / 2

  const tokensSvg = renderAreaPanel(
    'Tokens Over Time',
    daily,
    'none',
    theme.accent,
    panelWidth,
    chartHeight,
    theme
  )
  const costSvg = renderAreaPanel(
    'Cost Over Time',
    daily,
    'dollar',
    theme.accentAlt,
    panelWidth,
    chartHeight,
    theme
  )

  return {
    svg: `<text x="${CONTENT_X}" y="26" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Activity</text>
<g transform="translate(${CONTENT_X} ${titleHeight})">
${tokensSvg}
</g>
<g transform="translate(${CONTENT_X + panelWidth + 20} ${titleHeight})">
${costSvg}
</g>`,
    height: titleHeight + chartHeight + SECTION_GAP,
  }
}

function renderAreaPanel(
  title: string,
  daily: OverviewDailyPoint[],
  unit: RenderValueUnit,
  color: string,
  width: number,
  height: number,
  theme: ExportTheme
): string {
  const chart = renderAreaChart(
    daily,
    unit,
    color,
    width - 60,
    height - 26,
    60,
    theme
  )
  return `<text x="0" y="14" font-size="13" font-weight="600" fill="${theme.ink}" font-family="${FONT}">${escapeXml(title)}</text>
<g transform="translate(0 26)">
${chart}
</g>`
}

function renderAreaChart(
  points: OverviewDailyPoint[],
  unit: RenderValueUnit,
  color: string,
  width: number,
  height: number,
  left: number,
  theme: ExportTheme
): string {
  const plotTop = 8
  const plotBottom = height - 20
  const plotHeight = plotBottom - plotTop
  const plotLeft = left
  const plotWidth = width - left
  const gridLines = 4
  const parts: string[] = []

  if (points.length === 0) {
    return `<text x="${plotLeft}" y="${plotTop + 10}" font-size="12" fill="${theme.faint}" font-family="${FONT}">No data</text>`
  }

  const maxValue = points.reduce((max, point) => Math.max(max, point.total), 0)
  const yMax = maxValue > 0 ? maxValue * 1.08 : 1

  for (let g = 0; g <= gridLines; g++) {
    const fraction = g / gridLines
    const y = plotBottom - fraction * plotHeight
    const label = formatHumanReadableNumber(Math.round(yMax * fraction), unit)
    parts.push(
      `<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + plotWidth}" y2="${y}" stroke="${theme.border}" stroke-width="1"/>
<text x="${plotLeft - 6}" y="${y + 4}" font-size="10" fill="${theme.faint}" text-anchor="end" font-family="${FONT}">${escapeXml(label)}</text>`
    )
  }

  const linePoints = points.map((point, index) => {
    const x =
      points.length > 1
        ? plotLeft + (index / (points.length - 1)) * plotWidth
        : plotLeft + plotWidth / 2
    const y = plotBottom - Math.max(0, point.total / yMax) * plotHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const firstX = Number(linePoints[0].split(',')[0])
  const lastX = Number(linePoints[linePoints.length - 1].split(',')[0])

  parts.push(
    `<polygon points="${linePoints.join(' ')} ${lastX},${plotBottom} ${firstX},${plotBottom}" fill="${color}30"/>`,
    `<polyline points="${linePoints.join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`
  )

  for (const index of pickLabelIndexes(points.length, 4)) {
    const point = points[index]
    const x = Number(linePoints[index].split(',')[0])
    parts.push(
      `<text x="${x}" y="${plotBottom + 16}" font-size="10" fill="${theme.faint}" text-anchor="middle" font-family="${FONT}">${escapeXml(point.label)}</text>`
    )
  }

  return parts.join('\n')
}

function pickLabelIndexes(count: number, maxLabels: number): number[] {
  if (count <= maxLabels) {
    return Array.from({ length: count }, (_, index) => index)
  }
  const indexes: number[] = []
  for (let i = 0; i < maxLabels; i++) {
    indexes.push(Math.round((i / (maxLabels - 1)) * (count - 1)))
  }
  return indexes
}

// ─── Token composition ───────────────────────────────────────────────────────

function renderCompositionSection(
  composition: OverviewTokenSlice[],
  theme: ExportTheme
): Section {
  const titleHeight = 30
  const barHeight = 26
  const legendRowHeight = 24
  const total = composition.reduce((sum, slice) => sum + slice.value, 0)

  let cursor = CONTENT_X
  const barParts: string[] = []
  for (const slice of composition) {
    const width = total > 0 ? (slice.value / total) * CONTENT_WIDTH : 0
    barParts.push(
      `<rect x="${cursor}" y="0" width="${Math.max(0, width - 1)}" height="${barHeight}" fill="${slice.color}"/>`
    )
    cursor += width
  }

  const legend = renderLegendRow(composition, 0, total, theme)
  const legendRows = legend.width > CONTENT_WIDTH ? 2 : 1
  const legendSvg =
    legendRows === 1
      ? legend.svg
      : renderLegendWrapped(composition, total, theme)

  return {
    svg: `<text x="${CONTENT_X}" y="14" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Token Composition</text>
<g transform="translate(0 ${titleHeight})">
${barParts.join('\n')}
</g>
<g transform="translate(${CONTENT_X} ${titleHeight + barHeight + 8})">
${legendSvg}
</g>`,
    height:
      titleHeight + barHeight + 8 + legendRows * legendRowHeight + SECTION_GAP,
  }
}

function renderLegendRow(
  slices: OverviewTokenSlice[] | OverviewRankItem[],
  y: number,
  total: number,
  theme: ExportTheme
): { svg: string; width: number } {
  let x = 0
  const parts: string[] = []
  const gap = 18
  for (const slice of slices) {
    const percent =
      total > 0 ? Math.max(1, Math.round((slice.value / total) * 100)) : 0
    const text = `${slice.name}  ${formatHumanReadableNumber(slice.value, 'none')} (${percent}%)`
    const textWidth = Math.max(1, text.length * 6.6)
    parts.push(
      `<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${slice.color}"/>
<text x="${x + 16}" y="${y}" font-size="11" fill="${theme.muted}" font-family="${FONT}">${escapeXml(text)}</text>`
    )
    x += 16 + textWidth + gap
  }
  return { svg: parts.join('\n'), width: x }
}

function renderLegendWrapped(
  slices: OverviewTokenSlice[] | OverviewRankItem[],
  total: number,
  theme: ExportTheme
): string {
  const mid = Math.ceil(slices.length / 2)
  const first = renderLegendRow(slices.slice(0, mid), 13, total, theme)
  const second = renderLegendRow(slices.slice(mid), 37, total, theme)
  return `${first.svg}\n${second.svg}`
}

// ─── Rankings (donuts) ───────────────────────────────────────────────────────

function renderRankingsSection(
  model: OverviewSummary,
  theme: ExportTheme
): Section {
  const titleHeight = 30
  const cellGap = 20
  const cellWidth = (CONTENT_WIDTH - cellGap) / 2
  const cellHeight = 224
  const rowGap = 18

  const firstRow: Cell[] = [
    { title: 'Top Models', items: model.models, unit: 'none' },
    { title: 'Top Apps', items: model.apps, unit: 'none' },
  ]
  const secondRow: Cell[] = [
    { title: 'Top Providers', items: model.providers, unit: 'none' },
    { title: 'Modes', items: model.modes, unit: 'none' },
  ]

  function renderRow(cells: Cell[]) {
    return cells
      .map((cell, index) => {
        const translateX = index === 0 ? 0 : cellWidth + cellGap
        return `<g transform="translate(${translateX} 0)">\n${renderRankingCell(cell, cellWidth, theme)}\n</g>`
      })
      .join('\n')
  }

  return {
    svg: `<text x="${CONTENT_X}" y="26" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Breakdown</text>
<g transform="translate(${CONTENT_X} ${titleHeight})">
${renderRow(firstRow)}
</g>
<g transform="translate(${CONTENT_X} ${titleHeight + cellHeight + rowGap})">
${renderRow(secondRow)}
</g>`,
    height: titleHeight + cellHeight * 2 + rowGap + SECTION_GAP,
  }
}

type StatCard = { label: string; value: string; sub: string }
type Cell = { title: string; items: OverviewRankItem[]; unit: RenderValueUnit }

function renderRankingCell(
  cell: Cell,
  width: number,
  theme: ExportTheme
): string {
  const cx = 92
  const cy = 116
  const outer = 76
  const inner = 42
  const parts: string[] = [
    `<text x="0" y="16" font-size="13" font-weight="600" fill="${theme.ink}" font-family="${FONT}">${escapeXml(cell.title)}</text>`,
  ]

  if (cell.items.length > 0) {
    const total = cell.items.reduce((sum, item) => sum + item.value, 0)
    parts.push(renderDonut(cell.items, cx, cy, outer, inner))
    parts.push(
      `<text x="${cx}" y="${cy + 5}" font-size="16" font-weight="700" fill="${theme.ink}" text-anchor="middle" font-family="${FONT}">${escapeXml(formatHumanReadableNumber(total, cell.unit))}</text>`,
      `<text x="${cx}" y="${cy + 21}" font-size="9" fill="${theme.faint}" text-anchor="middle" font-family="${FONT}">TOTAL</text>`
    )
  } else {
    parts.push(
      `<text x="${cx}" y="${cy}" font-size="12" fill="${theme.faint}" text-anchor="middle" font-family="${FONT}">No data</text>`
    )
  }

  parts.push(renderDonutLegend(cell.items, 188, 36, width - 188 - 8, theme))

  return parts.join('\n')
}

function renderDonut(
  items: OverviewRankItem[],
  cx: number,
  cy: number,
  outer: number,
  inner: number
): string {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) {
    return ''
  }

  let startAngle = 0
  const parts: string[] = []
  for (const item of items) {
    const sweep = (item.value / total) * 360
    parts.push(
      `<path d="${donutArc(cx, cy, outer, inner, startAngle, startAngle + sweep)}" fill="${item.color}"/>`
    )
    startAngle += sweep
  }
  return parts.join('\n')
}

function donutArc(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle
  const largeArc = sweep > 180 ? 1 : 0
  const outerStart = polar(cx, cy, outer, startAngle)
  const outerEnd = polar(cx, cy, outer, endAngle)
  const innerStart = polar(cx, cy, inner, startAngle)
  const innerEnd = polar(cx, cy, inner, endAngle)
  return `M ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`
}

function polar(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const radians = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function renderDonutLegend(
  items: OverviewRankItem[],
  x: number,
  y: number,
  width: number,
  theme: ExportTheme
): string {
  if (items.length === 0) {
    return ''
  }

  const total = items.reduce((sum, item) => sum + item.value, 0)
  const rowHeight = 23
  const valueTextWidth = 9 * 6.6
  const maxNameChars = Math.max(
    4,
    Math.floor((width - 16 - valueTextWidth) / 6.6)
  )
  const parts: string[] = []

  items.forEach((item, index) => {
    const rowY = y + index * rowHeight
    const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
    const name = truncate(item.name, maxNameChars)
    const value = `${formatHumanReadableNumber(item.value, 'none')} (${percent}%)`
    parts.push(
      `<rect x="${x}" y="${rowY - 9}" width="10" height="10" rx="2" fill="${item.color}"/>
<text x="${x + 16}" y="${rowY}" font-size="11" fill="${theme.muted}" font-family="${FONT}">${escapeXml(name)}</text>
<text x="${x + width}" y="${rowY}" font-size="11" fill="${theme.faint}" text-anchor="end" font-family="${FONT}">${escapeXml(value)}</text>`
    )
  })

  return parts.join('\n')
}

// ─── Top projects (horizontal bars) ──────────────────────────────────────────

function renderProjectsSection(
  projects: OverviewRankItem[],
  theme: ExportTheme
): Section {
  const titleHeight = 30
  const rowHeight = 30
  const barHeight = 16
  const rows = projects.slice(0, 8)
  const maxValue = rows.reduce((max, item) => Math.max(max, item.value), 0)

  const labelWidth = 150
  const valueWidth = 110
  const barWidth = CONTENT_WIDTH - labelWidth - valueWidth
  const parts: string[] = []

  rows.forEach((item, index) => {
    const y = index * rowHeight
    const barLength =
      maxValue > 0 ? Math.max(2, (item.value / maxValue) * barWidth) : 0
    parts.push(
      `<text x="${CONTENT_X}" y="${y + 12}" font-size="12" fill="${theme.muted}" font-family="${FONT}">${escapeXml(truncate(item.name, 22))}</text>`,
      `<rect x="${CONTENT_X + labelWidth}" y="${y + 2}" width="${barLength}" height="${barHeight}" rx="3" fill="${item.color}"/>`,
      `<text x="${CONTENT_X + labelWidth + barWidth + 10}" y="${y + 12}" font-size="12" fill="${theme.ink}" font-weight="600" font-family="${FONT}">${escapeXml(formatHumanReadableNumber(item.value, 'none'))}</text>`
    )
  })

  return {
    svg: `<text x="${CONTENT_X}" y="14" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Top Projects</text>
<g transform="translate(0 ${titleHeight})">
${parts.join('\n')}
</g>`,
    height: titleHeight + rows.length * rowHeight + 6,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Section = { svg: string; height: number }

function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input
  }
  return `${input.slice(0, Math.max(0, maxChars - 1))}…`
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
