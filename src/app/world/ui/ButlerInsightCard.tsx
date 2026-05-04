/**
 * 当前文件负责：展示正式 world 页中的管家观察摘要。
 */

import type { ButlerState } from "@/types/butler"

import {
  buildButlerSummary,
  getButlerMoodLabel,
  getButlerOpportunityLabel,
  getButlerTaskLabel,
} from "../utils/butlerDisplayMappers"

import styles from "@/styles/world-styles/cards/butler-insight-card.module.css"

type Props = {
  butler: ButlerState | null
}

export default function ButlerInsightCard({ butler }: Props) {
  if (!butler) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>BUTLER</div>
            <h2 className={styles.title}>管家未就位</h2>
          </div>

          <div className={styles.badge}>等待中</div>
        </div>

        <p className={styles.description}>
          世界还没有读取到管家状态。
        </p>
      </section>
    )
  }

  const opportunities = butler.pendingOpportunities ?? []

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>BUTLER</div>
          <h2 className={styles.title}>{butler.name}</h2>
        </div>

        <div className={styles.badge}>
          {getButlerMoodLabel(butler.mood)}
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <span>当前任务</span>
          <strong>{getButlerTaskLabel(butler.task)}</strong>
        </div>

        <div>
          <span>情绪状态</span>
          <strong>{getButlerMoodLabel(butler.mood)}</strong>
        </div>

        <div>
          <span>待处理机会</span>
          <strong>{opportunities.length}</strong>
        </div>
      </div>

      <p className={styles.description}>
        {buildButlerSummary(butler)}
      </p>

      {opportunities.length > 0 && (
        <div className={styles.opportunityList}>
          {opportunities.slice(0, 3).map((opportunity) => (
            <div className={styles.opportunityItem} key={opportunity.id}>
              <span>{getButlerOpportunityLabel(opportunity.type)}</span>
              <strong>{Math.round(opportunity.intensity)}</strong>
            </div>
          ))}
        </div>
      )}

      <p className={styles.note}>
        管家是机会提供者，不是宠物控制器。
      </p>
    </section>
  )
}