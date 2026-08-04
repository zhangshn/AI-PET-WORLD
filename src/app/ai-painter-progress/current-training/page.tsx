import type { Metadata } from "next"
import { CurrentTrainingDashboard } from "./current-training-dashboard"
import styles from "./page.module.css"

export const metadata: Metadata = {
  title: "当前训练控制台 | AI-PET-WORLD",
}

export default function CurrentTrainingPage() {
  return <main className={styles.page}><CurrentTrainingDashboard /></main>
}
