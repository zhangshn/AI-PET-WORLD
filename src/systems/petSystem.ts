/**
 * 当前文件负责：管理宠物出生、timeline 更新、goal 接入、memory 接入、cognition 接入、behavior-core 接入，以及状态驱动下的行为决策、行为稳定控制、新生期限制与区域影响。
 */

import { PetState, PetAction, PetMood } from "../types/pet"
import { TimeState } from "../engine/timeSystem"
import { runPetStimulusPerception } from "./pet-cognition/pet-cognition-gateway"
import type { PetBirthAiBundle } from "../ai/gateway"
import {
  updatePetAiState,
  stepPetBehaviorProcess,
} from "../ai/gateway"
import {
  driveSystem,
  type DriveSnapshot,
  type DriveType,
} from "./driveSystem"
import { attentionSystem } from "./attentionSystem"
import {
  goalSystem,
  type PetGoalState,
} from "./goalSystem"
import {
  updatePetMemoryState,
} from "../ai/memory-core/memory-gateway"
import type { ButlerOpportunity } from "./butlerSystem"
import type { WorldStimulus } from "../ai/gateway"
import type { PetCognitionRecord } from "../types/cognition"
import type { WorldZone } from "../world/ecology/world-zone-types"

type ActionDecisionReason =
  | "bootstrap_default"
  | "hard_low_energy"
  | "hard_extreme_hunger"
  | "goal_guided_selection"
  | "stability_hold_min_duration"
  | "stability_accept_transition"
  | "attention_hold_current"

type ActionStabilityState = {
  currentAction: PetAction
  startedAtTick: number
  lastChangedTick: number
}

export type FoodOfferDecision = {
  accepted: boolean
  intakeAmount: number
  reason: string
}

const ACTION_MIN_DURATION: Record<PetAction, number> = {
  sleeping: 4,
  eating: 3,
  walking: 3,
  exploring: 4,
  approaching: 3,
  idle: 2,
  observing: 3,
  resting: 3,
  alert_idle: 3,
}

