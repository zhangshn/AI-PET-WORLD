import type { Metadata } from "next"
import { ProgressClient } from "./progress-client"
import styles from "./page.module.css"

export const metadata: Metadata = { title: "AI Painter 训练主页 | AI-PET-WORLD" }

export default function AiPainterProgressPage() {
  return <main className={styles.page}><header className={styles.header}><p className={styles.kicker}>AI-PET-WORLD / LOCAL AI PAINTER</p><h1>本地模型训练中心</h1><p>这里仅展示总体状态与阶段入口。训练图片、日志和审核详情放在各自页面。</p></header><ProgressClient /></main>
}
