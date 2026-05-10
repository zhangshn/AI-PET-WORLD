/**
 * 当前文件负责：根据孵化器、宠物、管家感知、Profile、Relation 与后天记忆判断管家的当前任务。
 */

import type { GenderAwareBehaviorBias } from "@/ai/gateway"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
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
  incubator: IncubatorState | null
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

function petExistsAndBorn(pet: PetState | null): boolean {
  return !!pet
}

function isIncubatorCompleted(incubator: IncubatorState | null): boolean {
  if (!incubator) return true
  return incubator.progress >= 100 || incubator.status === "hatched"
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
    goalTag === "home_goal_build_temporary_shelter" ||
    goalTag === "home_goal_complete_basic_living" ||
    goalTag === "home_goal_maintain_home_facilities" ||
    goalTag === "home_goal_open_garden_area" ||
    goalTag === "home_goal_prepare_future_expansion"
  )
}

function shouldPrioritizeNewbornPet(pet: PetState | null): boolean {
  if (!pet) return false
  return pet.lifeState.phase === "newborn" || pet.lifeState.phase === "adaptation"
}

function getPetEnergy(context: ButlerTaskContext): number | null {
  return context.pet?.timelineSnapshot?.state.physical.energy ?? null
}

function getPetHunger(context: ButlerTaskContext): number | null {
  return context.pet?.timelineSnapshot?.state.physical.hunger ?? null
}

function getPetEmotion(context: ButlerTaskContext): string | null {
  return context.pet?.timelineSnapshot?.state.emotional.label ?? null
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
  pushScore(
    scores,
    "experience_interpreter",
    context.experienceInterpretation.mode === "profile_led" ? 1 : 0,
    `关系事实解释模式=${context.experienceInterpretation.mode}，来源=${context.experienceInterpretation.profileSource}。`
  )
  pushScore(scores, "dominant_interpretation", 1, `dominantInterpretation=${context.experienceInterpretation.dominantInterpretation}。`)
  pushScore(scores, "suggested_posture", 1, `suggestedPosture=${context.experienceInterpretation.suggestedPosture}。`)
  pushScore(scores, "relation_care_priority", context.relationTuning.carePriorityOffset, "Relation / GoalExecutionMemory 作为事实输入，经 ButlerProfile / 八字解释后，对照护优先级形成轻量调参。")
  pushScore(scores, "relation_observation_bias", context.relationTuning.observationBiasOffset, "Relation / GoalExecutionMemory 作为事实输入，经 ButlerProfile / 八字解释后，对观察倾向形成轻量调参。")
  pushScore(scores, "relation_approach_sensitivity", context.relationTuning.approachSensitivityOffset, "Relation / GoalExecutionMemory 作为事实输入，经 ButlerProfile / 八字解释后，对靠近机会形成轻量调参。")
  pushScore(scores, "butler_perception_signal", getPerceptionIntensity(context), context.butlerWorldPerception?.summary ?? "管家当前没有明确世界感知线索。")

  for (const [index, reason] of context.experienceInterpretation.reasons.slice(0, 4).entries()) {
    pushScore(scores, `experience_reason_${index + 1}`, 1, reason)
  }

  for (const [index, tag] of context.experienceInterpretation.interpretationTags
    .filter((tag) => tag.startsWith("goal_memory_"))
    .slice(0, 6)
    .entries()) {
    pushScore(scores, `goal_memory_tag_${index + 1}`, 1, tag)
  }
}

function pushEducationStrategyScores(
  context: ButlerTaskContext,
  scores: ButlerTaskDecisionScore[]
) {
  pushScore(scores, "education_posture", 1, `educationPosture=${context.educationStrategy.posture}。`)
  pushScore(scores, "education_food_intensity_offset", context.educationStrategy.foodIntensityOffset, "Education strategy 根据宠物机会反馈与关系状态，对食物机会强度形成轻量调整。")
  pushScore(scores, "education_rest_intensity_offset", context.educationStrategy.restIntensityOffset, "Education strategy 根据宠物机会反馈与关系状态，对休息机会强度形成轻量调整。")
  pushScore(scores, "education_approach_intensity_offset", context.educationStrategy.approachIntensityOffset, "Education strategy 根据宠物机会反馈与关系状态，对靠近机会强度形成轻量调整。")
  pushScore(scores, "education_reason", 1, context.educationStrategy.reason)

  for (const [index, tag] of context.educationStrategy.tags.slice(0, 6).entries()) {
    pushScore(scores, `education_tag_${index + 1}`, 1, tag)
  }
}

