export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
}

const AVAILABLE_WIDTH = process.stdout.columns ?? 80

export async function renderScreen(
  data: RenderDataItem[],
  showBy: 'day' | 'week' | 'month' | 'year' = 'day'
) {
  console.log(AVAILABLE_WIDTH)
}
