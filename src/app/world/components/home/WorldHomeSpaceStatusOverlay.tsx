"use client"

/**
 * 当前文件负责：在正式世界舞台上展示家园空间摘要。
 */

import type {
  HomeSpaceId,
  HomeState,
} from "@/types/home"

import styles from "@/styles/world-styles/home/world-home-space-status-overlay.module.css"

type Props = {
  home: HomeState | null
}

function formatCountLabel(count: number, label: string): string {
  return `${label} ${count}`
}

function formatSpaceIds(spaceIds: HomeSpaceId[]): string {
  if (spaceIds.length === 0) return "暂无"

  return spaceIds.join(" / ")
}

export default function WorldHomeSpaceStatusOverlay({
  home,
}: Props) {
  const summary = home?.spaceSummary

  if (!home || !summary) {
    return (
      <section className={styles.panel}>
        <div className={styles.kicker}>Home Space</div>
        <h2 className={styles.title}>家园空间正在初始化</h2>
        <p className={styles.description}>
          管家正在确认最初的空地、宠物抵达点和临时住所。
        </p>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <div className={styles.kicker}>Home Space</div>

      <h2 className={styles.title}>
        {summary.primarySpaceName}
      </h2>

      <p className={styles.description}>
        {summary.summary}
      </p>

      <div className={styles.metrics}>
        <span>
          {formatCountLabel(summary.activeSpaceIds.length, "已激活")}
        </span>
        <span>
          {formatCountLabel(summary.buildingSpaceIds.length, "建设中")}
        </span>
        <span>
          {formatCountLabel(summary.activitySpaceIds.length, "可活动")}
        </span>
        <span>
          {formatCountLabel(summary.maintenanceSpaceIds.length, "需维护")}
        </span>
      </div>

      <div className={styles.detailGrid}>
        <div>
          <span className={styles.detailLabel}>建设空间</span>
          <strong>{formatSpaceIds(summary.buildingSpaceIds)}</strong>
        </div>

        <div>
          <span className={styles.detailLabel}>可活动空间</span>
          <strong>{formatSpaceIds(summary.activitySpaceIds)}</strong>
        </div>

        <div>
          <span className={styles.detailLabel}>舒适度</span>
          <strong>{summary.overallComfort}</strong>
        </div>

        <div>
          <span className={styles.detailLabel}>稳定度</span>
          <strong>{summary.overallStability}</strong>
        </div>
      </div>
    </section>
  )
}
