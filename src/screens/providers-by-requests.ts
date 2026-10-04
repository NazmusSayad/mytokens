import { KNOWN_LLM_BRANDS } from '@/constants/providers.js'
import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderProvidersByRequestsScreen extends RenderScreen {
  protected title = 'Providers by Requests'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    add({
      id: item.model.provider,
      name: item.model.provider,
      date: item.date,
      value: 1,
      color: KNOWN_LLM_BRANDS[item.model.provider],
    })
  }
}
