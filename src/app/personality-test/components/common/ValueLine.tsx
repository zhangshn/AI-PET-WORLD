/**
 * 当前文件负责：提供测试页键值展示行组件。
 */

export function ValueLine({
  label,
  value
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <strong>{label}：</strong>
      {value}
    </div>
  )
}