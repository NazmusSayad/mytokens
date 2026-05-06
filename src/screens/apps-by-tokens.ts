import { BEST_CLI_TOOLS } from '@/constants/providers.js'
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
        color: BEST_CLI_TOOLS[item.model.provider],
      })
    }

    if (item.tokens.output) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.output,
        color: BEST_CLI_TOOLS[item.model.provider],
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.reasoning,
        color: BEST_CLI_TOOLS[item.model.provider],
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheInput,
        color: BEST_CLI_TOOLS[item.model.provider],
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheOutput,
        color: BEST_CLI_TOOLS[item.model.provider],
      })
    }
  }
}
