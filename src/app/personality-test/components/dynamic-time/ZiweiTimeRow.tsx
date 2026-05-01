/**
 * 当前文件负责：展示紫微动态时间表中的单行时间分组。
 */

export function ZiweiTimeRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px minmax(0, 1fr)",
        gap: 8,
        alignItems: "center",
        borderTop: "1px solid #eee",
        padding: "8px 0"
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8
        }}
      >
        {children}
      </div>
    </div>
  )
}