/**
 * 当前文件负责：提供测试页通用信息卡片组件。
 */

export function InfoCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 16,
        background: "#fff"
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  )
}