/**
 * 当前文件负责：展示宠物当前可观察状态。
 */

import type { PetState } from "@/types/pet"

import styles from "@/styles/world-styles/pet-insight-card.module.css"

type Props = {
  pet: PetState | null
}

function getMoodLabel(mood?: string): string {
  if (!mood) return "未知"

  if (mood === "happy") return "愉快"
  if (mood === "calm") return "平静"
  if (mood === "excited") return "兴奋"
  if (mood === "tired") return "疲惫"
  if (mood === "sad") return "低落"
  if (mood === "anxious") return "不安"
  if (mood === "curious") return "好奇"

  return mood
}

function getActionLabel(action?: string): string {
  if (!action) return "观察环境"

  if (action === "idle") return "停留"
  if (action === "walking") return "移动"
  if (action === "exploring") return "探索"
  if (action === "eating") return "进食"
  if (action === "resting") return "休息"
  if (action === "sleeping") return "睡眠"
  if (action === "approaching") return "靠近"
  if (action === "avoiding") return "回避"
  if (action === "observing") return "观察"

  return action
}

function getEnergyLabel(energy: number): string {
  if (energy >= 75) return "充沛"
  if (energy >= 45) return "稳定"
  if (energy >= 20) return "偏低"

  return "疲弱"
}

function getHungerLabel(hunger: number): string {
  if (hunger >= 80) return "非常饥饿"
  if (hunger >= 55) return "有些饿"
  if (hunger >= 25) return "稳定"

  return "满足"
}

function getLifePhaseLabel(phase?: string): string {
  if (!phase) return "适应中"

  if (phase === "newborn") return "初生期"
  if (phase === "dependent") return "依赖期"
  if (phase === "adaptation") return "适应期"
  if (phase === "growth") return "成长期"
  if (phase === "stable_phase") return "稳定期"
  if (phase === "attachment_phase") return "依恋期"
  if (phase === "recovery_phase") return "恢复期"
  if (phase === "withdrawal_phase") return "退缩期"

  return phase
}

function buildObservationText(pet: PetState): string {
  const action = getActionLabel(pet.action)
  const mood = getMoodLabel(pet.mood)
  const energy = getEnergyLabel(pet.energy)
  const hunger = getHungerLabel(pet.hunger)

  if (pet.energy <= 20) {
    return `${pet.name} 的动作明显放慢了。它现在更需要安全的位置和足够的恢复时间。`
  }

  if (pet.hunger >= 80) {
    return `${pet.name} 的注意力正在被生存需求牵引。它可能会优先寻找食物或靠近可依赖的区域。`
  }

  if (pet.action === "exploring") {
    return `${pet.name} 正在扩大自己的活动范围。它会停下来感知周围，再决定下一步去哪里。`
  }

  if (pet.action === "observing") {
    return `${pet.name} 没有急着行动。它正在观察环境里的变化，并慢慢形成自己的判断。`
  }

  return `${pet.name} 现在处于${mood}状态，行为表现为${action}。整体能量${energy}，饥饿状态${hunger}。`
}

export default function PetInsightCard({ pet }: Props) {
  if (!pet) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>DIGITAL LIFE</div>
            <h2 className={styles.name}>等待诞生</h2>
          </div>

          <div className={styles.mood}>孵化中</div>
        </div>

        <p className={styles.description}>
          世界正在等待新的生命反应。孵化器保持运行，管家会优先确认其中的稳定度。
        </p>
      </section>
    )
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DIGITAL LIFE</div>
          <h2 className={styles.name}>{pet.name}</h2>
        </div>

        <div className={styles.mood}>{getMoodLabel(pet.mood)}</div>
      </div>

      <div className={styles.grid}>
        <div>
          <span>当前行为</span>
          <strong>{getActionLabel(pet.action)}</strong>
        </div>

        <div>
          <span>生命阶段</span>
          <strong>{getLifePhaseLabel(pet.lifeState?.phase)}</strong>
        </div>

        <div>
          <span>能量状态</span>
          <strong>{getEnergyLabel(pet.energy)}</strong>
        </div>

        <div>
          <span>饥饿状态</span>
          <strong>{getHungerLabel(pet.hunger)}</strong>
        </div>
      </div>

      <p className={styles.description}>{buildObservationText(pet)}</p>
    </section>
  )
}