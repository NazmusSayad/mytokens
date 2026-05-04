import type { ChartDay } from './types'
import { formatDate } from './utils'

export function RangeBar({
  days,
  visibleDays,
  width,
  scrollOffset,
}: {
  days: ChartDay[]
  visibleDays: ChartDay[]
  width: number
  scrollOffset: number
}) {
  const firstDay = days[0]
  const lastDay = days.at(-1)
  const visibleFirstDay = visibleDays[0]
  const visibleLastDay = visibleDays.at(-1)
  if (!firstDay || !lastDay || !visibleFirstDay || !visibleLastDay) return null

  const firstDate = formatDate(firstDay.date)
  const lastDate = formatDate(lastDay.date)
  const thumb = `[ ${formatDate(visibleFirstDay.date)} - ${formatDate(visibleLastDay.date)} ]`
  const maxScroll = Math.max(0, days.length - visibleDays.length)
  const middleWidth = Math.max(
    0,
    width - firstDate.length - lastDate.length - 2,
  )

  let leftFill = ''
  let rightFill = ''
  let displayThumb = thumb

  if (middleWidth >= thumb.length) {
    const scrollRatio = maxScroll > 0 ? scrollOffset / maxScroll : 0
    const thumbPos = Math.floor(scrollRatio * (middleWidth - thumb.length))
    leftFill = '─'.repeat(thumbPos)
    rightFill = '─'.repeat(Math.max(0, middleWidth - thumbPos - thumb.length))
  } else if (middleWidth > 0) {
    displayThumb = thumb.slice(0, middleWidth)
  }

  return (
    <box style={{ flexDirection: 'row', height: 1 }}>
      <text fg="#666666">{firstDate}</text>
      <text fg="#444444">{' ' + leftFill}</text>
      <text fg="#888888">{displayThumb}</text>
      <text fg="#444444">{rightFill + ' '}</text>
      <text fg="#666666">{lastDate}</text>
    </box>
  )
}
