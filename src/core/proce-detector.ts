import {
  fetchModelsDotDev,
  ModelsDotDevResponse,
} from './fetch-models-dot-dev.js'
import { fetchOpenrouter, OpenrouterResponse } from './fetch-openrouter.js'

type ConstructorInput = {
  modelsDotDev: ModelsDotDevResponse
  openrouter: OpenrouterResponse
}

class PriceDetector {
  private modelsDotDev: ModelsDotDevResponse
  private openrouter: OpenrouterResponse

  constructor(input: ConstructorInput) {
    this.modelsDotDev = input.modelsDotDev
    this.openrouter = input.openrouter
  }
}

export async function initializePriceDetector() {
  const [modelsDotDev, openrouter] = await Promise.all([
    fetchModelsDotDev(),
    fetchOpenrouter(),
  ])

  return new PriceDetector({ modelsDotDev, openrouter })
}
