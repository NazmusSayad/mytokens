export function RangeLabelsColumn({
  labels,
  rowCount,
  width,
}: {
  labels: number[]
  rowCount: number
  width: number
}) {
  const labelsByRow: Record<number, string> = {}
  for (const [index, label] of labels.entries()) {
    const labelRow = Math.round((index / Math.max(1, labels.length - 1)) * (rowCount - 1))
    labelsByRow[labelRow] = String(label)
  }

  return (
    <box
      style={{
        width,
        flexDirection: 'column',
        height: rowCount,
      }}
    >
      {Array.from({ length: rowCount }, (_, row) => (
        <text key={row} style={{ width, height: 1 }} fg="#888888">
          {(labelsByRow[row] ?? '').padStart(width)}
        </text>
      ))}
    </box>
  )
}
