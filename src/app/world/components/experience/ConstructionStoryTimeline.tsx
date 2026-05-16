/**
 * 当前文件负责展示用户化建设故事线。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type ConstructionStoryTimelineProps = {
  construction: WorldExperienceModel["construction"]
}

export function ConstructionStoryTimeline({
  construction,
}: ConstructionStoryTimelineProps) {
  return (
    <section style={{ ...styles.card, ...styles.fullWidth }}>
      <h2 style={styles.cardTitle}>管家的建设节奏</h2>
      <div style={{ marginBottom: "16px" }}>
        <div style={styles.meterRow}>
          <span>当前：{construction.currentStageLabel}</span>
          <span>{construction.progressPercent}%</span>
        </div>
        <div style={styles.track}>
          <div
            style={{
              ...styles.fill,
              width: `${construction.progressPercent}%`,
            }}
          />
        </div>
      </div>
      <div style={styles.timeline}>
        {construction.stages.map((stage) => (
          <article
            key={stage.id}
            style={{
              ...styles.timelineItem,
              border: `1px solid ${getStageBorderColor(stage.status)}`,
            }}
          >
            <div
              style={{
                ...styles.stepDot,
                color: stage.status === "pending" ? "#c4ced2" : "#172018",
                background: getStageDotColor(stage.status),
              }}
            >
              {stage.status === "done" ? "✓" : stage.status === "active" ? "●" : "…"}
            </div>
            <div>
              <p style={styles.strong}>{stage.label}</p>
              <p style={styles.body}>{stage.story}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function getStageDotColor(
  status: WorldExperienceModel["construction"]["stages"][number]["status"]
): string {
  if (status === "done") return "#c8e6c9"
  if (status === "active") return "#ffe082"
  return "rgba(216, 228, 225, 0.14)"
}

function getStageBorderColor(
  status: WorldExperienceModel["construction"]["stages"][number]["status"]
): string {
  if (status === "done") return "rgba(200, 230, 201, 0.42)"
  if (status === "active") return "rgba(255, 224, 130, 0.46)"
  return "rgba(224, 218, 199, 0.12)"
}
