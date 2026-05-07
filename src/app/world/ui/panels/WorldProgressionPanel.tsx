/**
 * 当前文件负责：展示 MVP 世界设施进度。
 */

import type {
  WorldFacilityId,
  WorldFacilityStatus,
  WorldProgressionState,
} from "@/world/progression/world-progression-gateway"

import {
  WORLD_FACILITY_DEFINITIONS,
} from "@/world/progression/world-progression-gateway"

import styles from "@/styles/world-styles/layout/world-progression-panel.module.css"

type Props = {
  progression: WorldProgressionState | null
}

const STATUS_LABELS: Record<WorldFacilityStatus, string> = {
  locked: "未解锁",
  planning: "规划中",
  building: "建设中",
  active: "已开放",
}

function getStatusClassName(status: WorldFacilityStatus): string {
  if (status === "active") return styles.activeStatus
  if (status === "building") return styles.buildingStatus
  if (status === "planning") return styles.planningStatus

  return styles.lockedStatus
}

function getFacilityProgress(
  progression: WorldProgressionState,
  facilityId: WorldFacilityId
) {
  return progression.facilities[facilityId]
}

export default function WorldProgressionPanel({ progression }: Props) {
  if (!progression) {
    return (
      <article className={styles.panel}>
        <header className={styles.header}>
          <p>WORLD PROGRESSION</p>
          <h3>世界设施进度</h3>
        </header>

        <section className={styles.emptyState}>
          世界进度系统尚未初始化。
        </section>
      </article>
    )
  }

  const activeCount = WORLD_FACILITY_DEFINITIONS.filter((definition) => {
    return getFacilityProgress(progression, definition.id).status === "active"
  }).length

  return (
    <article className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>WORLD PROGRESSION</p>
          <h3>世界设施进度</h3>
        </div>

        <strong>
          {activeCount}/{WORLD_FACILITY_DEFINITIONS.length}
        </strong>
      </header>

      <div className={styles.facilityList}>
        {WORLD_FACILITY_DEFINITIONS.map((definition) => {
          const facility = getFacilityProgress(progression, definition.id)
          const progressValue = Math.round(facility.progress)

          return (
            <section className={styles.facilityCard} key={definition.id}>
              <div className={styles.facilityTop}>
                <div>
                  <h4>{definition.title}</h4>
                  <p>{definition.description}</p>
                </div>

                <span className={getStatusClassName(facility.status)}>
                  {STATUS_LABELS[facility.status]}
                </span>
              </div>

              <div className={styles.progressTrack}>
                <span style={{ width: `${progressValue}%` }} />
              </div>

              <div className={styles.facilityMeta}>
                <span>进度 {progressValue}%</span>
                <span>
                  开始 Day {facility.startedAtDay ?? "-"}
                </span>
                <span>
                  开放 Day {facility.activatedAtDay ?? "-"}
                </span>
              </div>
            </section>
          )
        })}
      </div>
    </article>
  )
}