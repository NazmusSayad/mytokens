export type ChartViewData = {
  id: string
  name: string
  date: Date
  value: number
}

export type ChartItem = {
  id: string
  name: string
  color: string
}

export type ChartDay = {
  date: Date
  values: Record<string, number>
}

export type ChartDataModel = {
  allDays: ChartDay[]
  days: ChartDay[]
  items: ChartItem[]
  visibleItems: ChartItem[]
  yLabels: number[]
  scrollOffset: number
  maxScroll: number
  maxTotal: number
}

export type BarSegment = {
  color: string
  startRow: number
  endRow: number
}

export type ChartLayout = {
  width: number
  height: number
  chartAreaHeight: number
  rangeLabelWidth: number
  mainWidth: number
  rightEmptyWidth: number
  chartHeight: number
}
