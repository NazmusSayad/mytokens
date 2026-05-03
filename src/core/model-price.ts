type ModelPriceConstructorInput = {
  price: number
  currency: string
}

class ModelPrice {
  constructor(private input: ModelPriceConstructorInput) {}
}
