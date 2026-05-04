import {
  fetchModelsDotDev,
  ModelsDotDevResponse,
} from './fetch-models-dot-dev.js'
import { fetchOpenrouter, OpenrouterResponse } from './fetch-openrouter.js'
import { UsageDataModel } from './types.js'

type ConstructorInput = {
  modelsDotDev: ModelsDotDevResponse
  openrouter: OpenrouterResponse
}

export class PriceDetector {
  private modelsDotDev: ModelsDotDevResponse
  private openrouter: OpenrouterResponse

  constructor(input: ConstructorInput) {
    this.modelsDotDev = input.modelsDotDev
    this.openrouter = input.openrouter
  }

  public getInputPrice(input: UsageDataModel): number {
    const model = this.openrouter.data.find(
      (m) => m.name === `${input.provider}/${input.id}`
    )

    if (model) {
      return model.pricing.request ? parseInt(model.pricing.request) : 0
    }

    return 0
  }

  public getOutputPrice(input: UsageDataModel): number {
    return 10
  }

  public getReasoningPrice(input: UsageDataModel): number {
    return 10
  }

  public getCacheInputPrice(input: UsageDataModel): number {
    return 10
  }

  public getCacheOutputPrice(input: UsageDataModel): number {
    return 10
  }
}

let cachedPriceDetector: PriceDetector | null = null
export async function initializePriceDetector() {
  if (cachedPriceDetector) {
    return cachedPriceDetector
  }

  const [modelsDotDev, openrouter] = await Promise.all([
    fetchModelsDotDev(),
    fetchOpenrouter(),
  ])

  cachedPriceDetector = new PriceDetector({
    modelsDotDev,
    openrouter,
  })

  return cachedPriceDetector
}
