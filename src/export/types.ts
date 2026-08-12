import { RenderValueUnit } from '@/render/types.js'
import { RenderValueShowBy } from '@/render/types.js'

export type ExportFormat = 'svg' | 'png'

export type ExportThemeId =
  | 'light'
  | 'dark'
  | 'one-dark'
  | 'dracula'
  | 'nord'
  | 'monokai'
  | 'gruvbox'
  | 'solarized'
  | 'github'
  | 'github-dark'

export type ExportTheme = {
  background: string
  cardFill: string
  border: string
  ink: string
  muted: string
  faint: string
  accent: string
  accentAlt: string
}

export type ExportFilterOptions = {
  usageBy: RenderValueShowBy
  dateStart: Date | null
  dateEnd: Date | null
  enabledApps: string[] | null
  disabledApps: string[] | null
  enabledProviders: string[] | null
  disabledProviders: string[] | null
  enabledModels: string[] | null
  disabledModels: string[] | null
  enabledModes: string[] | null
  disabledModes: string[] | null
  enabledProjects: string[] | null
  disabledProjects: string[] | null
}

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
