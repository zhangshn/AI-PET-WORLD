/**
 * 当前文件负责：展示宠物当前可观察生命状态。
 */

import type { PetState } from "@/types/pet"

import {
  getLifePhaseDisplayLabel,
  getPetBehaviorBiasSummary,
  getPetBehaviorTendencyText,
  getPetCurrentTendency,
  getPetGenderPerspectiveLabel,
  getPetInnateTemperament,
  getPetVisibleTraits,
  getTopFiveDimensionItems,
} from "../utils/petDisplayMappers"

import styles from "@/styles/world-styles/cards/pet-insight-card.module.css"

type Props = {
  pet: PetState | null
}

function getMoodLabel(mood?: string): string {
  if (!mood) return "未知"

  if (mood === "happy") return "愉快"
  if (mood === "normal") return "平稳"
  if (mood === "calm") return "平静"
  if (mood === "curious") return "好奇"
  if (mood === "alert") return "警觉"
  if (mood === "sad") return "低落"

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
  if (action === "observing") return "观察"
  if (action === "alert_idle") return "警觉停留"

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

function buildBehaviorExplanation(pet: PetState): string {
  const action = getActionLabel(pet.action)
  const mood = getMoodLabel(pet.mood)
  const energy = getEnergyLabel(pet.energy)
  const hunger = getHungerLabel(pet.hunger)
  const tendency = getPetBehaviorTendencyText(pet)

  if (pet.energy <= 20) {
    return `${pet.name} 的动作明显放慢了。它现在更需要安全的位置和足够的恢复时间。${tendency}`
  }

  if (pet.hunger >= 80) {
    return `${pet.name} 的注意力正在被生存需求牵引。它可能会优先寻找食物或靠近可依赖的区域。${tendency}`
  }

  if (pet.action === "exploring") {
    return `${pet.name} 正在扩大自己的活动范围。它会停下来感知周围，再决定下一步去哪里。${tendency}`
  }

  if (pet.action === "observing") {
    return `${pet.name} 没有急着行动。它正在观察环境里的变化，并慢慢形成自己的判断。${tendency}`
  }

  if (pet.action === "approaching") {
    return `${pet.name} 正在尝试靠近目标。靠近不是被命令触发，而是它在当前安全感和关系距离之间做出的自主选择。${tendency}`
  }

  if (pet.action === "resting" || pet.action === "sleeping") {
    return `${pet.name} 正在降低行动消耗，优先恢复状态。这个阶段它会更少回应外部刺激。${tendency}`
  }

  return `${pet.name} 现在处于${mood}状态，行为表现为${action}。整体能量${energy}，饥饿状态${hunger}。${tendency}`
}

export default function PetInsightCard({ pet }: Props) {
  if (!pet) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>DIGITAL LIFE</div>
            <h2 className={styles.name}>等待抵达</h2>
          </div>

          <div className={styles.mood}>领养流程中</div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>当前状态</div>

          <p className={styles.description}>
            管家已经向小镇宠物领养中心提交申请，世界正在等待宠物被分配并送达家园。
          </p>
        </div>
      </section>
    )
  }

  const topDimensions = getTopFiveDimensionItems(pet)
  const visibleTraits = getPetVisibleTraits(pet)

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>DIGITAL LIFE</div>
          <h2 className={styles.name}>{pet.name}</h2>
        </div>

        <div className={styles.mood}>{getMoodLabel(pet.mood)}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>当前生命状态</div>

        <div className={styles.grid}>
          <div>
            <span>生命视角</span>
            <strong>
              {getPetGenderPerspectiveLabel(pet.genderPerspective)}
            </strong>
          </div>

          <div>
            <span>生命阶段</span>
            <strong>{getLifePhaseDisplayLabel(pet.lifeState?.phase)}</strong>
          </div>

          <div>
            <span>当前行为</span>
            <strong>{getActionLabel(pet.action)}</strong>
          </div>

          <div>
            <span>情绪状态</span>
            <strong>{getMoodLabel(pet.mood)}</strong>
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
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>行为解释</div>

        <p className={styles.description}>
          {buildBehaviorExplanation(pet)}
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>生命档案摘要</div>

        <div className={styles.summaryGrid}>
          <div>
            <span>天生气质</span>
            <strong>{getPetInnateTemperament(pet)}</strong>
          </div>

          <div>
            <span>当前倾向</span>
            <strong>{getPetCurrentTendency(pet)}</strong>
          </div>

          <div>
            <span>可见特质</span>
            <strong>{visibleTraits.slice(0, 3).join("、")}</strong>
          </div>
        </div>

        {topDimensions.length > 0 && (
          <div className={styles.dimensionList}>
            {topDimensions.map((dimension) => (
              <div className={styles.dimensionItem} key={dimension.label}>
                <div className={styles.dimensionTopRow}>
                  <span>{dimension.label}</span>
                  <strong>{dimension.score}</strong>
                </div>

                <p>{dimension.summary}</p>
              </div>
            ))}
          </div>
        )}

        <p className={styles.description}>
          {getPetBehaviorBiasSummary(pet)}
        </p>
      </div>
    </section>
  )
}
