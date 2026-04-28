/**
 * 当前文件负责：承载底部生命状态与世界摘要。
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
        <p className={styles.eyebrow}>LIFE STATUS</p>
        <h2 className={styles.title}>当前生命状态</h2>
      </div>

      <div className={styles.content}>{children}</div>
    </section>
  )
}