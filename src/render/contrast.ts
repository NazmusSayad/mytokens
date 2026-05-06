import chalk from 'chalk'

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function foregroundForBackground(
  bgHex: string
): (text: string) => string {
  return relativeLuminance(bgHex) > 0.179 ? chalk.black : chalk.white
}
