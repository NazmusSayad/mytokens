import { BEST_LLM_BRANDS } from '@/constants/providers.js'
import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderProvidersByTokensScreen extends RenderScreen {
  protected title = 'Providers by Tokens'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    if (item.tokens.input) {
      add({
        id: item.model.provider,
        name: item.model.provider,
        date: item.date,
        value: item.tokens.input,
        color: BEST_LLM_BRANDS[item.model.provider],
      })
    }

    if (item.tokens.output) {
      add({
        id: item.model.provider,
        name: item.model.provider,
        date: item.date,
        value: item.tokens.output,
        color: BEST_LLM_BRANDS[item.model.provider],
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: item.model.provider,
        name: item.model.provider,
        date: item.date,
        value: item.tokens.reasoning,
        color: BEST_LLM_BRANDS[item.model.provider],
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: item.model.provider,
        name: item.model.provider,
        date: item.date,
        value: item.tokens.cacheInput,
        color: BEST_LLM_BRANDS[item.model.provider],
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: item.model.provider,
        name: item.model.provider,
        date: item.date,
        value: item.tokens.cacheOutput,
        color: BEST_LLM_BRANDS[item.model.provider],
      })
    }
  }
}
