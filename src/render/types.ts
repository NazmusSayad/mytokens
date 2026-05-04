export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
}

export type RenderScreenOptions = {
  showBy: 'day' | 'week' | 'month' | 'year'
  unit?: 'time' | 'dollar'

  screenWidth: number
  screenPadding: number

  enabledApps: string[] | null
  disabledApps: string[] | null

  dateStart: Date | null
  dateEnd: Date | null
}
