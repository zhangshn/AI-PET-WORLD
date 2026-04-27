/**
 * 当前文件负责：
 * 1. 展示宠物当前状态
 * 2. 强化“观察生命”感觉
 */

import type { PetState } from "@/types/pet"

import styles from "@/styles/world-styles/pet-insight-card.module.css"

type Props = {
  pet: PetState | null
}

export default function PetInsightCard({
  pet,
}: Props) {
  if (!pet) {
    return (
      <section className={styles.card}>
        世界正在等待新的生命诞生。
      </section>
    )
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            DIGITAL LIFE
          </div>

          <h2 className={styles.name}>
            {pet.name}
          </h2>
        </div>

        <div className={styles.mood}>
          {pet.mood}
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <span>行为</span>
          <strong>{pet.action}</strong>
        </div>

        <div>
          <span>能量</span>
          <strong>{pet.energy}</strong>
        </div>

        <div>
          <span>饥饿</span>
          <strong>{pet.hunger}</strong>
        </div>

        <div>
          <span>阶段</span>
          <strong>{pet.lifeState?.phase}</strong>
        </div>
      </div>

      <p className={styles.description}>
        它正在安静地感知这个世界。
      </p>
    </section>
  )
}