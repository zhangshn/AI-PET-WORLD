/**
 * 当前文件负责：承载世界 Pixi 舞台，并提供正式观察窗口外壳。
 */

import type { ReactNode } from "react"

import styles from "@/styles/world-styles/world-stage-panel.module.css"

type Props = {
  children: ReactNode
}

export default function WorldStagePanel({ children }: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.eyebrow}>WORLD VIEW</p>
          <h2 className={styles.title}>生态区域</h2>
        </div>

        <p className={styles.hint}>拖拽地图观察 · F3 开发面板</p>
      </div>

      <div className={styles.viewport}>{children}</div>
    </section>
  )
}