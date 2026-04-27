/**
 * 当前文件负责：管理宠物出生、timeline 更新、goal 接入、memory 接入、
 * cognition 接入、behavior-core 接入，以及状态驱动下的行为调度。
 *
 * 注意：
 * - 具体认知逻辑放在 pet/pet-cognition
 * - 生命周期推进放在 pet/pet-life
 * - 区域影响放在 pet/pet-zone
 * - 行为选择与行为稳定放在 pet/pet-action
 * - 喂食判断与喂食状态更新放在 pet/pet-feeding
 * - timeline 状态事件构建放在 pet/pet-state-events
 */

import { PetState, PetAction, PetMood } from "../types/pet"
import { TimeState } from "../engine/timeSystem"
import { runPetStimulusPerception } from "./pet/pet-cognition/pet-cognition-gateway"
import { runPetLife } from "./pet/pet-life/pet-life-gateway"
import { runPetZoneInfluence } from "./pet/pet-zone/pet-zone-gateway"
import { buildPetStateEvents } from "./pet/pet-state-events/pet-state-events-gateway"
import {
  applyFeeding,
  evaluateFoodOffer,
  type FoodOfferDecision,
} from "./pet/pet-feeding/pet-feeding-gateway"
import type { PetBirthAiBundle } from "../ai/gateway"
import {
  applyPetActionStability,
  selectPetAction,
  type ActionDecisionReason,
  type ActionStabilityState,
} from "./pet/pet-action/pet-action-gateway"
import { updatePetAiState, stepPetBehaviorProcess } from "../ai/gateway"
import { driveSystem, type DriveSnapshot } from "./driveSystem"
import { attentionSystem } from "./attentionSystem"
import { goalSystem } from "./goalSystem"
import { updatePetMemoryState } from "../ai/memory-core/memory-gateway"
import type { ButlerOpportunity } from "./butlerSystem"
import type { WorldStimulus } from "../ai/gateway"
import type { PetCognitionRecord } from "../types/cognition"
import type { WorldZone } from "../world/ecology/world-zone-types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export class PetSystem {
  private pet: PetState | null = null
  private actionStability: ActionStabilityState | null = null
  private currentTick = 0
  private lastDriveSnapshot: DriveSnapshot | null = null
  private lastDecisionReason: ActionDecisionReason | null = null
  private lastFeedingTick = -9999

  /**
   * 使用 AI 出生数据创建宠物。
   * 这里只负责组装初始 PetState，不再计算人格、八字、紫微或意识结构。
   */
  hatchPetWithAiBundle(name: string, aiBundle: PetBirthAiBundle) {
    if (this.pet) return

    const {
      personalityProfile,
      baziProfile,
      finalPersonalityProfile,
      consciousnessProfile,
      memoryState,
      timelineSnapshot,
    } = aiBundle

    const energy = Math.round(timelineSnapshot.state.physical.energy)
    const hunger = Math.round(timelineSnapshot.state.physical.hunger)
    const mood = this.mapTimelineStateToPetMood(
      timelineSnapshot.state.emotional.label
    )

    const driveSnapshot = driveSystem.compute({
      pet: {
        energy,
        hunger,
        mood,
        timelineSnapshot,
        personalityProfile,
        consciousnessProfile,
      },
      time: {
        day: 1,
        hour: 8,
        period: "Daytime",
      },
    })

    const initialGoal = goalSystem.compute({
      tick: this.currentTick,
      pet: {
        energy,
        hunger,
        mood,
        timelineSnapshot,
        consciousnessProfile,
        memoryState,
      },
      time: {
        day: 1,
        hour: 8,
        period: "Daytime",
      },
      previousGoal: null,
      zones: [],
    })

    this.pet = {
      name,
      energy,
      hunger,
      mood,
      action: "observing",
      personalityProfile,
      baziProfile,
      finalPersonalityProfile,
      consciousnessProfile,
      lifeState: {
        phase: "newborn",
        ageTicks: 0,
        bornAtTick: this.currentTick,
        safeRadius: 70,
        maxExploreRadius: 90,
      },
      currentGoal: initialGoal,
      memoryState,
      timelineSnapshot,
      latestCognition: null,
      recentCognition: [],
      activeBehaviorProcess: null,
    }

    this.lastDriveSnapshot = driveSnapshot

    this.actionStability = {
      currentAction: "observing",
      startedAtTick: this.currentTick,
      lastChangedTick: this.currentTick,
    }

    attentionSystem.lockAttention({
      tick: this.currentTick,
      currentAction: "observing",
      dominantDrive: driveSnapshot.dominant,
      energy,
      hunger,
      emotionalLabel: timelineSnapshot.state.emotional.label,
      phaseTag: timelineSnapshot.fortune.phaseTag,
      branchTag: timelineSnapshot.trajectory.branchTag,
    })
  }

  /**
   * 推进宠物一帧逻辑。
   * 当前方法是调度层：负责串联生命周期、goal、drive、行为选择、行为稳定、
   * 区域影响、timeline 更新和 memory 更新。
   */
  update(time: TimeState, zones: WorldZone[] = []) {
    this.currentTick++

    if (!this.pet || !this.pet.timelineSnapshot) return

    this.pet = runPetLife({
      pet: this.pet,
    }).pet

    const currentSnapshot = this.pet.timelineSnapshot

    if (!currentSnapshot) return

    const energyBefore = Math.round(this.pet.energy)
    const hungerBefore = Math.round(this.pet.hunger)
    const moodBefore = currentSnapshot.state.emotional.label

    attentionSystem.decayAttention(this.currentTick)

    let forcedAction: PetAction | undefined

    if (this.pet.activeBehaviorProcess) {
      const processResult = stepPetBehaviorProcess({
        tick: this.currentTick,
        process: this.pet.activeBehaviorProcess,
        energy: this.pet.energy,
        hunger: this.pet.hunger,
      })

      this.pet.activeBehaviorProcess = processResult.nextProcess
      forcedAction = processResult.suggestedAction

      this.pet.energy = clamp(
        this.pet.energy + processResult.delta.energyDelta,
        0,
        100
      )

      this.pet.hunger = clamp(
        this.pet.hunger + processResult.delta.hungerDelta,
        0,
        100
      )

      if (processResult.delta.emotionalShift >= 8) {
        this.pet.mood = "happy"
      } else if (processResult.delta.emotionalShift <= -8) {
        this.pet.mood = "alert"
      }
    }

    const nextGoal = goalSystem.compute({
      tick: this.currentTick,
      pet: {
        energy: this.pet.energy,
        hunger: this.pet.hunger,
        mood: this.pet.mood,
        timelineSnapshot: currentSnapshot,
        consciousnessProfile: this.pet.consciousnessProfile,
        memoryState: this.pet.memoryState,
      },
      time,
      previousGoal: this.pet.currentGoal ?? null,
      zones,
    })

    this.pet.currentGoal = nextGoal

    const driveSnapshot = driveSystem.compute({
      pet: {
        energy: this.pet.energy,
        hunger: this.pet.hunger,
        mood: this.pet.mood,
        timelineSnapshot: currentSnapshot,
        personalityProfile: this.pet.personalityProfile,
        consciousnessProfile: this.pet.consciousnessProfile,
      },
      time,
    })

    this.lastDriveSnapshot = driveSnapshot

    const actionSelection = forcedAction
      ? {
          action: forcedAction,
          reason: "goal_guided_selection" as ActionDecisionReason,
        }
      : selectPetAction({
          pet: this.pet,
          dominantDrive: driveSnapshot.dominant,
          currentGoal: nextGoal,
          snapshot: currentSnapshot,
          driveSnapshot,
        })

    const rawAction = actionSelection.action
    this.lastDecisionReason = actionSelection.reason

    const stabilityResult = applyPetActionStability({
      currentTick: this.currentTick,
      candidate: rawAction,
      currentPetAction: this.pet.action,
      energy: this.pet.energy,
      hunger: this.pet.hunger,
      stability: this.actionStability,
      shouldHoldCurrentAction: (input) =>
        attentionSystem.shouldHoldCurrentAction(input),
    })

    const finalAction = stabilityResult.action
    this.actionStability = stabilityResult.stability
    this.lastDecisionReason = stabilityResult.reason

    const previousAction = this.pet.action
    this.pet.action = finalAction

    this.pet = runPetZoneInfluence({
      pet: this.pet,
      action: finalAction,
      zones,
    }).pet

    if (previousAction !== finalAction || !attentionSystem.getAttention()) {
      attentionSystem.lockAttention({
        tick: this.currentTick,
        currentAction: finalAction,
        dominantDrive: driveSnapshot.dominant,
        energy: this.pet.energy,
        hunger: this.pet.hunger,
        emotionalLabel: currentSnapshot.state.emotional.label,
        phaseTag: currentSnapshot.fortune.phaseTag,
        branchTag: currentSnapshot.trajectory.branchTag,
      })
    }

    const nextSnapshot = updatePetAiState({
      currentSnapshot,
      time,
      events: buildPetStateEvents(finalAction),
      behaviorShift: {
        previousAction,
        nextAction: finalAction,
        impact: 0.2,
      },
      tickDelta: 1,
      shouldRefreshTrajectory: true,
      playerRelation: {
        familiarity: 60,
        attachment: 45,
        trust: 55,
        distance: 15,
      },
    })

    nextSnapshot.state.physical.energy = this.pet.energy
    nextSnapshot.state.physical.hunger = this.pet.hunger

    this.pet.timelineSnapshot = nextSnapshot
    this.pet.energy = Math.round(nextSnapshot.state.physical.energy)
    this.pet.hunger = Math.round(nextSnapshot.state.physical.hunger)
    this.pet.mood = this.mapTimelineStateToPetMood(
      nextSnapshot.state.emotional.label
    )

    const wasFed = this.currentTick - this.lastFeedingTick <= 1

    this.pet.memoryState = updatePetMemoryState({
      previousMemory: this.pet.memoryState,
      tick: this.currentTick,
      time: {
        day: time.day,
        hour: time.hour,
        period: time.period,
      },
      action: finalAction,
      energyBefore,
      energyAfter: this.pet.energy,
      hungerBefore,
      hungerAfter: this.pet.hunger,
      moodBefore,
      moodAfter: nextSnapshot.state.emotional.label,
      wasFed,
    })
  }

  /**
   * 接收世界刺激，并交给宠物认知系统处理。
   */
  perceiveWorldStimuli(
    stimuli: WorldStimulus[],
    time: {
      day: number
      hour: number
      period?: string
    }
  ): PetCognitionRecord[] {
    if (!this.pet || !this.pet.timelineSnapshot || stimuli.length === 0) {
      return []
    }

    const result = runPetStimulusPerception({
      pet: this.pet,
      currentTick: this.currentTick,
      stimuli,
      time,
    })

    this.pet = result.pet

    return result.records
  }

  /**
   * 判断宠物是否接受管家提供的食物机会。
   */
  evaluateFoodOffer(opportunity: ButlerOpportunity): FoodOfferDecision {
    return evaluateFoodOffer({
      pet: this.pet,
      opportunity,
    })
  }

  /**
   * 对已接受的食物机会应用摄食结果。
   */
  applyAcceptedFoodOffer(amount: number) {
    this.applyFeeding(amount)
  }

  /**
   * 直接应用喂食结果。
   */
  applyFeeding(amount: number = 15) {
    const result = applyFeeding({
      pet: this.pet,
      amount,
    })

    this.pet = result.pet

    if (result.acceptedAmount > 0) {
      this.lastFeedingTick = this.currentTick
    }
  }

  /**
   * 将 timeline 内部情绪标签映射成 PetMood。
   * 后续可以继续拆到 pet/pet-mood。
   */
  private mapTimelineStateToPetMood(label: string): PetMood {
    if (label === "excited" || label === "content" || label === "relaxed") {
      return "happy"
    }

    if (label === "alert") return "alert"
    if (label === "curious") return "curious"

    if (label === "anxious" || label === "irritated" || label === "low") {
      return "sad"
    }

    return "normal"
  }

  getPet(): PetState | null {
    return this.pet
  }

  hasPet(): boolean {
    return this.pet !== null
  }
}