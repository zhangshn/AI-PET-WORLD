/**
 * 当前文件负责：
 * 1. 行为过程面板
 * 2. 展示当前 active behavior process
 * 3. 中英文双语展示
 */

import type { ActiveBehaviorProcess } from "@/ai/gateway"

import styles from "@/styles/world-styles/behavior-process-panel.module.css"

type Props = {
  process: ActiveBehaviorProcess | null | undefined
}

export default function BehaviorProcessPanel({
  process,
}: Props) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        行为过程 / Behavior Process
      </h2>

      {!process && (
        <p className={styles.empty}>
          当前没有活跃行为过程 / No active behavior process
        </p>
      )}

      {process && (
        <div className={styles.content}>
          <div className={styles.row}>
            <span>类型 / Type</span>
            <span>{process.type}</span>
          </div>

          <div className={styles.row}>
            <span>阶段 / Stage</span>
            <span>{process.stage}</span>
          </div>

          <div className={styles.row}>
            <span>来源刺激 / Source Stimulus</span>
            <span>{process.sourceStimulusType}</span>
          </div>

          <div className={styles.row}>
            <span>开始 Tick / Started Tick</span>
            <span>{process.startedAtTick}</span>
          </div>

          <div className={styles.summary}>
            {process.summary}
          </div>
        </div>
      )}
    </section>
  )
}