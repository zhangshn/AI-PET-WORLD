/**
 * 当前文件负责：提供测试页数值展示行组件。
 */

export function ScoreLine({
  name,
  value,
  label
}: {
  name: string
  value: number
  label?: string
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      {name}
      {label ? `（${label}）` : ""}：{Math.round(value)}
    </div>
  )
}