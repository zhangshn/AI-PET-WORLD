/**
 * 当前文件负责：展示 P-Phone 家园应用。
 */

import type { PhoneDetailPageData } from "../../../utils/phoneDetailMappers"
import type {
  WorldFacilityId,
  WorldFacilityStatus,
  WorldProgressionState,
} from "@/world/progression/world-progression-gateway"

import {
  WORLD_FACILITY_DEFINITIONS,
} from "@/world/progression/world-progression-gateway"

import styles from "@/styles/world-styles/phone/home-app/p-phone-home-app.module.css"

type Props = {
  detail: PhoneDetailPageData
  progression: WorldProgressionState | null
  onBack: () => void
}

const STATUS_LABELS: Record<WorldFacilityStatus, string> = {
  locked: "未开放",
  planning: "规划中",
  building: "建设中",
  active: "已开放",
}

const PLAYER_STATUS_DESCRIPTIONS: Record<WorldFacilityStatus, string> = {
  locked: "这个区域还没有进入建设阶段。",
  planning: "这个区域已经进入规划阶段，之后会逐步推进。",
  building: "这个区域正在建设中，世界会继续自己推进。",
  active: "这个区域已经开放，后续会参与世界运行。",
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

function countActiveFacilities(progression: WorldProgressionState | null): number {
  if (!progression) return 0

  return WORLD_FACILITY_DEFINITIONS.filter((definition) => {
    return getFacilityProgress(progression, definition.id).status === "active"
  }).length
}

function getWorldProgressSummary(progression: WorldProgressionState | null): string {
  if (!progression) {
    return "世界设施状态正在同步。"
  }

  const activeCount = countActiveFacilities(progression)

  if (activeCount === 0) {
    return "初始生态区仍在建设，管家会优先维持基础环境。"
  }

  if (activeCount < WORLD_FACILITY_DEFINITIONS.length) {
    return "世界正在逐步扩展，新的设施会在合适阶段开放。"
  }

  return "初始生态区的核心设施已经开放。"
}

export default function PPhoneHomeApp({
  detail,
  progression,
  onBack,
}: Props) {
  const activeFacilityCount = countActiveFacilities(progression)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          ‹
        </button>

        <div>
          <p>Home</p>
          <h2>家园</h2>
        </div>
      </header>

      <section className={styles.profileCard}>
        <p>{detail.statusLabel}</p>
        <h3>{detail.subtitle}</h3>
        <span>{detail.summary}</span>
      </section>

      <section className={styles.worldSummaryCard}>
        <div>
          <p>World Growth</p>
          <h3>世界设施</h3>
          <span>{getWorldProgressSummary(progression)}</span>
        </div>

        <strong>
          {activeFacilityCount}/{WORLD_FACILITY_DEFINITIONS.length}
        </strong>
      </section>

      <div className={styles.sectionList}>
        {detail.sections.map((section) => (
          <section className={styles.infoSection} key={section.title}>
            <h4>{section.title}</h4>

            {section.rows.map((row) => (
              <article className={styles.infoRow} key={`${section.title}-${row.label}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>

                {row.meter && (
                  <div className={styles.meterTrack}>
                    <div
                      className={styles.meterFill}
                      style={{
                        width: `${Math.min(100, Math.max(0, row.meter.value))}%`,
                      }}
                    />
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}

        <section className={styles.infoSection}>
          <h4>世界设施进度</h4>

          {!progression && (
            <article className={styles.emptyWorldProgress}>
              世界设施状态正在同步。
            </article>
          )}

          {progression &&
            WORLD_FACILITY_DEFINITIONS.map((definition) => {
              const facility = getFacilityProgress(progression, definition.id)
              const progressValue = Math.round(facility.progress)

              return (
                <article className={styles.facilityCard} key={definition.id}>
                  <div className={styles.facilityTop}>
                    <div>
                      <strong>{definition.title}</strong>
                      <span>{definition.description}</span>
                    </div>

                    <em className={getStatusClassName(facility.status)}>
                      {STATUS_LABELS[facility.status]}
                    </em>
                  </div>

                  <p>{PLAYER_STATUS_DESCRIPTIONS[facility.status]}</p>

                  <div className={styles.facilityMeter}>
                    <i style={{ width: `${progressValue}%` }} />
                  </div>

                  <div className={styles.facilityMeta}>
                    <span>进度 {progressValue}%</span>
                    <span>开放 Day {facility.activatedAtDay ?? "-"}</span>
                  </div>
                </article>
              )
            })}
        </section>
      </div>
    </div>
  )
}