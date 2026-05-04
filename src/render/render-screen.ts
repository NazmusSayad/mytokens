import chalk from 'chalk'
import {
  formatDateKey,
  formatHumanReadable,
  getDateLabelWidth,
  placeLabels,
} from './utils.js'

export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
}

const COLORS = [
  chalk.hex('#4472C4'),
  chalk.hex('#ED7D31'),
  chalk.hex('#A5A5A5'),
  chalk.hex('#FFC000'),
  chalk.hex('#5B9BD5'),
  chalk.hex('#70AD47'),
  chalk.hex('#264478'),
  chalk.hex('#9E480E'),
  chalk.hex('#636363'),
  chalk.hex('#997300'),
]

export async function renderScreen(
  data: RenderDataItem[],
  showBy: 'day' | 'week' | 'month' | 'year' = 'day'
) {
  const AVAILABLE_WIDTH = (process.stdout.columns ?? 80) - 2

  if (data.length === 0) {
    console.log('No data to display.')
    return
  }

  const grouped = new Map<string, Map<string, number>>()
  const idToName = new Map<string, string>()

  for (const item of data) {
    const key = formatDateKey(item.date, showBy)
    if (!grouped.has(key)) {
      grouped.set(key, new Map())
    }
    const bucket = grouped.get(key)!
    bucket.set(item.id, (bucket.get(item.id) ?? 0) + item.value)
    if (!idToName.has(item.id)) {
      idToName.set(item.id, item.name)
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

  if (maxTotal === 0) {
    console.log('All values are zero.')
    return
  }

  const dateWidth = getDateLabelWidth(showBy)
  const SEPARATOR_TEXT = ' │ '
  const separator = chalk.dim(SEPARATOR_TEXT)
  const rightPad = 1
  const chartWidth = Math.max(
    10,
    AVAILABLE_WIDTH - dateWidth - SEPARATOR_TEXT.length - rightPad
  )

  const ids = Array.from(idToName.keys()).sort()
  const idToColor = new Map<string, (s: string) => string>()
  for (let i = 0; i < ids.length; i++) {
    idToColor.set(ids[i], COLORS[i % COLORS.length])
  }

  const title = 'Usage'
  const titlePadding = Math.max(
    0,
    Math.floor((AVAILABLE_WIDTH - title.length) / 2)
  )
  console.log(' '.repeat(titlePadding) + chalk.bold(title))
  console.log()

  for (const key of sortedKeys) {
    const bucket = grouped.get(key)!
    const total = Array.from(bucket.values()).reduce((a, b) => a + b, 0)

    let barWidth = Math.round((total / maxTotal) * chartWidth)
    if (barWidth === 0 && total > 0) {
      barWidth = 1
    }

    const label = key.padEnd(dateWidth)
    let bar = ''

    for (const id of ids) {
      const val = bucket.get(id) ?? 0
      if (val === 0) continue
      let chars = Math.round((val / total) * barWidth)
      if (chars === 0 && val > 0) {
        chars = 1
      }
      const colorFn = idToColor.get(id)!
      bar += colorFn('█'.repeat(chars))
    }

    console.log(`${label}${separator}${bar}`)
  }

  const cornerPrefix = ' '.repeat(dateWidth) + ' └'
  console.log(chalk.dim(cornerPrefix + '─'.repeat(chartWidth)))

  const maxLabel = formatHumanReadable(Math.round(maxTotal))
  const midLabel = formatHumanReadable(Math.round(maxTotal / 2))
  const axisLabels = placeLabels(chartWidth, [
    { text: '0', pos: 1 },
    {
      text: midLabel,
      pos: Math.floor(chartWidth / 2) - Math.floor(midLabel.length / 2),
    },
    { text: maxLabel, pos: chartWidth - maxLabel.length },
  ])
  const labelPrefix = ' '.repeat(dateWidth + 2)
  console.log(labelPrefix + axisLabels)

  console.log()

  const legendItems = ids.map((id) => {
    const colorFn = idToColor.get(id)!
    const name = idToName.get(id)!
    return colorFn('■') + ' ' + name
  })
  const legendLine = legendItems.join('  ')
  const plainLegend = legendLine.replace(/\u001b\[[0-9;]*m/g, '')
  const legendPadding = Math.max(
    0,
    Math.floor((AVAILABLE_WIDTH - plainLegend.length) / 2)
  )
  console.log(' '.repeat(legendPadding) + legendLine)
}
