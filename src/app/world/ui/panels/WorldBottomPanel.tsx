/**
 * 当前文件负责：承载 Alpha 阶段的生命观察说明区。
 */

import type { ReactNode } from "react"

import styles from "@/styles/world-styles/world-bottom-panel.module.css"

type Props = {
  children: ReactNode
}

export default function WorldBottomPanel({ children }: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>ALPHA OBSERVATION</p>

        <h2 className={styles.title}>生命观察说明</h2>

        <p className={styles.description}>
          当前区域用于验证世界运行逻辑。未来 MVP 中，这些状态会逐步转化为角色动作、小型 HUD、数值条、气泡和场景反馈。
        </p>
      </div>

      <div className={styles.content}>{children}</div>
    </section>
  )
}