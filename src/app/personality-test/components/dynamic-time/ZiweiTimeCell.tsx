/**
 * 当前文件负责：展示紫微动态时间表中的单个时间按钮。
 */

export function ZiweiTimeCell({
  title,
  subtitle,
  selected,
  disabled,
  onClick
}: {
  title: string
  subtitle?: string
  selected?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minWidth: 82,
        minHeight: 46,
        padding: "6px 8px",
        border: selected ? "2px solid #722ed1" : "1px solid #ddd",
        background: selected ? "#f9f0ff" : "#fff",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        textAlign: "center",
        lineHeight: 1.4
      }}
    >
      <div style={{ fontWeight: selected ? 700 : 500 }}>
        {title}
      </div>

      {subtitle && (
        <div style={{ fontSize: 11, color: "#666" }}>
          {subtitle}
        </div>
      )}
    </button>
  )
}