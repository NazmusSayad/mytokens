import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderAppsByTokensScreen extends RenderScreen {
  protected title = 'Apps by Tokens'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    if (item.tokens.input) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.input,
      })
    }

    if (item.tokens.output) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.output,
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.reasoning,
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheInput,
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheOutput,
      })
    }
  }
}
