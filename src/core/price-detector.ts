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

  public getModelsDotDevModel(input: UsageDataModel) {
    const modelsDotDevProvider = this.modelsDotDev[input.provider]

    if (modelsDotDevProvider) {
      const model = modelsDotDevProvider.models[input.id]
      if (model) return model
    }

    return null
  }

  public getInputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost.input) {
      return modelsDotDevModel.cost.input
    }

    const model = this.openrouter.data.find(
      (m) => m.name === `${input.provider}/${input.id}`
    )

    if (model) {
      return model.pricing.request ? parseInt(model.pricing.request) : 0
    }

    return 0
  }

  public getOutputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost.output) {
      return modelsDotDevModel.cost.output
    }

    return 0
  }

  public getReasoningPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost.output) {
      return modelsDotDevModel.cost.output
    }

    return 0
  }

  public getCacheInputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost.cache_read) {
      return modelsDotDevModel.cost.cache_read
    }

    return 0
  }

  public getCacheOutputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost.cache_write) {
      return modelsDotDevModel.cost.cache_write
    }

    return 0
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
