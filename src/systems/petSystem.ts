/**
 * 当前文件负责：维护宠物系统状态，并对外提供出生、运行、认知、喂食与读取接口。
 */

import type { PetState } from "../types/pet"
import type { TimeState } from "../engine/timeSystem"
import type { PetBirthAiBundle } from "../ai/gateway"
import type { ButlerOpportunity } from "./butlerSystem"
import type { WorldStimulus } from "../ai/gateway"
import type { PetCognitionRecord } from "../types/cognition"
import type { WorldZone } from "../world/ecology/world-zone-types"

import {
  runPetStimulusPerception,
  mapTimelineStateToPetMood,
  applyFeeding,
  evaluateFoodOffer,
  runPetRuntimeTick,
  driveSystem,
  attentionSystem,
  goalSystem,
  type FoodOfferDecision,
  type ActionDecisionReason,
  type ActionStabilityState,
  type DriveSnapshot,
} from "./pet/pet-gateway"

export class PetSystem {
  private pet: PetState | null = null
  private actionStability: ActionStabilityState | null = null
  private currentTick = 0
  private lastDriveSnapshot: DriveSnapshot | null = null
  private lastDecisionReason: ActionDecisionReason | null = null
  private lastFeedingTick = -9999

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
    const mood = mapTimelineStateToPetMood(
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

  update(time: TimeState, zones: WorldZone[] = []) {
    this.currentTick += 1

    const result = runPetRuntimeTick({
      pet: this.pet,
      currentTick: this.currentTick,
      time,
      zones,
      actionStability: this.actionStability,
      lastFeedingTick: this.lastFeedingTick,
    })

    this.pet = result.pet
    this.actionStability = result.actionStability
    this.lastDriveSnapshot = result.lastDriveSnapshot
    this.lastDecisionReason = result.lastDecisionReason
  }

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

  evaluateFoodOffer(opportunity: ButlerOpportunity): FoodOfferDecision {
    return evaluateFoodOffer({
      pet: this.pet,
      opportunity,
    })
  }

  applyAcceptedFoodOffer(amount: number) {
    this.applyFeeding(amount)
  }

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

  getPet(): PetState | null {
    return this.pet
  }

  hasPet(): boolean {
    return this.pet !== null
  }
}