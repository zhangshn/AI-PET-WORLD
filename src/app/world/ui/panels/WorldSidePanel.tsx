/**
 * 当前文件负责：承载右侧世界观察与叙事信息。
 */

import type { ReactNode } from "react"

import styles from "@/styles/world-styles/world-side-panel.module.css"

type Props = {
  children: ReactNode
}

export default function WorldSidePanel({ children }: Props) {
  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <p className={styles.eyebrow}>OBSERVATION STREAM</p>
        <h2 className={styles.title}>观察记录</h2>
      </div>

      <div className={styles.content}>{children}</div>
    </aside>
  )
}