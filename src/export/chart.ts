import { UsageDataMessage } from '@/core/types.js'
import { ColorGenerator } from '@/render/color-generator.js'
import {
  RenderDataItem,
  RenderScreenOptions,
  RenderValueUnit,
} from '@/render/types.js'
import { formatDateKey, formatHumanReadableNumber } from '@/render/utils.js'
import {
  ChartAxisLabel,
  ChartLegendItem,
  ChartModel,
  ChartRow,
  ChartSegment,
} from './types.js'

export function isMessageIgnored(
  message: UsageDataMessage,
  options: RenderScreenOptions
): boolean {
  const { dateStart, dateEnd, enabledApps, disabledApps } = options

  if (dateEnd && message.date.getTime() > dateEnd.getTime()) {
    return true
  }

  if (dateStart && message.date.getTime() < dateStart.getTime()) {
    return true
  }

  if (enabledApps?.length && !enabledApps.includes(message.app)) {
    return true
  }

  if (disabledApps?.length && disabledApps.includes(message.app)) {
    return true
  }

  if (
    options.enabledProviders?.length &&
    !options.enabledProviders.includes(message.model.provider)
  ) {
    return true
  }

  if (
    options.disabledProviders?.length &&
    options.disabledProviders.includes(message.model.provider)
  ) {
    return true
  }

  if (
    options.enabledModels?.length &&
    !options.enabledModels.includes(message.model.id)
  ) {
    return true
  }

  if (
    options.disabledModels?.length &&
    options.disabledModels.includes(message.model.id)
  ) {
    return true
  }

  if (
    options.enabledModes?.length &&
    !options.enabledModes.includes(message.mode)
  ) {
    return true
  }

  if (
    options.disabledModes?.length &&
    options.disabledModes.includes(message.mode)
  ) {
    return true
  }

  if (
    message.project?.name &&
    options.enabledProjects?.length &&
    !options.enabledProjects.includes(message.project.name)
  ) {
    return true
  }

  if (
    message.project?.name &&
    options.disabledProjects?.length &&
    options.disabledProjects.includes(message.project.name)
  ) {
    return true
  }

  return false
}

export async function computeChartModel(
  items: RenderDataItem[],
  options: RenderScreenOptions,
  title: string,
  valueUnit: RenderValueUnit
): Promise<ChartModel> {
  const { showBy } = options

  const grouped = new Map<string, Map<string, number>>()
  const idToMeta = new Map<string, { name: string; color?: string }>()

  for (const item of items) {
    const key = formatDateKey(item.date, showBy)
    if (!grouped.has(key)) {
      grouped.set(key, new Map())
    }
    const bucket = grouped.get(key)!
    bucket.set(item.id, (bucket.get(item.id) ?? 0) + item.value)
    if (!idToMeta.has(item.id)) {
      idToMeta.set(item.id, { name: item.name, color: item.color })
    } else if (item.color && !idToMeta.get(item.id)!.color) {
      idToMeta.get(item.id)!.color = item.color
    }
  }

  const sortedKeys = Array.from(grouped.keys()).sort()

  let maxTotal = 0
  for (const key of sortedKeys) {
    const bucket = grouped.get(key)!
    let total = 0
    for (const v of bucket.values()) {
      total += v
    }
    if (total > maxTotal) {
      maxTotal = total
    }
  }

  const idToTotal = new Map<string, number>()
  for (const key of sortedKeys) {
    const bucket = grouped.get(key)!
    for (const [id, val] of bucket) {
      idToTotal.set(id, (idToTotal.get(id) ?? 0) + val)
    }
  }

  const ids = Array.from(idToMeta.keys()).sort(
    (a, b) => (idToTotal.get(b) ?? 0) - (idToTotal.get(a) ?? 0)
  )

  const colorGenerator = new ColorGenerator()
  const idToHex = new Map<string, string>()
  for (const id of ids) {
    const explicitColor = idToMeta.get(id)?.color
    const hex = explicitColor ?? (await colorGenerator.generate(id))
    idToHex.set(id, hex)
  }

  const rows: ChartRow[] = sortedKeys.map((key) => {
    const bucket = grouped.get(key)!
    const segments: ChartSegment[] = []
    let total = 0
    for (const [id, val] of bucket) {
      if (val > 0) {
        segments.push({ id, value: val })
        total += val
      }
    }
    return { key, total, segments }
  })

  const legend: ChartLegendItem[] = ids.map((id) => ({
    id,
    name: idToMeta.get(id)!.name,
    color: idToHex.get(id),
    value: idToTotal.get(id) ?? 0,
  }))

  const grandTotal = Array.from(idToTotal.values()).reduce((a, b) => a + b, 0)

  return {
    title,
    valueUnit,
    rows,
    ids,
    idToMeta,
    idToHex,
    idToTotal,
    legend,
    grandTotal,
    maxTotal,
  }
}

export function computeSegmentWidths(
  total: number,
  segments: ChartSegment[],
  barWidth: number
): Array<ChartSegment & { width: number }> {
  const targetWidth = Math.max(1, barWidth)
  const portions = segments.map((s) => (s.value / total) * targetWidth)

  let chars = portions.map((p) => Math.max(1, Math.floor(p)))
  let allocated = chars.reduce((a, b) => a + b, 0)

  if (allocated > targetWidth) {
    const scale = targetWidth / allocated
    chars = chars.map((c) => Math.max(1, Math.floor(c * scale)))
    allocated = chars.reduce((a, b) => a + b, 0)
  }

  const remainder = targetWidth - allocated
  const indexed = portions.map((p, i) => ({
    i,
    frac: p - Math.floor(p),
  }))
  indexed.sort((a, b) => b.frac - a.frac)

  for (let r = 0; r < remainder; r++) {
    chars[indexed[r % indexed.length].i]++
  }

  return segments.map((s, i) => ({ ...s, width: chars[i] }))
}

export function computeAxisLabels(
  maxTotal: number,
  chartWidth: number,
  unit: RenderValueUnit
): ChartAxisLabel[] {
  const maxDivisions = Math.max(2, Math.floor(chartWidth / 16))
  let divisions = maxDivisions

  const labels: ChartAxisLabel[] = []
  while (divisions >= 2) {
    labels.length = 0
    let fits = true

    for (let i = 0; i <= divisions; i++) {
      const fraction = i / divisions
      const value = Math.round(maxTotal * fraction)
      const text = formatHumanReadableNumber(value, unit)

      let pos: number
      if (i === 0) {
        pos = 1
      } else if (i === divisions) {
        pos = chartWidth - text.length
      } else {
        pos = Math.floor(chartWidth * fraction) - Math.floor(text.length / 2)
      }

      const newStart = pos - 1
      const newEnd = pos + text.length + 1
      const overlaps = labels.some((l) => {
        const exStart = l.pos - 1
        const exEnd = l.pos + l.text.length + 1
        return newStart < exEnd && newEnd > exStart
      })

      if (overlaps) {
        fits = false
        break
      }

      labels.push({ text, pos })
    }

    if (fits) break
    divisions--
  }

  return labels
}
