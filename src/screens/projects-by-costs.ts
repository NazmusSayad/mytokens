import {
  initializePriceDetector,
  PriceDetector,
} from '@/core/price-detector.js'
import { UsageDataMessage } from '@/core/types.js'
import { RenderScreen } from '@/render/render-screen.js'

export class RenderProjectsByCostsScreen extends RenderScreen {
  private priceDetector = null as unknown as PriceDetector

  protected title = 'Projects by Costs'

  protected async init() {
    this.priceDetector = await initializePriceDetector()
  }

  protected resolveItem(item: UsageDataMessage) {
    const projectId = item.project?.name ?? item.project?.path ?? '(no project)'

    if (item.tokens.input) {
      const cost = this.priceDetector.getInputPrice(item.model)
      if (cost) {
        return {
          id: projectId,
          name: projectId,
          date: item.date,
          value: cost,
        }
      }
    }

    if (item.tokens.output) {
      const cost = this.priceDetector.getOutputPrice(item.model)
      if (cost) {
        return {
          id: projectId,
          name: projectId,
          date: item.date,
          value: cost,
        }
      }
    }

    if (item.tokens.reasoning) {
      const cost = this.priceDetector.getReasoningPrice(item.model)
      if (cost) {
        return {
          id: projectId,
          name: projectId,
          date: item.date,
          value: cost,
        }
      }
    }

    if (item.tokens.cacheInput) {
      const cost = this.priceDetector.getCacheInputPrice(item.model)
      if (cost) {
        return {
          id: projectId,
          name: projectId,
          date: item.date,
          value: cost,
        }
      }
    }

    if (item.tokens.cacheOutput) {
      const cost = this.priceDetector.getCacheOutputPrice(item.model)
      if (cost) {
        return {
          id: projectId,
          name: projectId,
          date: item.date,
          value: cost,
        }
      }
    }
  }
}
