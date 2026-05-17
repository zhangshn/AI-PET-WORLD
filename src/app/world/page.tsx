"use client"

import styles from "./page.module.css"

export default function WorldPage() {
  return (
    <main className={styles.worldPage} aria-label="AI-PET-WORLD">
      <div className={styles.worldAtmosphere} aria-hidden="true" />
      <div className={styles.originGround} aria-hidden="true">
        <div className={styles.originGlow} />
        <div className={styles.originCore} />
        <div className={styles.originPebbleA} />
        <div className={styles.originPebbleB} />
        <div className={styles.originGrassA} />
        <div className={styles.originGrassB} />
      </div>
    </main>
  )
}
