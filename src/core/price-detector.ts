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

const $1_M = 1_000_000

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
    if (modelsDotDevModel?.cost?.input) {
      return modelsDotDevModel.cost?.input / $1_M
    }

    return 0
  }

  public getOutputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost?.output) {
      return modelsDotDevModel.cost?.output / $1_M
    }

    return 0
  }

  public getCacheInputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost?.cache_read) {
      return modelsDotDevModel.cost?.cache_read / $1_M
    }

    return 0
  }

  public getCacheOutputPrice(input: UsageDataModel): number {
    const modelsDotDevModel = this.getModelsDotDevModel(input)
    if (modelsDotDevModel?.cost?.cache_write) {
      return modelsDotDevModel.cost?.cache_write / $1_M
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
