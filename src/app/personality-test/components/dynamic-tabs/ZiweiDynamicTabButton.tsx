/**
 * 当前文件负责：展示单个紫微动态层切换按钮。
 */

import type { ActiveDynamicFlow } from "../../types"

export function ZiweiDynamicTabButton({
  flow,
  label,
  description,
  active,
  onClick
}: {
  flow: ActiveDynamicFlow
  label: string
  description: string
  active: boolean
  onClick: (flow: ActiveDynamicFlow) => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick(flow)
      }}
      title={description}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: active ? "1px solid #722ed1" : "1px solid #ddd",
        background: active ? "#722ed1" : "#fff",
        color: active ? "#fff" : "#333",
        cursor: "pointer",
        fontWeight: active ? 700 : 500,
        lineHeight: 1.2
      }}
    >
      {label}
    </button>
  )
}