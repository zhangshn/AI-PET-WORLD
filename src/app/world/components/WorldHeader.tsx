/**
 * 当前文件负责：
 * 1. 世界顶部状态栏
 * 2. 显示时间与世界运行状态
 * 3. 中英文双语展示
 */

import type { TimeState } from "@/engine/timeSystem"

import styles from "@/styles/world-styles/world-header.module.css"

type Props = {
  tick: number
  time: TimeState | null
}

export default function WorldHeader({
  tick,
  time,
}: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>
          AI-PET-WORLD
        </h1>

        <p className={styles.subtitle}>
          自主 AI 世界运行时 / Autonomous AI World Runtime
        </p>
      </div>

      <div className={styles.right}>
        <div className={styles.block}>
          <span className={styles.label}>
            世界 Tick / World Tick
          </span>

          <span className={styles.value}>
            {tick}
          </span>
        </div>

        <div className={styles.block}>
          <span className={styles.label}>
            当前时间 / Current Time
          </span>

          <span className={styles.value}>
            {time
              ? `Day ${time.day} - ${time.hour}:00 - ${time.period}`
              : "加载中 / Loading"}
          </span>
        </div>
      </div>
    </header>
  )
}