/**
 * 当前文件负责：
 * 1. 宠物状态面板
 * 2. 展示当前宠物核心状态
 * 3. 展示 Goal + Zone 空间目标
 * 4. 展示 LifeProfile 的公开摘要
 * 5. 中英文双语展示
 */

import type { PetState } from "@/types/pet"

import {
  getLifePhaseDisplayLabel,
  getLifeProfileModeLabel,
  getPetBehaviorBiasSummary,
  getPetCurrentTendency,
  getPetGenderPerspectiveLabel,
  getPetInnateTemperament,
  getPetVisibleTraits,
  getTopFiveDimensionItems,
} from "../utils/petDisplayMappers"

import styles from "@/styles/world-styles/pet-status-panel.module.css"

type Props = {
  pet: PetState | null
}

function formatPosition(
  position?: {
    x: number
    y: number
  }
): string {
  if (!position) return "-"

  return `(${Math.round(position.x)}, ${Math.round(position.y)})`
}

export default function PetStatusPanel({ pet }: Props) {
  if (!pet) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>
          宠物状态 / Pet Status
        </h2>

        <p className={styles.empty}>
          当前没有宠物 / No active pet
        </p>
      </section>
    )
  }

  const goal = pet.currentGoal
  const topDimensions = getTopFiveDimensionItems(pet)
  const visibleTraits = getPetVisibleTraits(pet)

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>
        宠物状态 / Pet Status
      </h2>

      <div className={styles.content}>
        <div className={styles.row}>
          <span>名字 / Name</span>
          <span>{pet.name}</span>
        </div>

        <div className={styles.row}>
          <span>生命视角 / Life View</span>
          <span>
            {getPetGenderPerspectiveLabel(pet.genderPerspective)}
          </span>
        </div>

        <div className={styles.row}>
          <span>人格来源 / Profile Source</span>
          <span>{getLifeProfileModeLabel(pet.lifeProfile.mode)}</span>
        </div>

        <div className={styles.row}>
          <span>生命阶段 / Life Phase</span>
          <span>{getLifePhaseDisplayLabel(pet.lifeState?.phase)}</span>
        </div>

        <div className={styles.row}>
          <span>天生气质 / Temperament</span>
          <span>{getPetInnateTemperament(pet)}</span>
        </div>

        <div className={styles.row}>
          <span>当前倾向 / Current Tendency</span>
          <span>{getPetCurrentTendency(pet)}</span>
        </div>

        <div className={styles.row}>
          <span>可见特质 / Visible Traits</span>
          <span>{visibleTraits.join("、")}</span>
        </div>

        <div className={styles.row}>
          <span>行为 / Action</span>
          <span>{pet.action}</span>
        </div>

        <div className={styles.row}>
          <span>情绪 / Mood</span>
          <span>{pet.mood}</span>
        </div>

        <div className={styles.row}>
          <span>精力 / Energy</span>
          <span>{pet.energy}</span>
        </div>

        <div className={styles.row}>
          <span>饥饿 / Hunger</span>
          <span>{pet.hunger}</span>
        </div>

        <div className={styles.row}>
          <span>目标 / Goal</span>
          <span>{goal?.type ?? "none"}</span>
        </div>

        <div className={styles.row}>
          <span>目标来源 / Goal Source</span>
          <span>{goal?.source ?? "-"}</span>
        </div>

        <div className={styles.row}>
          <span>目标区域 / Target Zone</span>
          <span>{goal?.targetZoneType ?? "-"}</span>
        </div>

        <div className={styles.row}>
          <span>区域 ID / Zone ID</span>
          <span>{goal?.targetZoneId ?? "-"}</span>
        </div>

        <div className={styles.row}>
          <span>目标坐标 / Target Position</span>
          <span>
            {formatPosition(goal?.targetWorldPosition)}
          </span>
        </div>

        <div className={styles.row}>
          <span>目标保持 / Hold Until</span>
          <span>
            {goal?.holdUntilTick ?? "-"}
          </span>
        </div>

        <div className={styles.row}>
          <span>阶段 / Phase</span>
          <span>
            {pet.timelineSnapshot?.fortune?.phaseTag ?? "-"}
          </span>
        </div>

        <div className={styles.row}>
          <span>分支 / Branch</span>
          <span>
            {pet.timelineSnapshot?.trajectory?.branchTag ?? "-"}
          </span>
        </div>

        <div className={styles.goalSummary}>
          <div className={styles.goalSummaryTitle}>
            LifeProfile Summary
          </div>

          <div className={styles.goalSummaryText}>
            {topDimensions.length > 0
              ? topDimensions
                  .map(
                    (dimension) =>
                      `${dimension.label} ${dimension.score}`
                  )
                  .join(" / ")
              : "No dimension summary"}
          </div>
        </div>

        <div className={styles.goalSummary}>
          <div className={styles.goalSummaryTitle}>
            Behavior Bias Summary
          </div>

          <div className={styles.goalSummaryText}>
            {getPetBehaviorBiasSummary(pet)}
          </div>
        </div>

        <div className={styles.goalSummary}>
          <div className={styles.goalSummaryTitle}>
            Goal Summary
          </div>

          <div className={styles.goalSummaryText}>
            {goal?.summary ?? "No active goal"}
          </div>
        </div>
      </div>
    </section>
  )
}