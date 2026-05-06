/**
 * 当前文件负责：提供 personality-test 页面的整体外壳布局。
 */

export function PersonalityTestPageShell({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f6f7fb 0%, #f8f8f8 48%, #f3f4f6 100%)",
        padding: "24px 18px 48px",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1560,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </main>
  )
}