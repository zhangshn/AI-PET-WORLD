/**
 * 当前文件负责：根据孵化器、宠物、家园与管家偏置判断管家的当前任务。
 */

import type { GenderAwareBehaviorBias } from "@/ai/gateway"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"

import {
  buildButlerProfileTaskTuning,
  type ButlerProfileTaskTuning,
} from "./butler-profile-tuning"

import {
  buildButlerTaskDecisionTrace,
  type ButlerTaskDecisionGate,
  type ButlerTaskDecisionScore,
} from "./butler-task-decision-trace"

import type {
  ButlerState,
  ButlerSystemInput,
  ButlerTask,
} from "./butler-schema"

type ButlerTaskContext = {
  pet: PetState | null
  incubator: IncubatorState | null
  home: HomeState | null
  time: ButlerSystemInput["time"]
  behaviorBias: GenderAwareBehaviorBias | null
  profileTuning: ButlerProfileTaskTuning
  pendingOpportunityCount: number
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 50
  }

  return Math.max(0, Math.min(100, Math.round(value)))
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

  return clampScore(base + context.profileTuning.carePriorityOffset)
}

function getConstructionDrive(context: ButlerTaskContext): number {
  const base =
    context.behaviorBias?.butlerBehaviorBias.constructionDrive ?? 50

  return clampScore(base + context.profileTuning.constructionDriveOffset)
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
  scores.push({
    key,
    value,
    reason,
  })
}

function pushGate(
  gates: ButlerTaskDecisionGate[],
  key: string,
  passed: boolean,
  reason: string
) {
  gates.push({
    key,
    passed,
    reason,
  })
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
  const foodSensitivity = context.profileTuning.foodSensitivityOffset
  const directThreshold = 58 - Math.max(0, foodSensitivity) * 0.2
  const emotionalThreshold =
    48 -
    Math.max(0, carePriority - 50) * 0.08 -
    Math.max(0, foodSensitivity) * 0.15

  pushScore(scores, "food_hunger", hunger, `当前饥饿=${hunger}，直接食物阈值=${directThreshold.toFixed(2)}。`)
  pushScore(scores, "food_sensitivity", foodSensitivity, "Profile 对食物机会敏感度的调参。")

  if (hunger >= directThreshold) {
    pushGate(gates, "food_direct_hunger", true, "饥饿达到直接提供食物机会阈值。")
    return true
  }

  const emotionNeedsCare =
    emotion === "low" || emotion === "anxious" || emotion === "irritated"
  const passed = hunger >= emotionalThreshold && emotionNeedsCare

  pushGate(
    gates,
    "food_emotional_hunger",
    passed,
    `情绪=${emotion}，饥饿=${hunger}，情绪型食物阈值=${emotionalThreshold.toFixed(2)}。`
  )

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
  const restSensitivity = context.profileTuning.restSensitivityOffset
  const energyThreshold =
    40 +
    Math.max(0, carePriority - 50) * 0.08 +
    Math.max(0, restSensitivity) * 0.2

  pushScore(scores, "rest_energy", energy, `当前能量=${energy}，休息阈值=${energyThreshold.toFixed(2)}。`)
  pushScore(scores, "rest_sensitivity", restSensitivity, "Profile 对休息机会敏感度的调参。")

  if (energy <= energyThreshold) {
    pushGate(gates, "rest_low_energy", true, "能量低于休息阈值，提供休息机会。")
    return true
  }

  if (phaseTag === "recovery_phase") {
    pushGate(gates, "rest_recovery_phase", true, "当前处于 recovery_phase，提供休息机会。")
    return true
  }

  const nightRest = (hour >= 22 || hour <= 5) && energy <= 65

  pushGate(
    gates,
    "rest_night_energy",
    nightRest,
    `当前小时=${hour}，能量=${energy}，夜间且能量不高时可提供休息机会。`
  )

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
  const approachSensitivity = context.profileTuning.approachSensitivityOffset

  const hungerLimit = 65 + Math.max(0, approachSensitivity) * 0.15
  const energyLimit = 35 - Math.max(0, approachSensitivity) * 0.1

  const passed =
    (relation === "secure" || relation === "attached") &&
    hunger < hungerLimit &&
    energy > energyLimit &&
    emotion !== "irritated" &&
    emotion !== "anxious"

  pushScore(scores, "approach_sensitivity", approachSensitivity, "Profile 对靠近机会敏感度的调参。")
  pushScore(scores, "approach_hunger", hunger, `当前饥饿=${hunger}，靠近允许饥饿上限=${hungerLimit.toFixed(2)}。`)
  pushScore(scores, "approach_energy", energy, `当前能量=${energy}，靠近允许能量下限=${energyLimit.toFixed(2)}。`)

  pushGate(
    gates,
    "approach_relation_state",
    passed,
    `关系=${relation}，情绪=${emotion}，饥饿=${hunger}，能量=${energy}。`
  )

  return passed
}

