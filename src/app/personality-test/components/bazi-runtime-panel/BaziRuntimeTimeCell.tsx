/**
 * 当前文件负责：提供八字动态时间选择按钮。
 */

import type { CSSProperties } from "react"

export function BaziRuntimeTimeCell({
  title,
  subtitle,
  selected,
  onClick
}: {
  title: string
  subtitle?: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 76,
        padding: "8px 10px",
        borderRadius: 8,
        border: selected ? "2px solid #7c3aed" : "1px solid #ddd",
        background: selected ? "#f4edff" : "#fff",
        cursor: "pointer",
        fontWeight: selected ? 800 : 600,
        lineHeight: 1.35
      }}
    >
      <div>{title}</div>

      {subtitle && (
        <div style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>
          {subtitle}
        </div>
      )}
    </button>
  )
}

export const baziRuntimeRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
}

export const baziRuntimeRowLabelStyle: CSSProperties = {
  width: 56,
  fontWeight: 800,
}