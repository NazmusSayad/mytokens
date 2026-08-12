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
const PADDING_LEFT = 36
const PADDING_RIGHT = 36
const PADDING_TOP = 26
const PADDING_BOTTOM = 28
const CONTENT_X = PADDING_LEFT
const CONTENT_WIDTH = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT
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

  let y = PADDING_TOP
  const body: string[] = []
  for (const section of sections) {
    body.push(`<g transform="translate(0 ${y})">\n${section.svg}\n</g>`)
    y += section.height
  }

  const totalHeight = y + PADDING_BOTTOM
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${totalHeight}" viewBox="0 0 ${SVG_WIDTH} ${totalHeight}">
  <rect width="100%" height="100%" fill="${theme.background}"/>
${body.join('\n')}
</svg>`
}

// ─── Header ──────────────────────────────────────────────────────────────────

function renderHeader(model: OverviewSummary, theme: ExportTheme): Section {
  return {
    svg: `<text x="${CONTENT_X}" y="34" font-size="26" font-weight="700" fill="${theme.ink}" font-family="${FONT}">AI Coding Usage Overview</text>
<text x="${CONTENT_X + CONTENT_WIDTH}" y="34" font-size="11" fill="${theme.faint}" text-anchor="end" font-family="${FONT}">${escapeXml(formatRange(model.dataStart, model.dataEnd))}</text>
<line x1="${CONTENT_X}" y1="56" x2="${CONTENT_X + CONTENT_WIDTH}" y2="56" stroke="${theme.border}" stroke-width="1"/>`,
    height: 80,
  }
}

function formatRange(dataStart: Date | null, dataEnd: Date | null): string {
  if (dataStart && dataEnd) {
    if (formatDate(dataStart) === formatDate(dataEnd)) {
      return formatDate(dataStart)
    }
    return `${formatDate(dataStart)} - ${formatDate(dataEnd)}`
  }
  if (dataStart) {
    return `From ${formatDate(dataStart)}`
  }
  if (dataEnd) {
    return `Until ${formatDate(dataEnd)}`
  }
  return ''
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
  return {
    svg: `<g transform="translate(${CONTENT_X} 0)">
${renderActivityChart(daily, theme)}
</g>`,
    height: 264 + SECTION_GAP,
  }
}

function renderActivityChart(
  points: OverviewDailyPoint[],
  theme: ExportTheme
): string {
  const width = CONTENT_WIDTH
  const height = 264
  const plotTop = 44
  const plotBottom = height - 28
  const plotHeight = plotBottom - plotTop
  const plotLeft = 46
  const plotRight = 50
  const plotWidth = width - plotLeft - plotRight
  const gridLines = 4
  const parts: string[] = []

  if (points.length === 0) {
    return `<text x="0" y="15" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Usage Over Time</text>
<text x="${plotLeft}" y="${plotTop + 24}" font-size="12" fill="${theme.faint}" font-family="${FONT}">No data</text>`
  }

  const tokensMax = points.reduce((max, point) => Math.max(max, point.total), 0)
  const costMax = points.reduce((max, point) => Math.max(max, point.cost), 0)
  let tokensYMax = 1
  if (tokensMax > 0) {
    tokensYMax = tokensMax * 1.08
  }
  let costYMax = 1
  if (costMax > 0) {
    costYMax = costMax * 1.08
  }

  parts.push(
    `<text x="0" y="15" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Usage Over Time</text>`,
    `<circle cx="150" cy="10" r="4" fill="${theme.accent}"/>`,
    `<text x="160" y="14" font-size="11" fill="${theme.muted}" font-family="${FONT}">Tokens</text>`,
    `<circle cx="224" cy="10" r="4" fill="${theme.accentAlt}"/>`,
    `<text x="234" y="14" font-size="11" fill="${theme.muted}" font-family="${FONT}">Cost</text>`
  )

  for (let g = 0; g <= gridLines; g++) {
    const fraction = g / gridLines
    const y = plotBottom - fraction * plotHeight
    const tokensLabel = formatHumanReadableNumber(
      Math.round(tokensYMax * fraction),
      'none'
    )
    const costLabel = formatHumanReadableNumber(costYMax * fraction, 'dollar')
    parts.push(
      `<line x1="${plotLeft}" y1="${y}" x2="${plotLeft + plotWidth}" y2="${y}" stroke="${theme.border}" stroke-width="1"/>
