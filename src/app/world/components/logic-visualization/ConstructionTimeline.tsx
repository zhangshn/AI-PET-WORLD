/**
 * 当前文件负责展示管家建设阶段时间线。
 */

import type { ConstructionTimelineSummary } from "@/world/visualization/world-visualization-schema"

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type ConstructionTimelineProps = {
  construction: ConstructionTimelineSummary
}

export function ConstructionTimeline({
  construction,
}: ConstructionTimelineProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>Construction Timeline</h2>
      <p style={styles.sectionHint}>
        管家按阶段推进建设计划，玩家观察世界变化，但不直接点击建造。
      </p>
      <div style={{ marginBottom: "14px" }}>
        <div style={styles.meterLabelRow}>
          <span>当前阶段：{construction.currentStage}</span>
          <span>{construction.progressPercent}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${construction.progressPercent}%`,
            }}
          />
        </div>
      </div>
      <div style={styles.timeline}>
        {construction.stages.map((stage) => (
          <div
            key={stage.id}
            style={{
              ...styles.timelineItem,
              borderColor: getStageBorderColor(stage.status),
              background: getStageBackground(stage.status),
            }}
          >
            <div
              style={{
                ...styles.timelineDot,
                color: getStageDotTextColor(stage.status),
                background: getStageDotColor(stage.status),
              }}
            >
              {stage.status === "done" ? "✓" : stage.status === "active" ? "●" : "…"}
            </div>
            <div>
              <p style={styles.strongText}>{stage.label}</p>
              <p style={styles.bodyText}>{stage.description}</p>
            </div>
          </div>
        ))}
      </div>
      <p style={{ ...styles.bodyText, marginTop: "14px" }}>
        最近消息：{construction.latestMessage}
      </p>
    </section>
  )
}

function getStageBorderColor(status: "done" | "active" | "pending"): string {
  if (status === "done") return "rgba(104, 211, 145, 0.42)"
  if (status === "active") return "rgba(99, 179, 237, 0.54)"
  return "rgba(128, 153, 190, 0.18)"
}

function getStageBackground(status: "done" | "active" | "pending"): string {
  if (status === "done") return "rgba(56, 161, 105, 0.08)"
  if (status === "active") return "rgba(49, 130, 206, 0.14)"
  return "rgba(255, 255, 255, 0.025)"
}

function getStageDotColor(status: "done" | "active" | "pending"): string {
  if (status === "done") return "#9ae6b4"
  if (status === "active") return "#90cdf4"
  return "rgba(143, 162, 189, 0.22)"
}

function getStageDotTextColor(status: "done" | "active" | "pending"): string {
  if (status === "pending") return "#a7b6cc"
  return "#07111e"
}
