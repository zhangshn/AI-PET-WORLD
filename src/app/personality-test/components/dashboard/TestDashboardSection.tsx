/**
 * 当前文件负责：展示 personality-test 页面的大区块标题。
 */

export function TestDashboardSection({
  index,
  title,
  description,
  children,
}: {
  index: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 26 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            width: 34,
            height: 34,
            borderRadius: 12,
            background: "#111827",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            fontSize: 14,
            boxShadow: "0 8px 18px rgba(17, 24, 39, 0.16)",
          }}
        >
          {index}
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#667085",
              lineHeight: 1.7,
              maxWidth: 980,
            }}
          >
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  )
}