const ACTION_TRANSITIONS: Record<PetAction, PetAction[]> = {
  sleeping: ["idle", "resting", "eating"],
  eating: ["idle", "resting", "walking"],
  resting: ["idle", "sleeping", "walking"],
  idle: [
    "walking",
    "observing",
    "resting",
    "eating",
    "sleeping",
    "alert_idle",
  ],
  walking: [
    "idle",
    "observing",
    "exploring",
    "approaching",
    "eating",
    "resting",
    "alert_idle",
  ],
  exploring: [
    "walking",
    "observing",
    "approaching",
    "idle",
    "resting",
  ],
  approaching: [
    "idle",
    "walking",
    "eating",
    "observing",
    "resting",
  ],
  observing: [
    "idle",
    "walking",
    "exploring",
    "approaching",
    "alert_idle",
  ],
  alert_idle: [
    "observing",
    "idle",
    "walking",
    "resting",
  ],
}


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

  private pickActionByWeight(weights: Record<PetAction, number>): PetAction {
    const entries = Object.entries(weights) as [PetAction, number][]
    const total = entries.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0)

    if (total <= 0) return "idle"

    let randomValue = Math.random() * total

    for (const [action, weight] of entries) {
      const safeWeight = Math.max(weight, 0)

      if (randomValue < safeWeight) return action

      randomValue -= safeWeight
    }

    return entries[0][0]
  }

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

  update(time: TimeState, zones: WorldZone[] = []) {
    this.currentTick++

    if (!this.pet || !this.pet.timelineSnapshot) return

    this.updateLifeState()

    const currentSnapshot = this.pet.timelineSnapshot
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

    const rawAction = forcedAction
      ? forcedAction
      : this.mapDriveToPetAction(
          driveSnapshot.dominant,
          nextGoal,
          currentSnapshot,
          driveSnapshot
        )

    const finalAction = this.applyActionStability(rawAction)

    const previousAction = this.pet.action
    this.pet.action = finalAction

    this.applyZoneInfluence(finalAction, zones)

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
      events: this.buildStateEvents(finalAction),
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

  private updateLifeState() {
    if (!this.pet) return

    const lifeState = this.pet.lifeState

    lifeState.ageTicks += 1

    const petBias = this.pet.finalPersonalityProfile.bias.petBehaviorBias
    const activityBias = petBias.newbornActivity
    const explorationBias = petBias.explorationRange

    if (lifeState.ageTicks < 6) {
      lifeState.phase = "newborn"
      lifeState.safeRadius = 70
      lifeState.maxExploreRadius = 90
      return
    }

    if (lifeState.ageTicks < 14) {
      lifeState.phase = "adaptation"
      lifeState.safeRadius = 95
      lifeState.maxExploreRadius = 120 + explorationBias * 0.4
      return
    }

    if (lifeState.ageTicks < 28) {
      lifeState.phase = "dependent"
      lifeState.safeRadius = 130
      lifeState.maxExploreRadius = 160 + explorationBias * 0.65
      return
    }

    if (lifeState.ageTicks < 48 || activityBias < 55) {
      lifeState.phase = "curious"
      lifeState.safeRadius = 170
      lifeState.maxExploreRadius = 220 + explorationBias * 0.8
      return
    }

    lifeState.phase = "independent"
    lifeState.safeRadius = 240
    lifeState.maxExploreRadius = 320 + explorationBias
  }

  private findCurrentGoalZone(zones: WorldZone[]): WorldZone | null {
    const goal = this.pet?.currentGoal

    if (!goal) return null

    if (goal.targetZoneId) {
      const byId = zones.find(
        (zone) => zone.id === goal.targetZoneId && zone.isActive
      )

      if (byId) return byId
    }

    if (goal.targetZoneType) {
      return (
        zones.find(
          (zone) => zone.type === goal.targetZoneType && zone.isActive
        ) ?? null
      )
    }

    return null
  }

  private applyZoneInfluence(action: PetAction, zones: WorldZone[]) {
    if (!this.pet) return

    const zone = this.findCurrentGoalZone(zones)
    if (!zone) return

    const effect = zone.effect

    if (
      zone.type === "sleep_zone" &&
      (action === "sleeping" || action === "resting")
    ) {
      this.pet.energy = clamp(
        this.pet.energy + Math.max(1, effect.restBonus * 0.08),
        0,
        100
      )
      this.pet.hunger = clamp(this.pet.hunger + 0.4, 0, 100)
    }

    if (
      zone.type === "quiet_zone" &&
      (action === "resting" || action === "observing")
    ) {
      this.pet.energy = clamp(
        this.pet.energy + Math.max(1, effect.restBonus * 0.05),
        0,
        100
      )

      if (this.pet.mood === "alert" || this.pet.mood === "sad") {
        this.pet.mood = "normal"
      }
    }

    if (
      zone.type === "warm_zone" &&
      (action === "resting" || action === "sleeping" || action === "idle")
    ) {
      this.pet.energy = clamp(
        this.pet.energy + Math.max(1, effect.comfortBonus * 0.04),
        0,
        100
      )

      if (this.pet.mood === "normal") {
        this.pet.mood = "happy"
      }
    }

    if (
      zone.type === "food_zone" &&
      (action === "eating" || this.pet.currentGoal?.type === "satisfy_need")
    ) {
      this.pet.hunger = clamp(this.pet.hunger - 1.5, 0, 100)
      this.pet.energy = clamp(this.pet.energy + 0.6, 0, 100)
    }

    if (
      zone.type === "observation_zone" &&
      (action === "observing" ||
        this.pet.currentGoal?.type === "observe_boundary")
    ) {
      if (this.pet.mood === "alert") {
        this.pet.mood = "curious"
      }
    }

    if (
      zone.type === "exploration_zone" &&
      (action === "exploring" || action === "walking")
    ) {
      this.pet.energy = clamp(this.pet.energy - 0.8, 0, 100)
      this.pet.hunger = clamp(this.pet.hunger + 0.4, 0, 100)
    }
  }

  private buildStateEvents(action: PetAction) {
    switch (action) {
      case "eating":
        return [
          { type: "fed" as const, intensity: 0.6 },
          { type: "time_passed" as const, intensity: 0.15 },
        ]

      case "sleeping":
        return [
          { type: "rested" as const, intensity: 0.9 },
          { type: "time_passed" as const, intensity: 0.1 },
        ]

      case "resting":
        return [
          { type: "rested" as const, intensity: 0.6 },
          { type: "time_passed" as const, intensity: 0.2 },
        ]

      case "exploring":
        return [
          { type: "stimulated" as const, intensity: 1.0 },
          { type: "time_passed" as const, intensity: 0.6 },
        ]

      case "walking":
        return [
          { type: "time_passed" as const, intensity: 0.6 },
          { type: "stimulated" as const, intensity: 0.35 },
        ]

      case "approaching":
        return [
          { type: "bonding" as const, intensity: 0.45 },
          { type: "time_passed" as const, intensity: 0.5 },
        ]

      case "alert_idle":
        return [
          { type: "disturbed" as const, intensity: 0.4 },
          { type: "time_passed" as const, intensity: 0.3 },
        ]

      case "observing":
        return [{ type: "time_passed" as const, intensity: 0.35 }]

      case "idle":
      default:
        return [{ type: "time_passed" as const, intensity: 0.25 }]
    }
  }

  private applyGoalBias(
    goal: PetGoalState | undefined,
    weights: Record<PetAction, number>
  ) {
    if (!goal) return

    switch (goal.type) {
      case "expand_territory":
        weights.exploring += 18
        weights.walking += 10
        weights.observing += 3
        weights.resting -= 4
        break

      case "observe_boundary":
        weights.observing += 18
        weights.alert_idle += 10
        weights.exploring -= 8
        weights.approaching -= 6
        break

      case "restore_self":
        weights.resting += 20
        weights.sleeping += 14
        weights.exploring -= 16
        weights.walking -= 10
        weights.approaching -= 10
        break

      case "satisfy_need":
        weights.eating += 24
        weights.walking += 4
        weights.exploring -= 10
        break

      case "secure_attachment":
        weights.approaching += 18
        weights.observing += 4
        break

      case "preserve_distance":
        weights.alert_idle += 16
        weights.observing += 10
        weights.approaching -= 14
        break

      case "stabilize_state":
        weights.observing += 10
        weights.resting += 10
        weights.idle += 8
        weights.exploring -= 8
        break

      case "idle_drift":
      default:
        weights.idle += 6
        break
    }
  }

  private applyCognitionBias(weights: Record<PetAction, number>) {
    if (!this.pet?.latestCognition) return

    const cognition = this.pet.latestCognition

    if (cognition.reactionTendency === "chase") {
      weights.exploring += 18
      weights.walking += 10
      weights.observing += 6
    }

    if (cognition.reactionTendency === "observe") {
      weights.observing += 16
      weights.alert_idle += 6
    }

    if (cognition.reactionTendency === "avoid") {
      weights.alert_idle += 18
      weights.resting += 4
      weights.approaching -= 10
      weights.exploring -= 6
    }

    if (cognition.reactionTendency === "rest_nearby") {
      weights.resting += 16
      weights.sleeping += 8
      weights.observing += 4
    }

    if (cognition.interpretation === "exciting") {
      weights.exploring += 8
      weights.walking += 6
    }

    if (cognition.interpretation === "comforting") {
      weights.resting += 8
      weights.sleeping += 4
    }

    if (cognition.interpretation === "dangerous") {
      weights.alert_idle += 10
      weights.observing += 6
      weights.approaching -= 8
    }
  }

  private mapDriveToPetAction(
    dominantDrive: DriveType,
    currentGoal?: PetGoalState,
    snapshot?: PetState["timelineSnapshot"],
    driveSnapshot?: DriveSnapshot
  ): PetAction {
    if (!snapshot || !driveSnapshot || !this.pet) {
      this.lastDecisionReason = "bootstrap_default"
      return "idle"
    }

    const state = snapshot.state
    const phaseTag = snapshot.fortune.phaseTag
    const branchTag = snapshot.trajectory.branchTag

    const energy = this.pet.energy
    const hunger = this.pet.hunger
    const emotional = state.emotional.label
    const relational = state.relational.label

    const consciousness = this.pet.consciousnessProfile.bias
    const finalBias = this.pet.finalPersonalityProfile.bias.petBehaviorBias
    const lifePhase = this.pet.lifeState.phase
    const memory = this.pet.memoryState.preferenceBias

    if (energy <= 6) {
      this.lastDecisionReason = "hard_low_energy"
      return "sleeping"
    }

    if (hunger >= 95) {
      this.lastDecisionReason = "hard_extreme_hunger"
      return "eating"
    }

    const weights: Record<PetAction, number> = {
      sleeping: 0,
      resting: 0,
      eating: 0,
      exploring: 0,
      walking: 0,
      approaching: 0,
      observing: 0,
      alert_idle: 0,
      idle: 5,
    }

    const d = driveSnapshot.values

    weights.exploring += d.explore
    weights.walking += d.explore * 0.6
    weights.approaching += d.approach
    weights.walking += d.approach * 0.5
    weights.observing += d.observe
    weights.idle += d.observe * 0.3
    weights.alert_idle += d.avoid * 0.6
    weights.observing += d.avoid * 0.25
    weights.resting += d.rest
    weights.sleeping += d.rest * 0.7
    weights.eating += d.eat

    weights.observing += finalBias.observationNeed * 0.18
    weights.approaching += finalBias.attachmentNeed * 0.12
    weights.exploring += finalBias.explorationRange * 0.14
    weights.resting += finalBias.restNeed * 0.12

    if (lifePhase === "newborn") {
      weights.exploring -= 34
      weights.walking -= 18
      weights.observing += 22
      weights.resting += 18
      weights.approaching += 10
    }

    if (lifePhase === "adaptation") {
      weights.exploring -= 22
      weights.walking -= 8
      weights.observing += 18
      weights.resting += 10
    }

    if (lifePhase === "dependent") {
      weights.exploring -= 10
      weights.approaching += 14
      weights.observing += 8
    }

    if (lifePhase === "curious") {
      weights.exploring += 8
      weights.observing += 5
    }

    if (consciousness.changeSeeking >= 75) {
      weights.exploring += 10
      weights.walking += 6
      weights.idle -= 4
    }

    if (consciousness.observationBias >= 75) {
      weights.observing += 12
      weights.alert_idle += 4
    }

    if (consciousness.attachmentBias >= 75) {
      weights.approaching += 10
    }

    if (consciousness.comfortSeeking >= 75) {
      weights.resting += 10
      weights.sleeping += 8
      weights.exploring -= 8
    }

    if (consciousness.restResistance >= 75) {
      weights.resting -= 8
      weights.sleeping -= 6
      weights.exploring += 6
      weights.walking += 4
    }

    weights.exploring += memory.exploreBias * 0.5
    weights.observing += memory.observeBias * 0.5
    weights.approaching += memory.approachBias * 0.5
    weights.resting += memory.restBias * 0.5
    weights.eating += memory.eatBias * 0.5

    this.applyGoalBias(currentGoal, weights)
    this.applyCognitionBias(weights)

    if (energy < 20) {
      weights.sleeping += 36
      weights.resting += 18
      weights.exploring -= 28
      weights.approaching -= 12
      weights.walking -= 10
    }

    if (energy < 40) {
      weights.resting += 8
      weights.exploring -= 10
    }

    if (hunger > 70) {
      weights.eating += 32
      weights.exploring -= 12
      weights.approaching -= 6
    }

    if (hunger > 85) {
      weights.eating += 18
      weights.resting += 6
      weights.exploring -= 10
      weights.walking -= 8
    }

    if (emotional === "anxious" || emotional === "irritated") {
      weights.alert_idle += 20
      weights.observing += 14
      weights.approaching -= 12
      weights.exploring -= 10

      if (consciousness.riskTolerance >= 75) {
        weights.exploring += 6
        weights.walking += 4
      }
    }

    if (emotional === "alert") {
      weights.observing += 10
      weights.alert_idle += 8
    }

    if (relational === "attached" || relational === "secure") {
      weights.approaching += 14
    }

    if (relational === "guarded" || relational === "distant") {
      weights.approaching -= 12
      weights.observing += 8
    }

    if (phaseTag === "sensitive_phase") {
      weights.observing += 12
      weights.alert_idle += 12
      weights.approaching -= 12
      weights.exploring -= 10
    }

    if (phaseTag === "recovery_phase") {
      weights.resting += 18
      weights.sleeping += 10
      weights.exploring -= 12
      weights.approaching -= 6

      if (consciousness.restResistance >= 80) {
        weights.exploring += 5
        weights.walking += 4
      }
    }

    if (phaseTag === "attachment_phase") {
      weights.approaching += 12
    }

    if (phaseTag === "growth_phase") {
      weights.exploring += 10
      weights.walking += 5
    }

    if (branchTag === "defense") {
      weights.alert_idle += 10
      weights.observing += 8
      weights.exploring -= 10
      weights.approaching -= 8
    }

    if (branchTag === "attachment") {
      weights.approaching += 8
    }

    if (branchTag === "curiosity") {
      weights.exploring += 8
      weights.walking += 4
    }

    weights.walking += Math.random() * 4
    weights.exploring += Math.random() * 3
    weights.observing += Math.random() * 2

    for (const key in weights) {
      if (weights[key as PetAction] < 0) {
        weights[key as PetAction] = 0
      }
    }

    this.lastDecisionReason = "goal_guided_selection"

    return this.pickActionByWeight(weights)
  }

  private applyActionStability(candidate: PetAction): PetAction {
    if (!this.pet) return candidate

    if (!this.actionStability) {
      this.actionStability = {
        currentAction: candidate,
        startedAtTick: this.currentTick,
        lastChangedTick: this.currentTick,
      }

      return candidate
    }

    const current = this.actionStability.currentAction
    const held = this.currentTick - this.actionStability.startedAtTick
    const min = ACTION_MIN_DURATION[current]

    const energy = this.pet.energy
    const hunger = this.pet.hunger

    if (energy <= 6 && current !== "sleeping") {
      this.actionStability = {
        currentAction: "sleeping",
        startedAtTick: this.currentTick,
        lastChangedTick: this.currentTick,
      }

      this.lastDecisionReason = "hard_low_energy"
      return "sleeping"
    }

    if (hunger >= 95 && current !== "eating") {
      this.actionStability = {
        currentAction: "eating",
        startedAtTick: this.currentTick,
        lastChangedTick: this.currentTick,
      }

      this.lastDecisionReason = "hard_extreme_hunger"
      return "eating"
    }

    if (
      attentionSystem.shouldHoldCurrentAction({
        tick: this.currentTick,
        currentAction: current,
        candidateAction: candidate,
      })
    ) {
      this.lastDecisionReason = "attention_hold_current"
      return current
    }

    if (candidate === current) return current

    if (held < min) {
      this.lastDecisionReason = "stability_hold_min_duration"
      return current
    }

    const allowedNextActions = ACTION_TRANSITIONS[current] ?? ["idle"]

    if (!allowedNextActions.includes(candidate)) {
      const bridgeAction = this.resolveBridgeAction(current, candidate)

      this.actionStability = {
        currentAction: bridgeAction,
        startedAtTick: this.currentTick,
        lastChangedTick: this.currentTick,
      }

      this.lastDecisionReason = "stability_accept_transition"
      return bridgeAction
    }

    this.actionStability = {
      currentAction: candidate,
      startedAtTick: this.currentTick,
      lastChangedTick: this.currentTick,
    }

    this.lastDecisionReason = "stability_accept_transition"
    return candidate
  }

  private resolveBridgeAction(
    current: PetAction,
    candidate: PetAction
  ): PetAction {
    if (current === "sleeping") return "idle"
    if (current === "eating") return "idle"
    if (current === "resting") return "idle"
    if (candidate === "exploring" || candidate === "approaching") return "walking"
    if (candidate === "sleeping") return "resting"
    if (candidate === "eating") return "walking"
    if (candidate === "alert_idle") return "observing"

    return "idle"
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
    if (!this.pet || !this.pet.timelineSnapshot) {
      return {
        accepted: false,
        intakeAmount: 0,
        reason: "当前宠物状态不可用",
      }
    }

    if (opportunity.type !== "food_offer") {
      return {
        accepted: false,
        intakeAmount: 0,
        reason: "当前机会不是食物机会",
      }
    }

    const snapshot = this.pet.timelineSnapshot
    const hunger = snapshot.state.physical.hunger
    const energy = snapshot.state.physical.energy
    const emotion = snapshot.state.emotional.label

    const appetiteTrait = this.pet.personalityProfile.traits.appetite
    const comfortSeeking = this.pet.consciousnessProfile.bias.comfortSeeking
    const changeSeeking = this.pet.consciousnessProfile.bias.changeSeeking
    const memoryEatBias = this.pet.memoryState.preferenceBias.eatBias
    const currentGoal = this.pet.currentGoal?.type
    const currentAction = this.pet.action

    const offeredPortion =
      opportunity.payload?.foodPortion ?? Math.round(opportunity.intensity)

    let acceptanceScore = 0

    acceptanceScore += Math.max(0, hunger - 35) * 1.1

    if (energy <= 30) acceptanceScore += 10
    if (currentGoal === "satisfy_need") acceptanceScore += 22
    if (currentAction === "eating") acceptanceScore += 16

    acceptanceScore += (appetiteTrait - 50) * 0.35
    acceptanceScore += memoryEatBias * 0.35
    acceptanceScore += (comfortSeeking - 50) * 0.12

    if (changeSeeking >= 70 && hunger < 65) acceptanceScore -= 8

    if (emotion === "anxious" || emotion === "irritated") {
      if (hunger < 70) acceptanceScore -= 10
      else acceptanceScore -= 4
    }

    if (emotion === "relaxed" || emotion === "content") {
      acceptanceScore += 4
    }

    const accepted = acceptanceScore >= 18

    if (!accepted) {
      return {
        accepted: false,
        intakeAmount: 0,
        reason: "当前自主判断未选择接受食物机会",
      }
    }

    let intakeRatio = 0.35

    intakeRatio += (Math.max(0, hunger - 40) / 100) * 0.45
    intakeRatio += ((appetiteTrait - 50) / 100) * 0.22

    if (currentGoal === "satisfy_need") intakeRatio += 0.16
    if (currentAction === "eating") intakeRatio += 0.12

    if ((emotion === "anxious" || emotion === "irritated") && hunger < 75) {
      intakeRatio -= 0.12
    }

    intakeRatio += (memoryEatBias / 100) * 0.18
    intakeRatio = clamp(intakeRatio, 0.2, 1)

    const intakeAmount = Math.max(
      4,
      Math.min(offeredPortion, Math.round(offeredPortion * intakeRatio))
    )

    let reason = "基于当前身体状态与自主意愿选择了摄食"

    if (currentGoal === "satisfy_need") {
      reason = "当前目标正在满足身体需求"
    } else if (currentAction === "eating") {
      reason = "当前已经进入进食行为，继续完成这次摄食"
    } else if (hunger >= 70) {
      reason = "当前饥饿感较强，因此接受了食物机会"
    }

    return {
      accepted: true,
      intakeAmount,
      reason,
    }
  }

  applyAcceptedFoodOffer(amount: number) {
    this.applyFeeding(amount)
  }

  applyFeeding(amount: number = 15) {
    if (!this.pet?.timelineSnapshot) return

    const physical = this.pet.timelineSnapshot.state.physical

    physical.hunger = Math.max(0, physical.hunger - amount)
    this.pet.hunger = Math.round(physical.hunger)

    physical.energy = Math.min(100, physical.energy + 2)
    this.pet.energy = Math.round(physical.energy)

    this.pet.mood = this.mapTimelineStateToPetMood(
      this.pet.timelineSnapshot.state.emotional.label
    )

    this.lastFeedingTick = this.currentTick
  }

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