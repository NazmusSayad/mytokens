import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'

export class RenderAppsByTokensScreen extends RenderScreen {
  protected title = 'Apps by Tokens'

  protected resolveItem(item: UsageDataMessage) {
    if (item.tokens.input) {
      return {
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.input,
      }
    }

    if (item.tokens.output) {
      return {
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.output,
      }
    }

    if (item.tokens.reasoning) {
      return {
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.reasoning,
      }
    }

    if (item.tokens.cacheInput) {
      return {
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheInput,
      }
    }

    if (item.tokens.cacheOutput) {
      return {
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheOutput,
      }
    }
  }
}
