import { KNOWN_LLM_BRANDS } from '@/constants/providers.js'
import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderSourcesByRequestsScreen extends RenderScreen {
  protected title = 'Sources by Requests'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    add({
      id: item.source,
      name: item.source,
      date: item.date,
      value: 1,
      color: KNOWN_LLM_BRANDS[item.source],
    })
  }
}
