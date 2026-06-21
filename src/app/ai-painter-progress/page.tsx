import type { Metadata } from "next"
import { ProgressClient } from "./progress-client"
import styles from "./page.module.css"

export const metadata: Metadata = {
  title: "AI Painter 本地训练主页 | AI-PET-WORLD",
}

export default function AiPainterProgressPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>AI-PET-WORLD / LOCAL AI PAINTER</p>
        <h1>本地模型训练中心</h1>
        <p>
          这里展示本地自研 AI Painter 的整体状态、训练入口、GPU 使用、电费估算和本地计算记录。
          当前主线是纯自然家园画面训练；未通过 VisualJudge 与 ApprovedFrame 链路的输出不会进入正式世界页面。
        </p>
      </header>
      <ProgressClient />
    </main>
  )
}
