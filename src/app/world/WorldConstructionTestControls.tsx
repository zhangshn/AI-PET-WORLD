"use client"

/**
 * 当前文件负责：提供 MVP 建设闭环临时调试按钮。
 */

import type { ConstructionPlan } from "@/world/construction/construction-schema"

export type WorldConstructionTestControlsProps = {
  currentConstructionPlan: ConstructionPlan | null
  constructionMessage: string
  autoAdvanceIntervalTicks: number
  lastAutoConstructionTick: number | null
  localSnapshotLoaded: boolean
  onAdvanceConstruction: () => void
  onResetLocalHomeMap: () => void
}

export function WorldConstructionTestControls({
  currentConstructionPlan,
  constructionMessage,
  autoAdvanceIntervalTicks,
  lastAutoConstructionTick,
  localSnapshotLoaded,
  onAdvanceConstruction,
  onResetLocalHomeMap,
}: WorldConstructionTestControlsProps) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(16, 32, 15, 0.88)",
        color: "#f6f1d5",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        left: 16,
        maxWidth: "min(820px, calc(100vw - 32px))",
        padding: "10px 12px",
        position: "fixed",
        top: 16,
        zIndex: 1000,
      }}
    >
      <button type="button" onClick={onAdvanceConstruction}>
        手动推进管家建设 +1 阶段
      </button>
      <button type="button" onClick={onResetLocalHomeMap}>
        重置本地家园
      </button>
      <span>当前阶段：{currentConstructionPlan?.currentStage ?? "未开始"}</span>
      <span>自动建设：已启用</span>
      <span>推进频率：每 {autoAdvanceIntervalTicks} ticks</span>
      <span>
        最近自动推进 tick：
        {lastAutoConstructionTick === null ? "暂无" : lastAutoConstructionTick}
      </span>
      <span>本地家园状态：{localSnapshotLoaded ? "已恢复" : "读取中"}</span>
      <span>世界时间推进时，管家会按周期整理家园。</span>
      <span>当前为 MVP 本地保存，刷新页面后会恢复本地家园状态。</span>
      <span>{constructionMessage}</span>
      <span>玩家不是直接建造；这些按钮只是开发期调试入口。</span>
    </div>
  )
}
