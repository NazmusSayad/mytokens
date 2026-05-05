export type RenderValueUnit = 'none' | 'dollar'
export type RenderValueShowBy = 'day' | 'week' | 'month' | 'year'

export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
  color?: string
}

export type RenderScreenOptions = {
  showBy: RenderValueShowBy

  screenWidth: number
  screenPadding: number

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

  dateStart: Date | null
  dateEnd: Date | null
}
