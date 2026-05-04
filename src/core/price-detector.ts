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

type GetPriceInput = {
  model: string
  provider: string
}

export class PriceDetector {
  private modelsDotDev: ModelsDotDevResponse
  private openrouter: OpenrouterResponse

  constructor(input: ConstructorInput) {
    this.modelsDotDev = input.modelsDotDev
    this.openrouter = input.openrouter
  }

  public getInputPrice(input: UsageDataModel): number {
    return 0
  }

  public getOutputPrice(input: UsageDataModel): number {
    return 0
  }

  public getReasoningPrice(input: UsageDataModel): number {
    return 0
  }

  public getCacheInputPrice(input: UsageDataModel): number {
    return 0
  }

  public getCacheOutputPrice(input: UsageDataModel): number {
    return 0
  }
}

export async function initializePriceDetector() {
  const [modelsDotDev, openrouter] = await Promise.all([
    fetchModelsDotDev(),
    fetchOpenrouter(),
  ])

  return new PriceDetector({ modelsDotDev, openrouter })
}
