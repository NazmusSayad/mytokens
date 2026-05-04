import type {
  ChartDataModel,
  ChartDay,
  ChartItem,
  ChartViewData,
  ChartLayout,
} from './types'

export const BAR_WIDTH = 5

const COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#FFD93D',
  '#6BCB77',
  '#4D96FF',
  '#FF9F45',
  '#C9B1FF',
  '#FF8C94',
] as const

export function buildDataset(data: ChartViewData[]) {
  const itemMap = new Map<string, ChartItem>()
  const dayMap = new Map<string, ChartDay>()

  for (const row of data) {
    if (!itemMap.has(row.id)) {
      itemMap.set(row.id, {
        id: row.id,
        name: row.name,
        color: COLORS[itemMap.size % COLORS.length] ?? COLORS[0],
      })
    }

    const date = new Date(
      row.date.getFullYear(),
      row.date.getMonth(),
      row.date.getDate(),
    )
    const key = getDateKey(date)
    const day = dayMap.get(key) ?? { date, values: {} }
    day.values[row.id] = (day.values[row.id] ?? 0) + row.value
    dayMap.set(key, day)
  }

  return {
    items: Array.from(itemMap.values()),
    days: Array.from(dayMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    ),
  }
}

export function createChartRenderData(
  data: ChartViewData[],
  scrollOffset: number,
  width: number,
): ChartDataModel {
  const dataset = buildDataset(data)
  const maxDays = Math.max(0, Math.floor(width / BAR_WIDTH))
  const clampedScroll = Math.max(
    0,
    Math.min(scrollOffset, Math.max(0, dataset.days.length - maxDays)),
  )
  const days = dataset.days.slice(
    Math.max(0, dataset.days.length - clampedScroll - maxDays),
    dataset.days.length - clampedScroll,
  )
  const visibleItems = getVisibleItems(dataset.items, days)
  const maxTotal = Math.max(
    0,
    ...days.map((day) => getVisibleTotalAtDay(day, visibleItems)),
  )

  return {
    allDays: dataset.days,
    days,
    items: dataset.items,
    visibleItems,
    yLabels: getYLabels(maxTotal),
    scrollOffset: clampedScroll,
    maxScroll: Math.max(0, dataset.days.length - days.length),
    maxTotal,
  }
}

export function getDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function formatDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

export function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function getTotalAtDay(day: ChartDay) {
  return Object.values(day.values).reduce((sum, value) => sum + value, 0)
}

export function getLegendHeight(items: ChartItem[], width: number) {
  let rows = 0
  let currentLen = 0

  for (const item of items) {
    const itemLen = item.name.length + 4
    if (currentLen + itemLen > width && currentLen > 0) {
      rows++
      currentLen = itemLen
    } else {
      currentLen += itemLen
    }
  }

  return currentLen > 0 ? rows + 1 : rows
}

export function getVisibleItems(items: ChartItem[], days: ChartDay[]) {
  return items.filter((item) =>
    days.some((day) => (day.values[item.id] ?? 0) > 0),
  )
}

export function getVisibleTotalAtDay(day: ChartDay, items: ChartItem[]) {
  return items.reduce((sum, item) => sum + (day.values[item.id] ?? 0), 0)
}

export function getYLabels(maxTotal: number) {
  return Array.from({ length: 5 }, (_, index) =>
    Math.round((maxTotal / 4) * (4 - index)),
  )
}

export function getYLabelWidth(labels: number[]) {
  return Math.max(1, ...labels.map((label) => String(label).length))
}

export function createChartLayout({
  chartData,
  width,
  height,
}: {
  chartData: ChartDataModel
  width: number
  height: number
}): ChartLayout {
  const rangeLabelWidth = getYLabelWidth(chartData.yLabels)

  const legendHeight = getLegendHeight(chartData.visibleItems, width)
  const chartAreaHeight = Math.max(0, height - legendHeight -1)
  const mainWidth = chartData.days.length * BAR_WIDTH
  const rightEmptyWidth = Math.max(0, width - rangeLabelWidth - 1 - mainWidth)
  const chartHeight = Math.max(4, chartAreaHeight - 2)

  return {
    width,
    height,
    chartAreaHeight,
    rangeLabelWidth,
    mainWidth,
    rightEmptyWidth,
    chartHeight,
  }
}
