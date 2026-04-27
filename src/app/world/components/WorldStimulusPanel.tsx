/**
 * 当前文件负责：
 * 1. 世界刺激面板
 * 2. 展示当前世界中的 active stimuli
 * 3. 中英文双语展示
 */

import type { WorldStimulus } from "@/ai/gateway"

import styles from "@/styles/world-styles/world-stimulus-panel.module.css"

type Props = {
  stimuli: WorldStimulus[]
}

export default function WorldStimulusPanel({
  stimuli,
}: Props) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        世界刺激 / World Stimuli
      </h2>

      <div className={styles.list}>
        {stimuli.length === 0 && (
          <p className={styles.empty}>
            当前没有活跃刺激 / No active stimuli
          </p>
        )}

        {stimuli.map((stimulus) => (
          <div
            key={stimulus.id}
            className={styles.card}
          >
            <div className={styles.row}>
              <span>类型 / Type</span>
              <span>{stimulus.type}</span>
            </div>

            <div className={styles.row}>
              <span>分类 / Category</span>
              <span>{stimulus.category}</span>
            </div>

            <div className={styles.row}>
              <span>强度 / Intensity</span>
              <span>{stimulus.intensity}</span>
            </div>

            <p className={styles.summary}>
              {stimulus.summary}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}