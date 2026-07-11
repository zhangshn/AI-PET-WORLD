import type { Metadata } from "next"
import { ProgressClient } from "./progress-client"
import styles from "./page.module.css"

export const metadata: Metadata = {
  title: "AI Painter 训练主控台 | AI-PET-WORLD",
}

export default function AiPainterProgressPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>AI-PET-WORLD / AI PAINTER</p>
        <h1>训练主控台</h1>
        <p>
          主页只保留关键状态和入口按钮。完整地图训练、候选图审核、自动训练日志、数据字典、生成归档和训练目录都从入口进入，避免所有训练内容堆在一个页面里。
        </p>
      </header>
      <ProgressClient />
    </main>
  )
}
