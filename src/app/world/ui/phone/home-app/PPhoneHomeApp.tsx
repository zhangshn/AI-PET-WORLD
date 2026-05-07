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

const MODULE_LABELS: Record<WorldFacilityStatus, string> = {
  locked: "未来区域",
  planning: "规划中",
  building: "建设中",
  active: "已开放",
}

function getFacilityProgress(
  progression: WorldProgressionState,
  facilityId: WorldFacilityId
) {
  return progression.facilities[facilityId]
}

function countFacilitiesByStatus(
  progression: WorldProgressionState | null,
  status: WorldFacilityStatus
): number {
  if (!progression) return 0

  return WORLD_FACILITY_DEFINITIONS.filter((definition) => {
    return getFacilityProgress(progression, definition.id).status === status
  }).length
}

function countActiveFacilities(progression: WorldProgressionState | null): number {
  return countFacilitiesByStatus(progression, "active")
}

function getWorldProgressSummary(progression: WorldProgressionState | null): string {
  if (!progression) return "世界设施状态正在同步。"

  const activeCount = countActiveFacilities(progression)

  if (activeCount === 0) {
    return "初始生态区正在建设，管家会优先维持基础环境。"
  }

  if (activeCount < WORLD_FACILITY_DEFINITIONS.length) {
    return "世界正在逐步扩展，新的设施会在合适阶段开放。"
  }

  return "初始生态区的核心设施已经开放。"
}

function getStatusClassName(status: WorldFacilityStatus): string {
  if (status === "active") return styles.activeStatus
  if (status === "building") return styles.buildingStatus
  if (status === "planning") return styles.planningStatus

  return styles.lockedStatus
}

function getPrimaryHomeRows(detail: PhoneDetailPageData) {
  return detail.sections.flatMap((section) => section.rows).slice(0, 4)
}

function getFacilitiesByStatus(
  progression: WorldProgressionState,
  status: WorldFacilityStatus
) {
  return WORLD_FACILITY_DEFINITIONS.filter((definition) => {
    return getFacilityProgress(progression, definition.id).status === status
  })
}

function renderFacilityMiniCard(input: {
  progression: WorldProgressionState
  facilityId: WorldFacilityId
}) {
  const definition = WORLD_FACILITY_DEFINITIONS.find(
    (item) => item.id === input.facilityId
  )

  if (!definition) return null

  const facility = getFacilityProgress(input.progression, definition.id)
  const progressValue = Math.round(facility.progress)

  return (
    <article className={styles.facilityMiniCard} key={definition.id}>
      <div className={styles.facilityMiniTop}>
        <strong>{definition.title}</strong>
        <em className={getStatusClassName(facility.status)}>
          {STATUS_LABELS[facility.status]}
        </em>
      </div>

      <p>{definition.description}</p>

      <div className={styles.facilityMeter}>
        <i style={{ width: `${progressValue}%` }} />
      </div>

      <small>{progressValue}%</small>
    </article>
  )
}

export default function PPhoneHomeApp({
  detail,
  progression,
  onBack,
}: Props) {
  const activeFacilityCount = countActiveFacilities(progression)
  const buildingCount = countFacilitiesByStatus(progression, "building")
  const planningCount = countFacilitiesByStatus(progression, "planning")
  const lockedCount = countFacilitiesByStatus(progression, "locked")
  const homeRows = getPrimaryHomeRows(detail)

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

      <section className={styles.heroCard}>
        <p>{detail.statusLabel}</p>
        <h3>{detail.subtitle}</h3>
        <span>{detail.summary}</span>
      </section>

      <section className={styles.moduleGrid}>
        <article className={styles.moduleCard}>
          <small>家园状态</small>
          <strong>{detail.statusLabel}</strong>
          <span>当前阶段</span>
        </article>

        <article className={styles.moduleCard}>
          <small>世界设施</small>
          <strong>
            {activeFacilityCount}/{WORLD_FACILITY_DEFINITIONS.length}
          </strong>
          <span>已开放</span>
        </article>

        <article className={styles.moduleCard}>
          <small>建设中</small>
          <strong>{buildingCount}</strong>
          <span>正在推进</span>
        </article>

        <article className={styles.moduleCard}>
          <small>未来区域</small>
          <strong>{lockedCount + planningCount}</strong>
          <span>等待开放</span>
        </article>
      </section>

      <section className={styles.phoneSection}>
        <div className={styles.sectionTitle}>
          <h4>家园概览</h4>
          <span>Home Status</span>
        </div>

        <div className={styles.homeStatGrid}>
          {homeRows.map((row) => (
            <article className={styles.homeStatCard} key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>

              {row.meter && (
                <div className={styles.facilityMeter}>
                  <i
                    style={{
                      width: `${Math.min(100, Math.max(0, row.meter.value))}%`,
                    }}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.phoneSection}>
        <div className={styles.sectionTitle}>
          <h4>世界设施</h4>
          <span>{getWorldProgressSummary(progression)}</span>
        </div>

        {!progression && (
          <article className={styles.emptyWorldProgress}>
            世界设施状态正在同步。
          </article>
        )}

        {progression && (
          <div className={styles.facilityModuleList}>
            {(["active", "building", "planning", "locked"] as const).map(
              (status) => {
                const facilities = getFacilitiesByStatus(progression, status)

                if (facilities.length === 0) return null

                return (
                  <section className={styles.facilityGroup} key={status}>
                    <div className={styles.facilityGroupTitle}>
                      <strong>{MODULE_LABELS[status]}</strong>
                      <span>{facilities.length}</span>
                    </div>

                    <div className={styles.facilityList}>
                      {facilities.map((definition) =>
                        renderFacilityMiniCard({
                          progression,
                          facilityId: definition.id,
                        })
                      )}
                    </div>
                  </section>
                )
              }
            )}
          </div>
        )}
      </section>
    </div>
  )
}