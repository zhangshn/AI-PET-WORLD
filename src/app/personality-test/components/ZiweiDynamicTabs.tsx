"use client"

/**
 * 当前文件负责：提供紫微动态流切换按钮。
 */

import { DYNAMIC_FLOW_LABELS } from "../constants"
import type { ActiveDynamicFlow } from "../types"

const FLOW_ORDER: ActiveDynamicFlow[] = [
  "natal",
  "daYun",
  "liuNian",
  "liuYue",
  "liuRi",
  "liuShi"
]

export function ZiweiDynamicTabs({
  activeFlow,
  onChange
}: {
  activeFlow: ActiveDynamicFlow
  onChange: (flow: ActiveDynamicFlow) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 16
      }}
    >
      {FLOW_ORDER.map((flow) => {
        const isActive = flow === activeFlow

        return (
          <button
            key={flow}
            type="button"
            onClick={() => onChange(flow)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: isActive ? "2px solid #722ed1" : "1px solid #ddd",
              background: isActive ? "#f9f0ff" : "#fff",
              color: isActive ? "#531dab" : "#333",
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer"
            }}
          >
            {DYNAMIC_FLOW_LABELS[flow] ?? flow}
          </button>
        )
      })}
    </div>
  )
}