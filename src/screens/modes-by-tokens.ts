import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderModesByTokensScreen extends RenderScreen {
  protected title = 'Modes by Tokens'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    if (item.tokens.input) {
      add({
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.input,
      })
    }

    if (item.tokens.output) {
      add({
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.output,
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.reasoning,
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.cacheInput,
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.cacheOutput,
      })
    }
  }
}
