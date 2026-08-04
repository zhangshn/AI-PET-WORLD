import type { Metadata } from "next"
import { TrainingRunDetail } from "./training-run-detail"
import styles from "../../page.module.css"

export const metadata: Metadata = { title: "Stage训练记录 | AI-PET-WORLD" }

export default async function TrainingRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  return <main className={styles.page}><TrainingRunDetail runId={decodeURIComponent(runId)} /></main>
}
