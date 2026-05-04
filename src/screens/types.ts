import { UsageDataMessage } from '@/core/types.js'

export type RenderScreenOptions = {
  data: UsageDataMessage[]
  showBy: 'day' | 'week' | 'month' | 'year'

  screenWidth: number
  screenPadding: number
}
