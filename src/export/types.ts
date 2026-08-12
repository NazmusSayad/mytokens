import { RenderValueUnit } from '@/render/types.js'

export type ChartSegment = { id: string; value: number }
export type ChartRow = { key: string; total: number; segments: ChartSegment[] }
export type ChartAxisLabel = { text: string; pos: number }
export type ChartLegendItem = {
  id?: string
  name: string
  color?: string
  value: number
}

export type ChartModel = {
  title: string
  valueUnit: RenderValueUnit
  rows: ChartRow[]
  ids: string[]
  idToMeta: Map<string, { name: string; color?: string }>
  idToHex: Map<string, string>
  idToTotal: Map<string, number>
  legend: ChartLegendItem[]
  grandTotal: number
  maxTotal: number
}