function shouldObserveBeforeActing(
  context: ButlerTaskContext,
  gates: ButlerTaskDecisionGate[],
  scores: ButlerTaskDecisionScore[]
): boolean {
  const observationBias = context.profileTuning.observationBiasOffset

  pushScore(scores, "observation_bias", observationBias, "Profile 对观察优先级的调参。")

  if (observationBias < 8) {
    pushGate(gates, "observe_bias_threshold", false, "观察调参低于 8，不强制先观察。")
    return false
  }

  if (context.pendingOpportunityCount > 0) {
    pushGate(gates, "observe_pending_opportunity", true, "已有待处理机会，管家先观察。")
    return true
  }

  const observing = context.pet?.action === "observing"

  pushGate(
    gates,
    "observe_pet_action",
    observing,
    `宠物当前行为=${context.pet?.action ?? "none"}。`
  )

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

  const constructionDrive = getConstructionDrive(context)
  pushScore(scores, "construction_drive", constructionDrive, "旧行为偏置 + Profile Tuning 后的建设倾向。")

  if (!pet?.timelineSnapshot) {
    pushGate(gates, "build_no_pet_timeline", true, "宠物尚无 timelineSnapshot，允许建设。")
    return true
  }

  const energy = pet.timelineSnapshot.state.physical.energy
  const hunger = pet.timelineSnapshot.state.physical.hunger

  if (shouldPrioritizeNewbornPet(pet)) {
    const passed = constructionDrive >= 72 && energy > 45 && hunger < 55

    pushGate(
      gates,
      "build_newborn_guard",
      passed,
      `宠物处于 ${pet.lifeState.phase}，建设需要 constructionDrive>=72、energy>45、hunger<55。`
    )

    return passed
  }

  if (energy <= 35 || hunger >= 65) {
    const passed = constructionDrive >= 76

    pushGate(
      gates,
      "build_low_state_guard",
      passed,
      `宠物能量=${energy}，饥饿=${hunger}，状态偏低时建设需要 constructionDrive>=76。`
    )

    return passed
  }

  pushGate(gates, "build_default", true, "家园未完成且宠物状态允许，管家可以建设。")
  return true
}

function buildDecisionContext(context: ButlerTaskContext) {
  return {
    hasPet: !!context.pet,
    hasTimelineSnapshot: !!context.pet?.timelineSnapshot,
    incubatorCompleted: isIncubatorCompleted(context.incubator),
    homeCompleted: context.home?.status === "completed",
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
    profileTuning: input.context.profileTuning,
    context: buildDecisionContext(input.context),
  })
}

function choosePetCareTask(input: {
  state: ButlerState
  context: ButlerTaskContext
  gates: ButlerTaskDecisionGate[]
  scores: ButlerTaskDecisionScore[]
}): ButlerTask | null {
  if (shouldObserveBeforeActing(input.context, input.gates, input.scores)) {
    return "watching_pet"
  }

  if (shouldOfferFood(input.context, input.gates, input.scores)) {
    return "offering_food"
  }

  if (shouldOfferRest(input.context, input.gates, input.scores)) {
    return "offering_rest"
  }

  if (shouldOfferApproach(input.context, input.gates, input.scores)) {
    return "offering_approach"
  }

  return null
}

function buildTaskContext(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTaskContext {
  const behaviorBias =
    input.butlerBehaviorBias ??
    state.behaviorBias ??
    input.pet?.lifeProfile.genderAwareBehaviorBias ??
    null

  return {
    pet: input.pet,
    incubator: input.incubator,
    home: input.home,
    time: input.time,
    behaviorBias,
    profileTuning: buildButlerProfileTaskTuning(state.profile),
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
    const careTask = choosePetCareTask({
      state,
      context,
      gates,
      scores,
    })

    if (careTask) {
      commitDecisionTrace({
        state,
        context,
        selectedTask: careTask,
        reason: "宠物已出生，管家根据宠物状态选择照护或机会任务。",
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
        reason: "宠物状态没有触发照护任务，家园仍可建设。",
        gates,
        scores,
      })

      return "building_home"
    }

    commitDecisionTrace({
      state,
      context,
      selectedTask: "watching_pet",
      reason: "宠物已出生，但没有触发机会或建设任务，管家保持观察。",
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
      reason: "宠物尚未出生且孵化器已完成，管家推进家园建设。",
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
    reason: "当前没有孵化器、宠物、家园或机会任务需要处理。",
    gates,
    scores,
  })

  return "idle"
}