function shouldOfferFood(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const { pet } = context
  if (!pet?.timelineSnapshot) {
    pushGate(gates, "food_has_timeline", false, "宠物没有 timelineSnapshot，不能判断食物机会。")
    return false
  }

  const hunger = pet.timelineSnapshot.state.physical.hunger
  const emotion = pet.timelineSnapshot.state.emotional.label
  const carePriority = getCarePriority(context)
  const foodSensitivity = context.effectiveTuning.foodSensitivityOffset
  const directThreshold = 58 - Math.max(0, foodSensitivity) * 0.2
  const emotionalThreshold =
    48 - Math.max(0, carePriority - 50) * 0.08 - Math.max(0, foodSensitivity) * 0.15

  pushScore(scores, "food_hunger", hunger, `当前饥饿=${hunger}，直接食物阈值=${directThreshold.toFixed(2)}。`)
  pushScore(scores, "food_sensitivity", foodSensitivity, "Profile + Relation + GoalExecutionMemory 后的食物机会敏感度。")

  if (hunger >= directThreshold) {
    pushGate(gates, "food_direct_hunger", true, "饥饿达到直接提供食物机会阈值。")
    return true
  }

  const emotionNeedsCare = emotion === "low" || emotion === "anxious" || emotion === "irritated"
  const passed = hunger >= emotionalThreshold && emotionNeedsCare
  pushGate(gates, "food_emotional_hunger", passed, `情绪=${emotion}，饥饿=${hunger}，情绪型食物阈值=${emotionalThreshold.toFixed(2)}。`)
  return passed
}

function shouldOfferRest(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const { pet, time } = context
  if (!pet?.timelineSnapshot) {
    pushGate(gates, "rest_has_timeline", false, "宠物没有 timelineSnapshot，不能判断休息机会。")
    return false
  }

  const energy = pet.timelineSnapshot.state.physical.energy
  const phaseTag = pet.timelineSnapshot.fortune.phaseTag
  const hour = time.hour
  const carePriority = getCarePriority(context)
  const restSensitivity = context.effectiveTuning.restSensitivityOffset
  const energyThreshold =
    40 + Math.max(0, carePriority - 50) * 0.08 + Math.max(0, restSensitivity) * 0.2

  pushScore(scores, "rest_energy", energy, `当前能量=${energy}，休息阈值=${energyThreshold.toFixed(2)}。`)
  pushScore(scores, "rest_sensitivity", restSensitivity, "Profile + Relation + GoalExecutionMemory 后的休息机会敏感度。")

  if (energy <= energyThreshold) {
    pushGate(gates, "rest_low_energy", true, "能量低于休息阈值，提供休息机会。")
    return true
  }

  if (phaseTag === "recovery_phase") {
    pushGate(gates, "rest_recovery_phase", true, "当前处于 recovery_phase，提供休息机会。")
    return true
  }

  const nightRest = (hour >= 22 || hour <= 5) && energy <= 65
  pushGate(gates, "rest_night_energy", nightRest, `当前小时=${hour}，能量=${energy}，夜间且能量不高时可提供休息机会。`)
  return nightRest
}

function shouldOfferApproach(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const { pet } = context
  if (!pet?.timelineSnapshot) {
    pushGate(gates, "approach_has_timeline", false, "宠物没有 timelineSnapshot，不能判断靠近机会。")
    return false
  }

  const relation = pet.timelineSnapshot.state.relational.label
  const emotion = pet.timelineSnapshot.state.emotional.label
  const hunger = pet.timelineSnapshot.state.physical.hunger
  const energy = pet.timelineSnapshot.state.physical.energy
  const approachSensitivity = context.effectiveTuning.approachSensitivityOffset
  const hungerLimit = 65 + Math.max(0, approachSensitivity) * 0.15
  const energyLimit = 35 - Math.max(0, approachSensitivity) * 0.1
  const passed =
    (relation === "secure" || relation === "attached") &&
    hunger < hungerLimit &&
    energy > energyLimit &&
    emotion !== "irritated" &&
    emotion !== "anxious"

  pushScore(scores, "approach_sensitivity", approachSensitivity, "Profile + Relation + GoalExecutionMemory 后的靠近机会敏感度。")
  pushScore(scores, "approach_hunger", hunger, `当前饥饿=${hunger}，靠近允许饥饿上限=${hungerLimit.toFixed(2)}。`)
  pushScore(scores, "approach_energy", energy, `当前能量=${energy}，靠近允许能量下限=${energyLimit.toFixed(2)}。`)
  pushGate(gates, "approach_relation_state", passed, `关系=${relation}，情绪=${emotion}，饥饿=${hunger}，能量=${energy}。`)
  return passed
}

function shouldObserveBeforeActing(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const observationBias = context.effectiveTuning.observationBiasOffset
  pushScore(scores, "observation_bias", observationBias, "Profile + Relation + GoalExecutionMemory 后的观察优先级调参。")

  if (observationBias < 8) {
    pushGate(gates, "observe_bias_threshold", false, "观察调参低于 8，不强制先观察。")
    return false
  }

  if (context.pendingOpportunityCount > 0) {
    pushGate(gates, "observe_pending_opportunity", true, "已有待处理机会，管家先观察。")
    return true
  }

  const observing = context.pet?.action === "observing"
  pushGate(gates, "observe_pet_action", observing, `宠物当前行为=${context.pet?.action ?? "none"}。`)
  return observing
}

