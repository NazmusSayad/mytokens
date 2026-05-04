import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderTokenScreen extends RenderScreen {
  protected async getRenderDataItems() {
    const renderItems: RenderDataItem[] = []

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i]
      if (this.isMessageIgnored(item)) {
        continue
      }

      if (item.tokens.input) {
        renderItems.push({
          id: 'input',
          name: 'Input',
          date: item.date,
          value: item.tokens.input,
        })
      }

      if (item.tokens.output) {
        renderItems.push({
          id: 'output',
          name: 'Output',
          date: item.date,
          value: item.tokens.output,
        })
      }

      if (item.tokens.reasoning) {
        renderItems.push({
          id: 'reasoning',
          name: 'Reasoning',
          date: item.date,
          value: item.tokens.reasoning,
        })
      }

      if (item.tokens.cacheInput) {
        renderItems.push({
          id: 'cacheInput',
          name: 'Cache Input',
          date: item.date,
          value: item.tokens.cacheInput,
        })
      }

      if (item.tokens.cacheOutput) {
        renderItems.push({
          id: 'cacheOutput',
          name: 'Cache Output',
          date: item.date,
          value: item.tokens.cacheOutput,
        })
      }
    }

    return renderItems
  }
}
