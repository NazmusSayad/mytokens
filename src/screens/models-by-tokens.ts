import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem, RenderScreenMessage } from '@/render/types.js'

export class RenderModelsByTokensScreen extends RenderScreen {
  protected groupModels = true

  protected title = 'Models by Tokens'

  protected resolveItem(
    item: RenderScreenMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    const model = item.groupedModel ?? item.model
    const tokens = item.tokens
    const value =
      tokens.input +
      tokens.output +
      tokens.reasoning +
      tokens.cacheInput +
      tokens.cacheOutput

    if (value > 0) {
      add({
        id: model.id,
        name: model.id,
        date: item.date,
        value,
      })
    }
  }
}
