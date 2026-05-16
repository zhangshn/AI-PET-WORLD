"use client"

/**
 * 当前文件负责：提供 MVP 建设闭环临时测试按钮。
 */

import type { ConstructionPlan } from "@/world/construction/construction-schema"

export type WorldConstructionTestControlsProps = {
  currentConstructionPlan: ConstructionPlan | null
  constructionMessage: string
  onAdvanceConstruction: () => void
}

export function WorldConstructionTestControls({
  currentConstructionPlan,
  constructionMessage,
  onAdvanceConstruction,
}: WorldConstructionTestControlsProps) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(16, 32, 15, 0.88)",
        color: "#f6f1d5",
        display: "flex",
        gap: 12,
        left: 16,
        padding: "10px 12px",
        position: "fixed",
        top: 16,
        zIndex: 1000,
      }}
    >
      <button type="button" onClick={onAdvanceConstruction}>
        推进管家建设 +1 阶段
      </button>
      <span>当前阶段：{currentConstructionPlan?.currentStage ?? "未开始"}</span>
      <span>{constructionMessage}</span>
    </div>
  )
}
