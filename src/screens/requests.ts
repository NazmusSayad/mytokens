import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderRequestsScreen extends RenderScreen {
  protected title = 'Requests'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    add({
      id: 'requests',
      name: 'Requests',
      date: item.date,
      color: '#6b9af5',
      value: 1,
    })
  }
}
