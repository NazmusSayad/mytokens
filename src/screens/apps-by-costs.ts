import {
  initializePriceDetector,
  PriceDetector,
} from '@/core/price-detector.js'
import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'
import { RenderDataItem } from '@/render/types.js'

export class RenderAppsByCostsScreen extends RenderScreen {
  private priceDetector = null as unknown as PriceDetector

  protected title = 'Apps by Costs'

  protected async init() {
    this.priceDetector = await initializePriceDetector()
  }

  protected resolveItem(
    item: UsageDataMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    if (item.tokens.input) {
      const cost = this.priceDetector.getInputPrice(item.model)
      if (cost) {
        add({
          id: item.app,
          name: item.app,
          date: item.date,
          value: cost * item.tokens.input,
        })
      }
    }

    if (item.tokens.output) {
      const cost = this.priceDetector.getOutputPrice(item.model)
      if (cost) {
        add({
          id: item.app,
          name: item.app,
          date: item.date,
          value: cost * item.tokens.output,
        })
      }
    }

    if (item.tokens.reasoning) {
      const cost = this.priceDetector.getReasoningPrice(item.model)
      if (cost) {
        add({
          id: item.app,
          name: item.app,
          date: item.date,
          value: cost * item.tokens.reasoning,
        })
      }
    }

    if (item.tokens.cacheInput) {
      const cost = this.priceDetector.getCacheInputPrice(item.model)
      if (cost) {
        add({
          id: item.app,
          name: item.app,
          date: item.date,
          value: cost * item.tokens.cacheInput,
        })
      }
    }

    if (item.tokens.cacheOutput) {
      const cost = this.priceDetector.getCacheOutputPrice(item.model)
      if (cost) {
        add({
          id: item.app,
          name: item.app,
          date: item.date,
          value: cost * item.tokens.cacheOutput,
        })
      }
    }
  }
}
