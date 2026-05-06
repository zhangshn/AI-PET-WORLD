/**
 * 当前文件负责：提供 personality-test 页面响应式网格布局。
 */

export function TestDashboardGrid({
  children,
  minColumnWidth = 560,
}: {
  children: React.ReactNode
  minColumnWidth?: number
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}px), 1fr))`,
        gap: 18,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  )
}