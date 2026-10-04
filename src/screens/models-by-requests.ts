import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem, RenderScreenMessage } from '@/render/types.js'

export class RenderModelsByRequestsScreen extends RenderScreen {
  protected groupModels = true

  protected title = 'Models by Requests'

  protected resolveItem(
    item: RenderScreenMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    const model = item.groupedModel ?? item.model

    add({
      id: model.id,
      name: model.id,
      date: item.date,
      value: 1,
    })
  }
}
