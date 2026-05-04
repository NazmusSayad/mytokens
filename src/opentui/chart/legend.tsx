import type { ChartItem } from './types'

export function Legend({ items, width }: { items: ChartItem[]; width: number }) {
  const chunks: ChartItem[][] = []
  let current: ChartItem[] = []
  let currentLen = 0

  for (const item of items) {
    const itemLen = item.name.length + 4
    if (currentLen + itemLen > width && current.length > 0) {
      chunks.push(current)
      current = [item]
      currentLen = itemLen
    } else {
      current.push(item)
      currentLen += itemLen
    }
  }
  if (current.length > 0) chunks.push(current)

  return (
    <box style={{ flexDirection: 'column', gap: 0, width }}>
      {chunks.map((chunk, index) => (
        <box
          key={index}
          style={{
            flexDirection: 'row',
            height: 1,
            gap: 2,
            width,
            justifyContent: 'center',
          }}
        >
          {chunk.map((item) => (
            <box key={item.id} style={{ flexDirection: 'row', gap: 0 }}>
              <text fg={item.color}>● </text>
              <text fg="#CCCCCC">{item.name}</text>
            </box>
          ))}
        </box>
      ))}
    </box>
  )
}