function shouldBuildHome(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const { home, pet, incubator } = context

  if (!home) {
    pushGate(gates, "build_has_home", false, "没有家园状态，不能建设。")
    return false
  }

  if (!isIncubatorCompleted(incubator)) {
    pushGate(gates, "build_incubator_completed", false, "孵化器未完成，管家优先照看孵化器。")
    return false
  }

  if (home.status === "completed") {
    pushGate(gates, "build_home_not_completed", false, "家园已经完成，不需要继续建设。")
    return false
  }

  const perceptionAllowsConstruction = hasConstructionPerception(context)
  pushGate(
    gates,
    "build_perception_context",
    perceptionAllowsConstruction,
    context.butlerWorldPerception
      ? `${context.butlerWorldPerception.summary} 该感知只作为建设倾向线索，不是命令。`
      : "管家没有明确建设类感知线索。"
  )

  if (!perceptionAllowsConstruction) {
    return false
  }

  const constructionDrive = clampScore(
    getConstructionDrive(context) + getPerceptionIntensity(context) * 0.08
  )
  pushScore(
    scores,
    "construction_drive",
    constructionDrive,
    "旧行为偏置 + Profile + Relation + GoalExecutionMemory + ButlerWorldPerception 后的建设倾向。"
  )

  if (!pet?.timelineSnapshot) {
    pushGate(gates, "build_no_pet_timeline", true, "宠物尚无 timelineSnapshot，允许根据管家感知推进建设。")
    return true
  }

  const energy = pet.timelineSnapshot.state.physical.energy
  const hunger = pet.timelineSnapshot.state.physical.hunger

  if (shouldPrioritizeNewbornPet(pet)) {
    const passed = constructionDrive >= 72 && energy > 45 && hunger < 55
    pushGate(gates, "build_newborn_guard", passed, `宠物处于 ${pet.lifeState.phase}，建设需要 constructionDrive>=72、energy>45、hunger<55。`)
    return passed
  }

  if (energy <= 35 || hunger >= 65) {
    const passed = constructionDrive >= 76
    pushGate(gates, "build_low_state_guard", passed, `宠物能量=${energy}，饥饿=${hunger}，状态偏低时建设需要 constructionDrive>=76。`)
    return passed
  }

  pushGate(gates, "build_default", true, "家园未完成，且管家感知到建设/维护/空间整理线索，宠物状态允许。")
  return true
}

function buildDecisionContext(context: ButlerTaskContext) {
  return {
    hasPet: !!context.pet,
    hasTimelineSnapshot: !!context.pet?.timelineSnapshot,
    incubatorCompleted: isIncubatorCompleted(context.incubator),
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
    incubator: input.incubator,
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

  if (!isIncubatorCompleted(context.incubator)) {
    commitDecisionTrace({
      state,
      context,
      selectedTask: "watching_incubator",
      reason: "孵化器尚未完成，管家优先照看孵化器。",
      gates,
      scores,
    })
    return "watching_incubator"
  }

  if (petExistsAndBorn(context.pet)) {
    const careTask = choosePetCareTask({ context, gates, scores })

    if (careTask) {
      commitDecisionTrace({
        state,
        context,
        selectedTask: careTask,
        reason: "宠物已出生，管家根据宠物状态、ButlerProfile 与 Relation 事实解释选择照护或机会任务。",
        gates,
        scores,
      })
      return careTask
    }

    if (shouldBuildHome(context, gates, scores)) {
      commitDecisionTrace({
        state,
        context,
        selectedTask: "building_home",
        reason: "宠物状态没有触发照护任务，管家根据世界感知线索形成家园管理倾向。",
        gates,
        scores,
      })
      return "building_home"
    }

    commitDecisionTrace({
      state,
      context,
      selectedTask: "watching_pet",
      reason: "宠物已出生，但没有触发机会或感知驱动的建设任务，管家保持观察。",
      gates,
      scores,
    })
    return "watching_pet"
  }

  if (shouldBuildHome(context, gates, scores)) {
    commitDecisionTrace({
      state,
      context,
      selectedTask: "building_home",
      reason: "宠物尚未出生且孵化器已完成，管家根据世界感知线索推进家园管理。",
      gates,
      scores,
    })
    return "building_home"
  }

  if (context.pendingOpportunityCount > 0) {
    commitDecisionTrace({
      state,
      context,
      selectedTask: "watching_pet",
      reason: "存在待处理机会，管家保持观察。",
      gates,
      scores,
    })
    return "watching_pet"
  }

  commitDecisionTrace({
    state,
    context,
    selectedTask: "idle",
    reason: "当前没有孵化器、宠物、家园感知或机会任务需要处理。",
    gates,
    scores,
  })

  return "idle"
}
