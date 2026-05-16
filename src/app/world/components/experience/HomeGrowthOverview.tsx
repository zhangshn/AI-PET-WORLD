/**
 * 当前文件负责展示家园成长区域。
 */

import type { WorldExperienceModel } from "@/world/visualization/world-experience-schema"

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type HomeGrowthOverviewProps = {
  homeGrowth: WorldExperienceModel["homeGrowth"]
}

export function HomeGrowthOverview({ homeGrowth }: HomeGrowthOverviewProps) {
  return (
    <section style={{ ...styles.card, ...styles.fullWidth }}>
      <h2 style={styles.cardTitle}>家园正在长出来</h2>
      <div style={styles.zoneGrid}>
        {homeGrowth.zones.map((zone) => (
          <article
            key={zone.id}
            style={{
              ...styles.zoneCard,
              borderColor: getZoneBorderColor(zone.status),
            }}
          >
            <span
              style={{
                ...styles.badge,
                background: getZoneBadgeColor(zone.status),
              }}
            >
              {getZoneStatusLabel(zone.status)}
            </span>
            <p style={{ ...styles.strong, marginTop: "12px" }}>{zone.label}</p>
            <p style={styles.body}>{zone.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function getZoneStatusLabel(
  status: WorldExperienceModel["homeGrowth"]["zones"][number]["status"]
): string {
  const labels: Record<
    WorldExperienceModel["homeGrowth"]["zones"][number]["status"],
    string
  > = {
    pending: "未开始",
    active: "整理中",
    completed: "已完成",
    observing: "观察中",
  }

  return labels[status]
}

function getZoneBadgeColor(
  status: WorldExperienceModel["homeGrowth"]["zones"][number]["status"]
): string {
  if (status === "active") return "#ffe082"
  if (status === "completed") return "#c8e6c9"
  if (status === "observing") return "#bbdefb"
  return "#d8d2c4"
}

function getZoneBorderColor(
  status: WorldExperienceModel["homeGrowth"]["zones"][number]["status"]
): string {
  if (status === "active") return "rgba(255, 224, 130, 0.46)"
  if (status === "completed") return "rgba(200, 230, 201, 0.42)"
  if (status === "observing") return "rgba(187, 222, 251, 0.32)"
  return "rgba(224, 218, 199, 0.14)"
}