<text x="${plotLeft - 6}" y="${y + 4}" font-size="10" fill="${theme.faint}" text-anchor="end" font-family="${FONT}">${escapeXml(tokensLabel)}</text>
<text x="${plotLeft + plotWidth + 6}" y="${y + 4}" font-size="10" fill="${theme.faint}" font-family="${FONT}">${escapeXml(costLabel)}</text>`
    )
  }

  const tokenLinePoints = points.map((point, index) => {
    const x =
      points.length > 1
        ? plotLeft + (index / (points.length - 1)) * plotWidth
        : plotLeft + plotWidth / 2
    const y = plotBottom - Math.max(0, point.total / tokensYMax) * plotHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const costLinePoints = points.map((point, index) => {
    const x =
      points.length > 1
        ? plotLeft + (index / (points.length - 1)) * plotWidth
        : plotLeft + plotWidth / 2
    const y = plotBottom - Math.max(0, point.cost / costYMax) * plotHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const firstX = Number(tokenLinePoints[0].split(',')[0])
  const lastX = Number(
    tokenLinePoints[tokenLinePoints.length - 1].split(',')[0]
  )

  if (points.length === 1) {
    const [tokenX, tokenY] = tokenLinePoints[0].split(',')
    const [, costY] = costLinePoints[0].split(',')
    parts.push(
      `<line x1="${tokenX}" y1="${tokenY}" x2="${tokenX}" y2="${plotBottom}" stroke="${theme.accent}" stroke-width="2"/>`,
      `<circle cx="${tokenX}" cy="${tokenY}" r="3.5" fill="${theme.accent}"/>`,
      `<circle cx="${tokenX}" cy="${costY}" r="3.5" fill="${theme.accentAlt}"/>`
    )
  } else {
    parts.push(
      `<polygon points="${tokenLinePoints.join(' ')} ${lastX},${plotBottom} ${firstX},${plotBottom}" fill="${theme.accent}24"/>`,
      `<polyline points="${tokenLinePoints.join(' ')}" fill="none" stroke="${theme.accent}" stroke-width="2.5"/>`,
      `<polyline points="${costLinePoints.join(' ')}" fill="none" stroke="${theme.accentAlt}" stroke-width="2.5" stroke-dasharray="6 4"/>`
    )
  }

  const longestLabel = points.reduce(
    (longest, point) => Math.max(longest, point.label.length),
    0
  )
  const maxLabels = Math.max(
    2,
    Math.floor(plotWidth / (longestLabel * 6.6 + 18))
  )
  for (const index of pickLabelIndexes(points.length, maxLabels)) {
    const point = points[index]
    const x = Number(tokenLinePoints[index].split(',')[0])
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

  const legend = renderLegendRow(composition, 13, total, theme)
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
    const text = `${slice.name}  ${formatHumanReadableNumber(slice.value, 'none')} (${formatPercent(slice.value, total)})`
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
  const cellGap = 20
  const cellWidth = (CONTENT_WIDTH - cellGap) / 2
  const cellHeight = 224
  const rowGap = 18

  const firstRow: Cell[] = [
    { title: 'Models', items: model.models, unit: 'none' },
    { title: 'Apps', items: model.apps, unit: 'none' },
  ]
  const secondRow: Cell[] = [
    { title: 'Providers', items: model.providers, unit: 'none' },
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
    svg: `<g transform="translate(${CONTENT_X} 0)">
${renderRow(firstRow)}
</g>
<g transform="translate(${CONTENT_X} ${cellHeight + rowGap})">
${renderRow(secondRow)}
</g>`,
    height:
      cellHeight * 2 + rowGap + (model.projects.length > 0 ? SECTION_GAP : 0),
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
    `<text x="0" y="16" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">${escapeXml(cell.title)}</text>`,
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

  parts.push(renderDonutLegend(cell.items, 188, 38, width - 188 - 8, theme))

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

  const visible = items.filter((item) => item.value > 0)
  if (visible.length === 1) {
    return `<path d="${donutRing(cx, cy, outer, inner)}" fill="${visible[0].color}" fill-rule="evenodd"/>`
  }

  let startAngle = 0
  const parts: string[] = []
  for (const item of visible) {
    const sweep = (item.value / total) * 360
    parts.push(
      `<path d="${donutArc(cx, cy, outer, inner, startAngle, startAngle + sweep)}" fill="${item.color}"/>`
    )
    startAngle += sweep
  }
  return parts.join('\n')
}

function donutRing(
  cx: number,
  cy: number,
  outer: number,
  inner: number
): string {
  return `M ${cx - outer} ${cy} A ${outer} ${outer} 0 1 1 ${cx + outer} ${cy} A ${outer} ${outer} 0 1 1 ${cx - outer} ${cy} Z M ${cx - inner} ${cy} A ${inner} ${inner} 0 1 1 ${cx + inner} ${cy} A ${inner} ${inner} 0 1 1 ${cx - inner} ${cy} Z`
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
    const name = truncate(item.name, maxNameChars)
    const value = `${formatHumanReadableNumber(item.value, 'none')} (${formatPercent(item.value, total)})`
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
  const rowHeight = 26
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
    svg: `<text x="${CONTENT_X}" y="14" font-size="16" font-weight="700" fill="${theme.ink}" font-family="${FONT}">Projects</text>
<g transform="translate(0 ${titleHeight})">
${parts.join('\n')}
</g>`,
    height: titleHeight + rows.length * rowHeight + 6,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Section = { svg: string; height: number }

function formatPercent(value: number, total: number): string {
  if (total <= 0) {
    return '0%'
  }
  const percent = (value / total) * 100
  if (percent > 0 && percent < 1) {
    return '<1%'
  }
  return `${Math.round(percent)}%`
}

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
