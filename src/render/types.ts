export type RenderValueUnit = 'none' | 'dollar'

export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
}

export type RenderScreenOptions = {
  showBy: 'day' | 'week' | 'month' | 'year'

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
