import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'

export class RenderModesByTokensScreen extends RenderScreen {
  protected title = 'Modes by Tokens'

  protected resolveItem(item: UsageDataMessage) {
    if (item.tokens.input) {
      return {
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.input,
      }
    }

    if (item.tokens.output) {
      return {
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.output,
      }
    }

    if (item.tokens.reasoning) {
      return {
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.reasoning,
      }
    }

    if (item.tokens.cacheInput) {
      return {
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.cacheInput,
      }
    }

    if (item.tokens.cacheOutput) {
      return {
        id: item.mode,
        name: item.mode,
        date: item.date,
        value: item.tokens.cacheOutput,
      }
    }
  }
}
