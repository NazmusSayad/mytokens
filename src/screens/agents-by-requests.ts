import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderAgentsByRequestsScreen extends RenderScreen {
  protected title = 'Agents by Requests'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    add({
      id: item.agent,
      name: item.agent,
      date: item.date,
      value: 1,
    })
  }
}
