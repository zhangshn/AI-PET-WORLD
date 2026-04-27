/**
 * 当前文件负责：
 * 1. 展示宠物最新认知结果
 * 2. 作为开发调试面板的一部分
 * 3. 不接收世界事件 events，避免和 EventLogPanel 混用
 */

import type { PetCognitionRecord } from "@/types/cognition"

import styles from "@/styles/world-styles/cognition-panel.module.css"

type Props = {
  cognition?: PetCognitionRecord | null
}

function formatValue(value: number | undefined): string {
  if (value === undefined) return "-"
  return String(Math.round(value))
}

export default function CognitionPanel({ cognition }: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>宠物认知 / Cognition</h2>
      </div>

      {!cognition && (
        <p className={styles.empty}>
          当前还没有新的认知记录。
        </p>
      )}

      {cognition && (
        <div className={styles.content}>
          <div className={styles.metaGrid}>
            <div>
              <span>刺激</span>
              <strong>{cognition.stimulusType}</strong>
            </div>

            <div>
              <span>解释</span>
              <strong>{cognition.interpretation}</strong>
            </div>

            <div>
              <span>反应倾向</span>
              <strong>{cognition.reactionTendency}</strong>
            </div>

            <div>
              <span>时间</span>
              <strong>
                Day {cognition.day} · {cognition.hour}:00
              </strong>
            </div>
          </div>

          <p className={styles.summary}>
            {cognition.summary}
          </p>

          <div className={styles.valueList}>
            <div>
              <span>好奇</span>
              <strong>{formatValue(cognition.curiosityLevel)}</strong>
            </div>

            <div>
              <span>压力</span>
              <strong>{formatValue(cognition.stressLevel)}</strong>
            </div>

            <div>
              <span>安全感</span>
              <strong>{formatValue(cognition.safetyFeeling)}</strong>
            </div>

            <div>
              <span>情绪偏移</span>
              <strong>{formatValue(cognition.emotionalShift)}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}