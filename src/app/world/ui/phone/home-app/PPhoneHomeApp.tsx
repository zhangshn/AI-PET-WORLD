/**
 * 当前文件负责：展示 P-Phone 家园应用。
 */

import type { PhoneDetailPageData } from "../../../utils/phoneDetailMappers"
import type {
  WorldFacilityId,
  WorldFacilityStatus,
  WorldProgressionState,
} from "@/world/progression/world-progression-gateway"
import type { PPhoneIconKind } from "../PPhoneTypes"

import {
  WORLD_FACILITY_DEFINITIONS,
} from "@/world/progression/world-progression-gateway"

import PPhoneIcon from "../PPhoneIcon"

import styles from "@/styles/world-styles/phone/home-app/p-phone-home-app.module.css"

type Props = {
  detail: PhoneDetailPageData
  progression: WorldProgressionState | null
  onBack: () => void
}

type HomeModuleCard = {
  id: string
  title: string
  value: string
  subtitle: string
  icon: PPhoneIconKind
  status?: WorldFacilityStatus
}

const STATUS_LABELS: Record<WorldFacilityStatus, string> = {
  locked: "未开放",
  planning: "规划中",
  building: "建设中",
  active: "已开放",
}

const FACILITY_ICON_MAP: Record<WorldFacilityId, PPhoneIconKind> = {
  home_base: "home",
  community_board: "community",
  pet_park: "park",
  pet_clinic: "clinic",
  small_town: "town",
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

function getAverageWorldProgress(progression: WorldProgressionState | null): number {
  if (!progression) return 0

  const totalProgress = WORLD_FACILITY_DEFINITIONS.reduce((total, definition) => {
    return total + getFacilityProgress(progression, definition.id).progress
  }, 0)

  return Math.round(totalProgress / WORLD_FACILITY_DEFINITIONS.length)
}

function getHomeStageValue(detail: PhoneDetailPageData): string {
  const stageRow = detail.sections
    .flatMap((section) => section.rows)
    .find((row) => row.label === "阶段")

  return stageRow?.value ?? detail.statusLabel
}

function getHomeLevelValue(detail: PhoneDetailPageData): string {
  const levelRow = detail.sections
    .flatMap((section) => section.rows)
    .find((row) => row.label === "等级")

  return levelRow?.value ?? detail.subtitle
}

function getModuleCards(input: {
  detail: PhoneDetailPageData
  progression: WorldProgressionState | null
}): HomeModuleCard[] {
  const activeCount = countFacilitiesByStatus(input.progression, "active")
  const buildingCount = countFacilitiesByStatus(input.progression, "building")
  const planningCount = countFacilitiesByStatus(input.progression, "planning")
  const lockedCount = countFacilitiesByStatus(input.progression, "locked")
  const averageProgress = getAverageWorldProgress(input.progression)

  return [
    {
      id: "home-status",
      title: "家园状态",
      value: input.detail.statusLabel,
      subtitle: getHomeStageValue(input.detail),
      icon: "home",
    },
    {
      id: "world-progress",
      title: "世界设施",
      value: `${activeCount}/${WORLD_FACILITY_DEFINITIONS.length}`,
      subtitle: `总进度 ${averageProgress}%`,
      icon: "world",
    },
    {
      id: "active-facilities",
      title: "当前开放",
      value: String(activeCount),
      subtitle: "可用区域",
      icon: "open",
      status: "active",
    },
    {
      id: "building-facilities",
      title: "建设中",
      value: String(buildingCount),
      subtitle: "正在推进",
      icon: "build",
      status: "building",
    },
    {
      id: "future-facilities",
      title: "未来区域",
      value: String(planningCount + lockedCount),
      subtitle: "等待开放",
      icon: "future",
      status: "locked",
    },
    {
      id: "eco-zone",
      title: "生态区",
      value: getHomeLevelValue(input.detail),
      subtitle: "初始区域",
      icon: "eco",
    },
  ]
}

function getIconBoxClassName(status?: WorldFacilityStatus): string {
  const classNames = [styles.iconBox]

  if (status === "active") classNames.push(styles.activeIconBox)
  if (status === "building") classNames.push(styles.buildingIconBox)
  if (status === "planning") classNames.push(styles.planningIconBox)
  if (status === "locked") classNames.push(styles.lockedIconBox)

  return classNames.join(" ")
}

function renderFacilityTile(input: {
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
    <article className={styles.facilityTile} key={definition.id}>
      <span className={getIconBoxClassName(facility.status)}>
        <PPhoneIcon kind={FACILITY_ICON_MAP[definition.id]} />
      </span>

      <div className={styles.facilityTileText}>
        <strong>{definition.title}</strong>
        <span>{STATUS_LABELS[facility.status]}</span>
      </div>

      <em>{progressValue}%</em>
    </article>
  )
}

export default function PPhoneHomeApp({
  detail,
  progression,
  onBack,
}: Props) {
  const moduleCards = getModuleCards({
    detail,
    progression,
  })

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

      <section className={styles.homeHero}>
        <span className={`${styles.iconBox} ${styles.homeIconBox}`}>
          <PPhoneIcon kind="home" size="large" />
        </span>

        <div>
          <p>{detail.statusLabel}</p>
          <h3>{detail.subtitle}</h3>
          <span>{getHomeStageValue(detail)}</span>
        </div>
      </section>

      <section className={styles.moduleGrid} aria-label="家园模块">
        {moduleCards.map((module) => (
          <article className={styles.moduleTile} key={module.id}>
            <span className={getIconBoxClassName(module.status)}>
              <PPhoneIcon kind={module.icon} />
            </span>

            <div>
              <strong>{module.value}</strong>
              <span>{module.title}</span>
              <small>{module.subtitle}</small>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.phoneSection}>
        <div className={styles.sectionTitle}>
          <h4>设施网格</h4>
          <span>World Grid</span>
        </div>

        {!progression && (
          <article className={styles.emptyWorldProgress}>
            世界设施状态正在同步。
          </article>
        )}

        {progression && (
          <div className={styles.facilityGrid}>
            {WORLD_FACILITY_DEFINITIONS.map((definition) =>
              renderFacilityTile({
                progression,
                facilityId: definition.id,
              })
            )}
          </div>
        )}
      </section>
    </div>
  )
}