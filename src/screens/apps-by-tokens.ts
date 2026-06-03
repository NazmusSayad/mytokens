import { KNOWN_LLM_BRANDS } from '@/constants/providers.js'
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
        color: KNOWN_LLM_BRANDS[item.app],
      })
    }

    if (item.tokens.output) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.output,
        color: KNOWN_LLM_BRANDS[item.app],
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.reasoning,
        color: KNOWN_LLM_BRANDS[item.app],
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheInput,
        color: KNOWN_LLM_BRANDS[item.app],
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: item.app,
        name: item.app,
        date: item.date,
        value: item.tokens.cacheOutput,
        color: KNOWN_LLM_BRANDS[item.app],
      })
    }
  }
}
