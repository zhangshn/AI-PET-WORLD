/**
 * 当前文件负责：展示正式 world 页中的家园状态摘要。
 */

import type { HomeState } from "@/types/home"

import {
  buildHomeSummary,
  clampHomeMeterValue,
  getHomeFocusLabel,
  getHomeProgressLabel,
  getHomeStageLabel,
  getHomeStatusLabel,
} from "../utils/homeDisplayMappers"

import styles from "@/styles/world-styles/home-insight-card.module.css"

type Props = {
  home: HomeState | null
}

export default function HomeInsightCard({ home }: Props) {
  if (!home) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>HOME</div>
            <h2 className={styles.title}>家园未生成</h2>
          </div>

          <div className={styles.badge}>等待中</div>
        </div>

        <p className={styles.description}>
          世界还没有读取到家园状态。
        </p>
      </section>
    )
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>HOME</div>
          <h2 className={styles.title}>家园状态</h2>
        </div>

        <div className={styles.badge}>
          {getHomeStatusLabel(home.status)}
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <span>等级</span>
          <strong>Lv.{home.level}</strong>
        </div>

        <div>
          <span>建设阶段</span>
          <strong>{getHomeStageLabel(home.constructionStage)}</strong>
        </div>

        <div>
          <span>成长方向</span>
          <strong>{getHomeFocusLabel(home.evolutionFocus)}</strong>
        </div>

        <div>
          <span>总进度</span>
          <strong>{getHomeProgressLabel(home.progress)}</strong>
        </div>

        <div>
          <span>庭院进度</span>
          <strong>{getHomeProgressLabel(home.gardenProgress)}</strong>
        </div>

        <div>
          <span>舒适度</span>
          <strong>{Math.round(home.comfort)}</strong>
        </div>
      </div>

      <div className={styles.meterGroup}>
        <div>
          <span>稳定</span>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{
                width: `${clampHomeMeterValue(home.stability)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <span>扩展</span>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{
                width: `${clampHomeMeterValue(home.expansion)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <p className={styles.description}>
        {buildHomeSummary(home)}
      </p>
    </section>
  )
}