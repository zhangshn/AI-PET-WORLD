/**
 * 当前文件负责展示管家自主任务流。
 */

import type { ButlerTaskSummary } from "@/world/visualization/world-visualization-schema"

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type ButlerTaskFlowProps = {
  butler: ButlerTaskSummary
}

export function ButlerTaskFlow({ butler }: ButlerTaskFlowProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>Butler Task Flow</h2>
      <p style={styles.sectionHint}>
        管家不是工具人。这里展示它如何根据宠物需求和世界状态自主判断。
      </p>
      <TaskBlock label="当前任务" value={butler.currentTask} />
      <TaskBlock label="任务原因" value={butler.taskReason} />
      <TaskBlock label="下一步判断" value={butler.nextLikelyAction} />
      <div style={{ marginTop: "12px" }}>
        <span
          style={{
            ...styles.badge,
            background: getAutonomyColor(butler.autonomyLevel),
          }}
        >
          自主等级：{getAutonomyLabel(butler.autonomyLevel)}
        </span>
      </div>
    </section>
  )
}

function TaskBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: "12px" }}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.strongText}>{value}</p>
    </div>
  )
}

function getAutonomyLabel(level: ButlerTaskSummary["autonomyLevel"]): string {
  const labels: Record<ButlerTaskSummary["autonomyLevel"], string> = {
    observing: "观察中",
    planning: "规划中",
    building: "建设中",
    completed: "已完成",
  }

  return labels[level]
}

function getAutonomyColor(level: ButlerTaskSummary["autonomyLevel"]): string {
  if (level === "building") return "#f6e05e"
  if (level === "completed") return "#9ae6b4"
  if (level === "planning") return "#90cdf4"
  return "#cbd5e0"
}
