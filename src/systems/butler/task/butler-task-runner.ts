/**
 * 当前文件职责：根据宠物、家园、管家感知、Profile、Relation 与后天记忆判断管家的当前任务。
 */

import type { GenderAwareBehaviorBias } from "@/ai/ai-system-gateway"
import type { HomeState } from "@/types/home"
import type { PetState } from "@/types/pet"
import type {
  ButlerWorldPerceptionSnapshot,
} from "@/systems/agent-perception/agent-world-perception"

import {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "../butler-profile-tuning"

import {
  buildButlerExperienceInterpretation,
  type ButlerExperienceInterpretation,
  type ButlerRelationTaskTuning,
} from "../memory-relation/butler-relation-tuning"

import {
  buildButlerEducationStrategy,
  type ButlerEducationStrategy,
} from "../education/butler-education-gateway"

import {
  buildButlerTaskDecisionTrace,
  type ButlerTaskDecisionGate,
  type ButlerTaskDecisionScore,
} from "./butler-task-decision-trace"

import type {
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "../butler-schema"

type ButlerTaskContext = {
  pet: PetState | null
  home: HomeState | null
  butlerWorldPerception: ButlerWorldPerceptionSnapshot | null
  time: ButlerSystemInput["time"]
  behaviorBias: GenderAwareBehaviorBias | null
  profileTuning: ButlerProfileTaskTuning
  relationTuning: ButlerRelationTaskTuning
  educationStrategy: ButlerEducationStrategy
  experienceInterpretation: ButlerExperienceInterpretation
  effectiveTuning: ButlerProfileTaskTuning
  pendingOpportunityCount: number
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.max(0, Math.min(100, Math.round(value)))
}

function mergeTaskTuning(input: {
  profileTuning: ButlerProfileTaskTuning
  relationTuning: ButlerRelationTaskTuning
}): ButlerProfileTaskTuning {
  return {
    carePriorityOffset:
      input.profileTuning.carePriorityOffset + input.relationTuning.carePriorityOffset,
    constructionDriveOffset:
      input.profileTuning.constructionDriveOffset + input.relationTuning.constructionDriveOffset,
    foodSensitivityOffset:
      input.profileTuning.foodSensitivityOffset + input.relationTuning.foodSensitivityOffset,
    restSensitivityOffset:
      input.profileTuning.restSensitivityOffset + input.relationTuning.restSensitivityOffset,
    approachSensitivityOffset:
      input.profileTuning.approachSensitivityOffset + input.relationTuning.approachSensitivityOffset,
    observationBiasOffset:
      input.profileTuning.observationBiasOffset + input.relationTuning.observationBiasOffset,
  }
}

function getCarePriority(context: ButlerTaskContext): number {
  const base = context.behaviorBias?.butlerBehaviorBias.carePriority ?? 50
  return clampScore(base + context.effectiveTuning.carePriorityOffset)
}

function getConstructionDrive(context: ButlerTaskContext): number {
  const base = context.behaviorBias?.butlerBehaviorBias.constructionDrive ?? 50
  return clampScore(base + context.effectiveTuning.constructionDriveOffset)
}

function getPerceptionSignalKind(context: ButlerTaskContext): string {
  return context.butlerWorldPerception?.tags.find((tag) =>
    tag.startsWith("signal_")
  ) ?? "signal_none"
}

function getPerceptionHomeGoalTag(context: ButlerTaskContext): string {
  return context.butlerWorldPerception?.tags.find((tag) =>
    tag.startsWith("home_goal_")
  ) ?? "home_goal_none"
}

function getPerceptionIntensity(context: ButlerTaskContext): number {
  return context.butlerWorldPerception?.perceivedSignals[0]?.intensity ?? 0
}

function hasConstructionPerception(context: ButlerTaskContext): boolean {
  const signalKind = getPerceptionSignalKind(context)
  const goalTag = getPerceptionHomeGoalTag(context)

  return (
    signalKind === "signal_construction_context" ||
    signalKind === "signal_maintenance_context" ||
    signalKind === "signal_exploration_context" ||
    goalTag === "home_goal_stabilize_initial_care" ||
    goalTag === "home_goal_build_temporary_shelter" ||
    goalTag === "home_goal_complete_basic_living" ||
    goalTag === "home_goal_maintain_home_facilities" ||
    goalTag === "home_goal_open_garden_area" ||
    goalTag === "home_goal_prepare_future_expansion"
  )
}

function petExists(pet: PetState | null): boolean {
  return !!pet
}

function getPetEnergy(context: ButlerTaskContext): number | null {
  return context.pet?.timelineSnapshot?.state.physical.energy ?? context.pet?.energy ?? null
}

function getPetHunger(context: ButlerTaskContext): number | null {
  return context.pet?.timelineSnapshot?.state.physical.hunger ?? context.pet?.hunger ?? null
}

function getPetEmotion(context: ButlerTaskContext): string | null {
  return context.pet?.timelineSnapshot?.state.emotional.label ?? context.pet?.mood ?? null
}

function getPetRelation(context: ButlerTaskContext): string | null {
  return context.pet?.timelineSnapshot?.state.relational.label ?? null
}

function pushScore(
  scores: ButlerTaskDecisionScore[],
  key: string,
  value: number,
  reason: string
) {
  scores.push({ key, value, reason })
}

function pushGate(
  gates: ButlerTaskDecisionGate[],
  key: string,
  passed: boolean,
  reason: string
) {
  gates.push({ key, passed, reason })
}

function pushTuningScores(
  context: ButlerTaskContext,
  scores: ButlerTaskDecisionScore[]
) {
  pushScore(scores, "experience_interpreter", 1, `mode=${context.experienceInterpretation.mode}`)
  pushScore(scores, "dominant_interpretation", 1, `dominant=${context.experienceInterpretation.dominantInterpretation}`)
  pushScore(scores, "relation_care_priority", context.relationTuning.carePriorityOffset, "relation tuning affects care priority")
  pushScore(scores, "relation_observation_bias", context.relationTuning.observationBiasOffset, "relation tuning affects observation")
  pushScore(scores, "butler_perception_signal", getPerceptionIntensity(context), context.butlerWorldPerception?.summary ?? "no explicit world perception")
}

function pushEducationStrategyScores(
  context: ButlerTaskContext,
  scores: ButlerTaskDecisionScore[]
) {
  pushScore(scores, "education_posture", 1, `posture=${context.educationStrategy.posture}`)
  pushScore(scores, "education_food_intensity_offset", context.educationStrategy.foodIntensityOffset, "education strategy food offset")
  pushScore(scores, "education_rest_intensity_offset", context.educationStrategy.restIntensityOffset, "education strategy rest offset")
  pushScore(scores, "education_approach_intensity_offset", context.educationStrategy.approachIntensityOffset, "education strategy approach offset")
}

function shouldOfferFood(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const hunger = getPetHunger(context)
  if (hunger === null) {
    pushGate(gates, "food_has_pet_state", false, "no accepted pet state for food opportunity")
    return false
  }

  const threshold = 58 - Math.max(0, context.effectiveTuning.foodSensitivityOffset) * 0.2
  pushScore(scores, "food_hunger", hunger, `threshold=${threshold.toFixed(2)}`)
  const passed = hunger >= threshold
  pushGate(gates, "food_hunger_threshold", passed, "food opportunity only evaluates existing accepted pet state")
  return passed
}

function shouldOfferRest(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const energy = getPetEnergy(context)
  if (energy === null) {
    pushGate(gates, "rest_has_pet_state", false, "no accepted pet state for rest opportunity")
    return false
  }

  const threshold =
    40 +
    Math.max(0, getCarePriority(context) - 50) * 0.08 +
    Math.max(0, context.effectiveTuning.restSensitivityOffset) * 0.2
  pushScore(scores, "rest_energy", energy, `threshold=${threshold.toFixed(2)}`)
  const passed = energy <= threshold
  pushGate(gates, "rest_energy_threshold", passed, "rest opportunity only evaluates existing accepted pet state")
  return passed
}

function shouldOfferApproach(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const relation = getPetRelation(context)
  const energy = getPetEnergy(context)
  const hunger = getPetHunger(context)
  const passed =
    (relation === "secure" || relation === "attached") &&
    (energy ?? 0) > 35 &&
    (hunger ?? 100) < 65

  pushScore(scores, "approach_sensitivity", context.effectiveTuning.approachSensitivityOffset, "approach opportunity sensitivity")
  pushGate(gates, "approach_relation_state", passed, `relation=${relation ?? "none"}`)
  return passed
}

function shouldObserveBeforeActing(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const observationBias = context.effectiveTuning.observationBiasOffset
  pushScore(scores, "observation_bias", observationBias, "observation tuning")

  const passed = observationBias >= 8 && context.pendingOpportunityCount > 0
  pushGate(gates, "observe_before_opportunity", passed, "butler can observe before handling pending opportunities")
  return passed
}

function shouldBuildHome(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  if (!context.home) {
    pushGate(gates, "build_has_home", false, "no HomeState available")
    return false
  }

  if (context.home.status === "completed") {
    pushGate(gates, "build_home_not_completed", false, "home already completed")
    return false
  }

  const perceptionAllowsConstruction = hasConstructionPerception(context)
  pushGate(
    gates,
    "build_perception_context",
    perceptionAllowsConstruction,
    context.butlerWorldPerception?.summary ?? "no construction perception"
  )

  const constructionDrive = clampScore(
    getConstructionDrive(context) + getPerceptionIntensity(context) * 0.08
  )
  pushScore(scores, "construction_drive", constructionDrive, "home management drive")

  return perceptionAllowsConstruction || constructionDrive >= 55
}

function buildDecisionContext(context: ButlerTaskContext) {
  return {
    hasPet: !!context.pet,
    hasTimelineSnapshot: !!context.pet?.timelineSnapshot,
    homeCompleted: context.home?.status === "completed",
    butlerPerceptionSummary: context.butlerWorldPerception?.summary ?? null,
    butlerPerceptionSignal: getPerceptionSignalKind(context),
    butlerPerceptionHomeGoal: getPerceptionHomeGoalTag(context),
    pendingOpportunityCount: context.pendingOpportunityCount,
    petEnergy: getPetEnergy(context),
    petHunger: getPetHunger(context),
    petEmotion: getPetEmotion(context),
    petRelation: getPetRelation(context),
    petLifePhase: context.pet?.lifeState.phase ?? null,
    timeHour: context.time.hour,
    timePeriod: context.time.period,
  }
}

function commitDecisionTrace(input: {
  state: ButlerState
  context: ButlerTaskContext
  selectedTask: ButlerTask
  reason: string
  gates: ButlerTaskDecisionGate[]
  scores: ButlerTaskDecisionScore[]
}) {
  input.state.latestTaskDecisionTrace = buildButlerTaskDecisionTrace({
    selectedTask: input.selectedTask,
    previousTask: input.state.task,
    reason: input.reason,
    gates: input.gates,
    scores: input.scores,
    profileTuning: input.context.effectiveTuning,
    experienceInterpretation: input.context.experienceInterpretation,
    context: buildDecisionContext(input.context),
  })
}

function choosePetCareTask(input: {
  context: ButlerTaskContext
  gates: ButlerTaskDecisionGate[]
  scores: ButlerTaskDecisionScore[]
}): ButlerTask | null {
  if (shouldObserveBeforeActing(input.context, input.gates, input.scores)) return "watching_pet"
  if (shouldOfferFood(input.context, input.gates, input.scores)) return "offering_food"
  if (shouldOfferRest(input.context, input.gates, input.scores)) return "offering_rest"
  if (shouldOfferApproach(input.context, input.gates, input.scores)) return "offering_approach"
  return null
}

function buildTaskContext(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTaskContext {
  const behaviorBias =
    input.butlerBehaviorBias ?? state.profile?.behaviorBias ?? state.behaviorBias ?? null
  const profileTuning = buildButlerProfileTaskTuning(state.profile)
  const experienceInterpretation = buildButlerExperienceInterpretation({
    relation: state.relation,
    profile: state.profile,
    memory: state.memory,
  })
  const relationTuning = experienceInterpretation.tuning
  const educationStrategy = buildButlerEducationStrategy(state.relation)

  return {
    pet: input.pet,
    home: input.home,
    butlerWorldPerception: input.butlerWorldPerception ?? null,
    time: input.time,
    behaviorBias,
    profileTuning,
    relationTuning,
    educationStrategy,
    experienceInterpretation,
    effectiveTuning: mergeTaskTuning({ profileTuning, relationTuning }),
    pendingOpportunityCount: state.pendingOpportunities.length,
  }
}

export function chooseButlerTask(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTask {
  const context = buildTaskContext(input, state)
  const gates: ButlerTaskDecisionGate[] = []
  const scores: ButlerTaskDecisionScore[] = []

  pushTuningScores(context, scores)
  pushEducationStrategyScores(context, scores)

  if (petExists(context.pet)) {
    const careTask = choosePetCareTask({ context, gates, scores })

    if (careTask) {
      commitDecisionTrace({
        state,
        context,
        selectedTask: careTask,
        reason: "宠物已通过后置关系进入系统，管家根据宠物状态选择照护或机会任务。",
        gates,
        scores,
      })
      return careTask
    }

    if (!shouldBuildHome(context, gates, scores)) {
      commitDecisionTrace({
        state,
        context,
        selectedTask: "watching_pet",
        reason: "宠物已进入系统，但当前没有更强的家园建设任务，管家保持观察。",
        gates,
        scores,
      })
      return "watching_pet"
    }
  }

  if (shouldBuildHome(context, gates, scores)) {
    commitDecisionTrace({
      state,
      context,
      selectedTask: "building_home",
      reason: "管家根据世界感知与家园状态推进初始家园管理。",
      gates,
      scores,
    })
    return "building_home"
  }

  commitDecisionTrace({
    state,
    context,
    selectedTask: "idle",
    reason: "当前没有宠物后置关系、家园感知或机会任务需要处理。",
    gates,
    scores,
  })

  return "idle"
}
