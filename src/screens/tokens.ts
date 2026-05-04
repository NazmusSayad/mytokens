import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'

export class RenderTokensScreen extends RenderScreen {
  protected resolveItem(item: UsageDataMessage) {
    if (item.tokens.input) {
      return {
        id: 'input',
        name: 'Input',
        date: item.date,
        value: item.tokens.input,
      }
    }

    if (item.tokens.output) {
      return {
        id: 'output',
        name: 'Output',
        date: item.date,
        value: item.tokens.output,
      }
    }

    if (item.tokens.reasoning) {
      return {
        id: 'reasoning',
        name: 'Reasoning',
        date: item.date,
        value: item.tokens.reasoning,
      }
    }

    if (item.tokens.cacheInput) {
      return {
        id: 'cacheInput',
        name: 'Cache Input',
        date: item.date,
        value: item.tokens.cacheInput,
      }
    }

    if (item.tokens.cacheOutput) {
      return {
        id: 'cacheOutput',
        name: 'Cache Output',
        date: item.date,
        value: item.tokens.cacheOutput,
      }
    }
  }
}
