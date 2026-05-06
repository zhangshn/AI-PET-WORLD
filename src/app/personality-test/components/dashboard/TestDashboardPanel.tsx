/**
 * 当前文件负责：提供 personality-test 页面内部功能面板。
 */

export function TestDashboardPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: "1px solid #e8e8e8",
        borderRadius: 18,
        padding: 18,
        background: "#fff",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 17,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              color: "#667085",
              lineHeight: 1.65,
              fontSize: 14,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  )
}