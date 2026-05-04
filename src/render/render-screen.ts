export type RenderDataItem = {
  id: string
  name: string
  date: Date
  value: number
}

export async function renderScreen(
  data: RenderDataItem[],
  showBy: 'day' | 'week' | 'month' | 'year' = 'day'
) {
  const width = process.stdout.columns ?? 80
  const height = process.stdout.rows ?? 40

  console.log(width, height)
}
