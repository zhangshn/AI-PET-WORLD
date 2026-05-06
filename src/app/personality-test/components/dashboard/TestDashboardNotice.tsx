/**
 * 当前文件负责：展示 personality-test 页面提示信息。
 */

export function TestDashboardNotice({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: "1px solid #e9d5ff",
        borderRadius: 16,
        padding: 16,
        background: "#fbf7ff",
        color: "#4c1d95",
        lineHeight: 1.8,
      }}
    >
      <strong>{title}</strong>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  )
}