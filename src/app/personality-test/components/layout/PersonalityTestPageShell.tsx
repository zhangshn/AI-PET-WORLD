/**
 * 当前文件负责：提供 personality-test 页面的整体外壳布局。
 */

export function PersonalityTestPageShell({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: 20,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#f7f7f7",
        minHeight: "100vh"
      }}
    >
      {children}
    </div>
  )
}