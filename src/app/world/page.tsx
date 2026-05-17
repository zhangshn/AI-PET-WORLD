"use client"

import styles from "./page.module.css"

export default function WorldPage() {
  return (
    <main className={styles.worldPage}>
      <section className={styles.worldStage} aria-label="AI-PET-WORLD">
        <div className={styles.worldStageSurface} />
      </section>
    </main>
  )
}
