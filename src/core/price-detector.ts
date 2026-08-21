import {
  fetchModelsDotDev,
  ModelsDotDevModel,
  ModelsDotDevResponse,
} from './fetch-models-dot-dev.js'
import { UsageDataModel } from './types.js'

type ConstructorInput = {
  modelsDotDev: ModelsDotDevResponse
}

const $1_M = 1_000_000

export class PriceDetector {
  private modelsDotDev: ModelsDotDevResponse

  constructor(input: ConstructorInput) {
    this.modelsDotDev = input.modelsDotDev
  }

  public getModelsDotDevModel(input: UsageDataModel) {
    const modelsDotDevProvider = this.modelsDotDev[input.provider]

    if (modelsDotDevProvider) {
      const model = modelsDotDevProvider.models[input.id]

      if (model && this.hasZeroCost(model.cost)) {
        const nonFreeModel = this.getNonFreeModelsDotDevModel(input)
        if (nonFreeModel) return nonFreeModel
      }

      if (model) return model
    }

    return null
  }

  private getNonFreeModelsDotDevModel(input: UsageDataModel) {
    const modelsDotDevProvider = this.modelsDotDev[input.provider]
    if (!modelsDotDevProvider) return null

    const nonFreeId = input.id.replace(/([-:_.\/])free$/i, '')
    if (nonFreeId === input.id) return null
    return modelsDotDevProvider.models[nonFreeId] ?? null
  }

  private hasZeroCost(cost?: ModelsDotDevModel['cost']) {
    if (!cost) return true
    if (cost.input) return false
    if (cost.output) return false
    if (cost.cache_read) return false
    if (cost.cache_write) return false
    return true
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
export async function initializePriceDetector(
  options: { fresh?: boolean } = {}
) {
  if (cachedPriceDetector) {
    return cachedPriceDetector
  }

  const modelsDotDev = await fetchModelsDotDev({ fresh: options.fresh })

  cachedPriceDetector = new PriceDetector({ modelsDotDev })

  return cachedPriceDetector
}
