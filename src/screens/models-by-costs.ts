import {
  initializePriceDetector,
  PriceDetector,
} from '@/core/price-detector.js'
import { RenderScreen } from '@/render/render-screen.js'
import {
  RenderDataItem,
  RenderScreenMessage,
  RenderValueUnit,
} from '@/render/types.js'

export class RenderModelsByCostsScreen extends RenderScreen {
  protected groupModels = true

  private priceDetector = null as unknown as PriceDetector

  protected title = 'Models by Costs'
  protected valueUnit: RenderValueUnit = 'dollar'

  protected async init() {
    this.priceDetector = await initializePriceDetector({
      fresh: this.options.refetchRemote,
    })
  }

  protected resolveItem(
    item: RenderScreenMessage,
    add: (resolved: RenderDataItem) => void
  ) {
    const model = item.groupedModel ?? item.model

    const prices = [
      this.priceDetector.getInputPrice(item.model),
      this.priceDetector.getOutputPrice(item.model),
      this.priceDetector.getOutputPrice(item.model),
      this.priceDetector.getCacheInputPrice(item.model),
      this.priceDetector.getCacheOutputPrice(item.model),
    ]
    const tokenCounts = [
      item.tokens.input,
      item.tokens.output,
      item.tokens.reasoning,
      item.tokens.cacheInput,
      item.tokens.cacheOutput,
    ]

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i]
      const count = tokenCounts[i]
      if (!price || !count) continue

      add({
        id: model.id,
        name: model.id,
        date: item.date,
        value: price * count,
      })
    }
  }
}
