/**
 * 当前文件负责：展示宠物 AI 学习层的开发审计信息。
 */

import type { PetState } from "@/types/pet"

import styles from "@/styles/world-styles/debug/pet-learning-debug-panel.module.css"

type Props = {
  pet: PetState | null
}

function formatLearningValue(value: number | undefined): string {
  if (value === undefined) return "-"

  return String(Math.round(value))
}

export default function PetLearningDebugPanel({ pet }: Props) {
  if (!pet) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>
          宠物学习审计 / Pet Learning Audit
        </h2>

        <p className={styles.empty}>
          当前没有宠物，学习层尚未运行。
        </p>
      </section>
    )
  }

  const learning = pet.learningState

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        宠物学习审计 / Pet Learning Audit
      </h2>

      <div className={styles.content}>
        <div className={styles.row}>
          <span>食物熟悉度 / Food Familiarity</span>
          <span>{formatLearningValue(learning.foodFamiliarity)}</span>
        </div>

        <div className={styles.row}>
          <span>休息熟悉度 / Rest Familiarity</span>
          <span>{formatLearningValue(learning.restFamiliarity)}</span>
        </div>

        <div className={styles.row}>
          <span>管家信任学习 / Butler Trust</span>
          <span>{formatLearningValue(learning.butlerTrustLearning)}</span>
        </div>

        <div className={styles.row}>
          <span>靠近安全学习 / Approach Safety</span>
          <span>{formatLearningValue(learning.approachSafetyLearning)}</span>
        </div>

        <div className={styles.row}>
          <span>最近更新 Tick / Last Updated</span>
          <span>{learning.lastUpdatedTick ?? "-"}</span>
        </div>

        <div className={styles.summaryBox}>
          <div className={styles.summaryTitle}>
            Learning Summaries
          </div>

          {learning.summaries.length > 0 ? (
            <ul className={styles.summaryList}>
              {learning.summaries.map((summary) => (
                <li key={summary}>{summary}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              暂无稳定学习摘要。
            </p>
          )}

          <p className={styles.note}>
            learning 只作为机会判断的轻量加权输入，不直接控制 action / drive / goal。
          </p>
        </div>
      </div>
    </section>
  )
}