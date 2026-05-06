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
    <section
      style={{
        border: "1px solid #e7e7e7",
        borderRadius: 16,
        padding: 18,
        background: "rgba(255, 255, 255, 0.96)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <h3
        style={{
          margin: "0 0 14px",
          fontSize: 17,
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>

      {children}
    </section>
  )
}