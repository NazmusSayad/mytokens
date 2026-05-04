export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
}

export async function renderScreen(
  data: RenderDataItem[],
  showBy: 'day' | 'week' | 'month' | 'year' = 'day'
) {}
