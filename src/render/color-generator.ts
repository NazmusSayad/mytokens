import { webcrypto } from 'node:crypto'

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  let R = r / 255
  let G = g / 255
  let B = b / 255

  if (R > 0.04045) R = ((R + 0.055) / 1.055) ** 2.4
  else R = R / 12.92
  if (G > 0.04045) G = ((G + 0.055) / 1.055) ** 2.4
  else G = G / 12.92
  if (B > 0.04045) B = ((B + 0.055) / 1.055) ** 2.4
  else B = B / 12.92

  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041

  return [X * 100, Y * 100, Z * 100]
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const Xn = 95.047
  const Yn = 100.0
  const Zn = 108.883

  const fx =
    x / Xn > 0.008856 ? (x / Xn) ** (1 / 3) : 7.787 * (x / Xn) + 16 / 116
  const fy =
    y / Yn > 0.008856 ? (y / Yn) ** (1 / 3) : 7.787 * (y / Yn) + 16 / 116
  const fz =
    z / Zn > 0.008856 ? (z / Zn) ** (1 / 3) : 7.787 * (z / Zn) + 16 / 116

  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)

  return [L, a, b]
}

function deltaE(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)

  const [x1, y1, z1] = rgbToXyz(r1, g1, b1)
  const [x2, y2, z2] = rgbToXyz(r2, g2, b2)

  const [L1, a1, b1_] = xyzToLab(x1, y1, z1)
  const [L2, a2, b2_] = xyzToLab(x2, y2, z2)

  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1_ - b2_) ** 2)
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
    b = 0
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
    b = 0
  } else if (h >= 120 && h < 180) {
    r = 0
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    r = 0
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    g = 0
    b = c
  } else if (h >= 300 && h < 360) {
    r = c
    g = 0
    b = x
  }

  function toHex(n: number) {
    const val = Math.round((n + m) * 255)
    return val.toString(16).padStart(2, '0')
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export interface ColorGeneratorOptions {
  /** Minimum perceptual distance (Delta E) between new and existing colors. Default: 20 */
  minDeltaE?: number
  /** Maximum attempts to find a distinct color before giving up. Default: 64 */
  maxAttempts?: number
}

export class ColorGenerator {
  private cache = new Set<string>()
  private readonly minDeltaE: number
  private readonly maxAttempts: number

  constructor(options: ColorGeneratorOptions = {}) {
    this.minDeltaE = options.minDeltaE ?? 20
    this.maxAttempts = options.maxAttempts ?? 64
  }

  private isTooSimilar(hex: string): boolean {
    for (const prev of this.cache) {
      if (deltaE(hex, prev) < this.minDeltaE) {
        return true
      }
    }
    return false
  }

  async generate(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input)
    const digest = await webcrypto.subtle.digest('SHA-256', encoded)
    const bytes = new Uint8Array(digest)

    const baseHue = ((bytes[0] * 256 + bytes[1]) / 65535) * 360
    const baseSat = 35 + (bytes[2] / 255) * 30
    const baseLight = 45 + (bytes[3] / 255) * 10

    let hex = hslToHex(baseHue, baseSat, baseLight)

    if (!this.cache.has(hex) && !this.isTooSimilar(hex)) {
      this.cache.add(hex)
      return hex
    }

    // Use hash bytes to derive alternative candidates
    let attempts = 0
    while (attempts < this.maxAttempts) {
      const i = 4 + (attempts % (bytes.length - 4))
      const j = (i + 1) % bytes.length
      const k = (i + 2) % bytes.length

      const hue = ((bytes[i] * 256 + bytes[j]) / 65535) * 360
      const sat = 30 + (bytes[k] / 255) * 40
      const light = 40 + (bytes[(k + 1) % bytes.length] / 255) * 20

      hex = hslToHex(hue, sat, light)

      if (!this.cache.has(hex) && !this.isTooSimilar(hex)) {
        this.cache.add(hex)
        return hex
      }
      attempts++
    }

    // Fallback: deterministic hue shift with a step that covers hue space well
    attempts = 0
    let hue = baseHue
    while (attempts < 360) {
      hue = (hue + 47.5) % 360
      hex = hslToHex(hue, baseSat, baseLight)

      if (!this.cache.has(hex) && !this.isTooSimilar(hex)) {
        this.cache.add(hex)
        return hex
      }
      attempts++
    }

    // Last resort: return the base color anyway
    this.cache.add(hex)
    return hex
  }

  clear(): void {
    this.cache.clear()
  }
}
