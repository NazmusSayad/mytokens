import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderTokensScreen extends RenderScreen {
  protected title = 'Tokens Usage'

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    if (item.tokens.input) {
      add({
        id: 'input',
        name: 'Input',
        date: item.date,
        value: item.tokens.input,
      })
    }

    if (item.tokens.output) {
      add({
        id: 'output',
        name: 'Output',
        date: item.date,
        value: item.tokens.output,
      })
    }

    if (item.tokens.reasoning) {
      add({
        id: 'reasoning',
        name: 'Reasoning',
        date: item.date,
        value: item.tokens.reasoning,
      })
    }

    if (item.tokens.cacheInput) {
      add({
        id: 'cacheInput',
        name: 'Cache Input',
        date: item.date,
        value: item.tokens.cacheInput,
      })
    }

    if (item.tokens.cacheOutput) {
      add({
        id: 'cacheOutput',
        name: 'Cache Output',
        date: item.date,
        value: item.tokens.cacheOutput,
      })
    }
  }
}
