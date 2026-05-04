import { RenderValueUnit } from './types.js'

export function formatDateKey(date: Date, showBy: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (showBy === 'year') {
    return String(year)
  }
  if (showBy === 'month') {
    return `${year}-${month}`
  }
  if (showBy === 'week') {
    const tmp = new Date(d)
    const dayOfWeek = tmp.getDay()
    const diff = tmp.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    tmp.setDate(diff)
    const wy = tmp.getFullYear()
    const wm = String(tmp.getMonth() + 1).padStart(2, '0')
    const wd = String(tmp.getDate()).padStart(2, '0')
    return `${wy}-${wm}-${wd}`
  }
  return `${year}-${month}-${day}`
}

export function getDateLabelWidth(showBy: string): number {
  if (showBy === 'year') return 4
  if (showBy === 'month') return 7
  return 10
}

export function formatHumanReadable(
  input: number | string,
  unit: RenderValueUnit
): string {
  const n = typeof input === 'string' ? parseFloat(input) : input
  if (Number.isNaN(n)) return 'N/A'

  if (n === 0) {
    return unit === 'dollar' ? '$0' : '0'
  }

  const absN = Math.abs(n)
  const sign = n < 0 ? '-' : ''

  if (absN < 1000) {
    return unit === 'dollar' ? `${sign}$${absN}` : `${sign}${absN}`
  }

  const units = ['', 'K', 'M', 'B', 'T']
  const magnitude = Math.min(Math.floor(Math.log10(absN) / 3), units.length - 1)
  const divisor = Math.pow(10, magnitude * 3)
  const scaled = absN / divisor

  const formatted = scaled.toFixed(1).replace(/\.0$/, '')
  const final = sign + formatted + units[magnitude]
  return unit === 'dollar' ? `$${final}` : final
}

export function placeLabels(
  width: number,
  labels: Array<{ text: string; pos: number }>
): string {
  const chars: string[] = new Array(width).fill(' ')
  for (const label of labels) {
    for (let i = 0; i < label.text.length; i++) {
      const p = label.pos + i
      if (p >= 0 && p < width) {
        chars[p] = label.text[i]
      }
    }
  }
  return chars.join('')
}
