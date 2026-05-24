/**
 * 当前文件负责：维护宠物系统状态，并对外提供出生、运行、认知、喂食与读取接口。
 */

import type { HomeState } from "@/types/home"
import type { PetGenderPerspective, PetState } from "../types/pet"
import type { TimeState } from "../engine/timeSystem"
import type {
  CurrentLifeRuntimeBundle,
  LifePersonalityProfileBundle,
  PetTimelineSnapshot,
} from "../ai/gateway"
import type { ButlerOpportunity } from "./butlerSystem"
import type { WorldStimulus } from "../ai/gateway"
import type { PetCognitionRecord } from "../types/cognition"
import type { WorldZone } from "../world/ecology/world-zone-types"

import { buildInitialPetMemoryState } from "../ai/memory-core/memory-gateway"
import { buildPetWorldPerception } from "./agent-perception/agent-world-perception"
import { interpretPetWorldPerception } from "./agent-perception/agent-consciousness-interpretation"
import { buildLifeLineInfluenceSnapshot } from "./life-line/life-line-influence"

import {
  runPetStimulusPerception,
  mapTimelineStateToPetMood,
  applyFeeding,
  evaluateFoodOffer,
  applyAcceptedApproachOfferEffect,
  applyAcceptedRestOfferEffect,
  runPetRuntimeTick,
  createInitialPetLearningState,
  updatePetLearningState,
  driveSystem,
  attentionSystem,
  goalSystem,
  evaluateApproachOffer,
  evaluateRestOffer,
  type PetOpportunityDecision,
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

  activatePetAfterAdoptionReview(input: {
    name: string
    genderPerspective: PetGenderPerspective
    lifeProfile: LifePersonalityProfileBundle
    timelineSnapshot: PetTimelineSnapshot
    adoptionReviewId: string
    adoptionSafeApplyId: string
  }) {
    if (this.pet) return

    const {
      name,
      genderPerspective,
      lifeProfile,
      timelineSnapshot,
      adoptionReviewId,
      adoptionSafeApplyId,
    } = input

    if (!adoptionReviewId || !adoptionSafeApplyId) {
      throw new Error(
        "Pet runtime can only start after AdoptionReview and AdoptionSafeApply pass."
      )
    }

    const personalityProfile = lifeProfile.ziweiProfile
    const consciousnessProfile = lifeProfile.consciousnessProfile

    if (!personalityProfile) {
      throw new Error(
        "Adopted pet runtime needs a resolved personality profile before entering HomeMapState."
      )
    }

    if (!consciousnessProfile) {
      throw new Error("Adopted pet runtime needs a consciousness profile.")
    }

    const memoryState = buildInitialPetMemoryState()
    const learningState = createInitialPetLearningState()

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
        memoryState,
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
        currentLifeRuntimeBundle: null,
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
      genderPerspective,

      energy,
      hunger,
      mood,
      action: "observing",

      lifeProfile,
      personalityProfile,
      publicPersonalityView: lifeProfile.publicPersonalityView,
      baziProfile: lifeProfile.baziProfile,
      consciousnessProfile,

      currentLifeRuntimeBundle: null,
      latestLifeLineInfluence: null,

      lifeState: {
        phase: "newborn",
        ageTicks: 0,
        bornAtTick: this.currentTick,
        safeRadius: 70,
        maxExploreRadius: 90,
      },

      currentGoal: initialGoal,
      memoryState,
      learningState,
      timelineSnapshot,
      latestWorldPerception: null,
      latestWorldInterpretation: null,
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

  update(
    time: TimeState,
    zones: WorldZone[] = [],
    home: HomeState | null = null
  ) {
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

    if (this.pet) {
      const latestWorldPerception = buildPetWorldPerception({
        home,
      })

      this.pet = {
        ...this.pet,
        latestWorldPerception,
        latestWorldInterpretation: interpretPetWorldPerception({
          perception: latestWorldPerception,
          consciousness: this.pet.consciousnessProfile,
        }),
      }
    }
  }

  updateLifeRuntimeBundle(
    bundle: CurrentLifeRuntimeBundle | null
  ) {
    if (!this.pet) {
      return
    }

    this.pet = {
      ...this.pet,
      currentLifeRuntimeBundle: bundle,
      latestLifeLineInfluence: buildLifeLineInfluenceSnapshot(bundle),
    }
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
      learningState: this.pet?.learningState ?? null,
    })
  }

  evaluateRestOffer(opportunity: ButlerOpportunity): PetOpportunityDecision {
    return evaluateRestOffer({
      pet: this.pet,
      opportunity,
      learningState: this.pet?.learningState ?? null,
    })
  }

  evaluateApproachOffer(opportunity: ButlerOpportunity): PetOpportunityDecision {
    return evaluateApproachOffer({
      pet: this.pet,
      opportunity,
      learningState: this.pet?.learningState ?? null,
    })
  }

  applyAcceptedFoodOffer(amount: number) {
    this.applyFeeding(amount)
  }

  applyAcceptedRestOffer(opportunity: ButlerOpportunity) {
    const result = applyAcceptedRestOfferEffect({
      pet: this.pet,
      opportunity,
    })

    this.pet = result.pet

    return result
  }

  applyAcceptedApproachOffer(opportunity: ButlerOpportunity) {
    const result = applyAcceptedApproachOfferEffect({
      pet: this.pet,
      opportunity,
    })

    this.pet = result.pet

    return result
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

  refreshLearningState(tick: number) {
    if (!this.pet) return

    this.pet = {
      ...this.pet,
      learningState: updatePetLearningState({
        previousLearning: this.pet.learningState,
        memoryState: this.pet.memoryState,
        tick,
      }),
    }
  }

  restore(pet: PetState | null, currentTick: number): void {
    this.currentTick = Math.max(0, Math.floor(currentTick))

    this.lastDriveSnapshot = null
    this.lastDecisionReason = null
    this.lastFeedingTick = -9999

    if (!pet) {
      this.pet = null
      this.actionStability = null
      return
    }

    const restoredPet: PetState = {
      ...pet,
      learningState: pet.learningState ?? createInitialPetLearningState(),
      latestLifeLineInfluence: pet.latestLifeLineInfluence ?? null,
      latestWorldPerception: pet.latestWorldPerception ?? null,
      latestWorldInterpretation: pet.latestWorldInterpretation ?? null,
    }

    this.pet = restoredPet

    this.actionStability = {
      currentAction: restoredPet.action,
      startedAtTick: this.currentTick,
      lastChangedTick: this.currentTick,
    }
  }

  getPet(): PetState | null {
    return this.pet
  }

  hasPet(): boolean {
    return this.pet !== null
  }
}
