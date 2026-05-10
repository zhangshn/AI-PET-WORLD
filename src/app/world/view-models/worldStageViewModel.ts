/**
 * 当前文件负责：把世界后台状态收束成主舞台可读的展示数据。
 *
 * 注意：
 * 这里是展示层 ViewModel，不修改世界、不改变宠物行为、不改变管家任务。
 */

import type { WorldStimulus } from "@/ai/gateway"
import type { TimeState } from "@/engine/timeSystem"
import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

export type WorldStageActorViewModel = {
  id: "pet" | "butler"
  name: string
  visible: boolean
  actionLabel: string
  moodLabel: string
  intentionSummary: string
  perceptionSummary: string | null
  interpretationSummary: string | null
  lifeLineSummary: string | null
  tags: string[]
}

export type WorldStageHomeViewModel = {
  statusLabel: string
  phaseLabel: string | null
  mainGoal: string | null
  stability: number | null
  activeGoalCount: number
  summary: string
  tags: string[]
}

export type WorldStageIncubatorViewModel = {
  visible: boolean
  statusLabel: string
  progress: number
  summary: string
  tags: string[]
}

export type WorldStageEnvironmentViewModel = {
  timeLabel: string
  ecologyLabel: string | null
  runtimeLabel: string | null
  activeStimulusCount: number
  summary: string
  tags: string[]
}

export type WorldStageViewModel = {
  title: string
  tickLabel: string
  environment: WorldStageEnvironmentViewModel
  pet: WorldStageActorViewModel
  butler: WorldStageActorViewModel
  home: WorldStageHomeViewModel
  incubator: WorldStageIncubatorViewModel
  visibleStorySummary: string
  tags: string[]
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatTime(time: TimeState | null): string {
  if (!time) return "世界时间未初始化"

  return `Day ${time.day} · ${String(time.hour).padStart(2, "0")}:00 · ${time.period}`
}

function buildPetActorViewModel(pet: PetState | null): WorldStageActorViewModel {
  if (!pet) {
    return {
      id: "pet",
      name: "宠物",
      visible: false,
      actionLabel: "尚未出生",
      moodLabel: "等待中",
      intentionSummary: "胚胎仍在孵化，宠物意识尚未进入世界舞台。",
      perceptionSummary: null,
      interpretationSummary: null,
      lifeLineSummary: null,
      tags: ["actor_pet", "pet_not_born"],
    }
  }

  return {
    id: "pet",
    name: pet.name,
    visible: true,
    actionLabel: pet.action,
    moodLabel: pet.mood,
    intentionSummary: pet.currentGoal?.summary ?? "宠物正在根据自己的状态观察世界。",
    perceptionSummary: pet.latestWorldPerception?.summary ?? null,
    interpretationSummary: pet.latestWorldInterpretation?.summary ?? null,
    lifeLineSummary: pet.latestLifeLineInfluence?.summary ?? null,
    tags: [
      "actor_pet",
      `pet_action_${pet.action}`,
      `pet_mood_${pet.mood}`,
      pet.currentGoal ? `pet_goal_${pet.currentGoal.type}` : "pet_goal_none",
      pet.latestWorldInterpretation?.dominantMeaning
        ? `pet_interpretation_${pet.latestWorldInterpretation.dominantMeaning}`
        : "pet_interpretation_none",
    ],
  }
}

function buildButlerActorViewModel(
  butler: ButlerState | null
): WorldStageActorViewModel {
  if (!butler) {
    return {
      id: "butler",
      name: "管家",
      visible: false,
      actionLabel: "未进入世界",
      moodLabel: "等待中",
      intentionSummary: "管家尚未进入世界运行。",
      perceptionSummary: null,
      interpretationSummary: null,
      lifeLineSummary: null,
      tags: ["actor_butler", "butler_missing"],
    }
  }

  return {
    id: "butler",
    name: butler.name,
    visible: true,
    actionLabel: butler.task,
    moodLabel: butler.mood,
    intentionSummary:
      butler.latestBehaviorExecution?.summary ??
      butler.latestTaskDecisionTrace?.reason ??
      "管家正在观察世界运行。",
    perceptionSummary: null,
    interpretationSummary: butler.latestWorldInterpretation?.summary ?? null,
    lifeLineSummary: null,
    tags: [
      "actor_butler",
      `butler_task_${butler.task}`,
      `butler_mood_${butler.mood}`,
      butler.latestWorldInterpretation?.dominantMeaning
        ? `butler_interpretation_${butler.latestWorldInterpretation.dominantMeaning}`
        : "butler_interpretation_none",
    ],
  }
}

function buildHomeViewModel(home: HomeState | null): WorldStageHomeViewModel {
  if (!home) {
    return {
      statusLabel: "未初始化",
      phaseLabel: null,
      mainGoal: null,
      stability: null,
      activeGoalCount: 0,
      summary: "家园尚未初始化。",
      tags: ["home_missing"],
    }
  }

  return {
    statusLabel: home.status,
    phaseLabel: home.lifecycle?.phase ?? null,
    mainGoal: home.lifecycle?.mainGoal ?? null,
    stability: clampProgress(home.stability),
    activeGoalCount: home.homeGoals?.length ?? 0,
    summary:
      home.lifecycle?.summary ??
      `家园当前状态为 ${home.status}，稳定度 ${clampProgress(home.stability)}。`,
    tags: [
      "home_stage",
      `home_status_${home.status}`,
      home.lifecycle ? `home_phase_${home.lifecycle.phase}` : "home_phase_none",
    ],
  }
}

function buildIncubatorViewModel(
  incubator: IncubatorState | null
): WorldStageIncubatorViewModel {
  if (!incubator) {
    return {
      visible: false,
      statusLabel: "无孵化器",
      progress: 0,
      summary: "当前没有孵化器状态。",
      tags: ["incubator_missing"],
    }
  }

  return {
    visible: true,
    statusLabel: incubator.status,
    progress: clampProgress(incubator.progress),
    summary: `孵化器状态 ${incubator.status}，进度 ${clampProgress(incubator.progress)}%。`,
    tags: ["incubator_stage", `incubator_status_${incubator.status}`],
  }
}

function buildEnvironmentViewModel(input: {
  time: TimeState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
}): WorldStageEnvironmentViewModel {
  const ecologyLabel = input.ecology
    ? `生态区 ${input.ecology.zones.length}`
    : null
  const runtimeLabel = input.worldRuntime
    ? `世界运行层已激活`
    : null

  return {
    timeLabel: formatTime(input.time),
    ecologyLabel,
    runtimeLabel,
    activeStimulusCount: input.stimuli.length,
    summary: `${formatTime(input.time)}，当前有 ${input.stimuli.length} 个世界刺激。`,
    tags: [
      "environment_stage",
      input.ecology ? "ecology_active" : "ecology_missing",
      input.worldRuntime ? "runtime_active" : "runtime_missing",
    ],
  }
}

function buildVisibleStorySummary(input: {
  pet: WorldStageActorViewModel
  butler: WorldStageActorViewModel
  home: WorldStageHomeViewModel
  incubator: WorldStageIncubatorViewModel
}): string {
  if (!input.pet.visible && input.incubator.visible) {
    return `${input.butler.name}正在守着${input.incubator.statusLabel}的孵化器，家园仍处在${input.home.statusLabel}阶段。`
  }

  if (input.pet.visible) {
    return `${input.pet.name}正在${input.pet.actionLabel}，${input.butler.name}当前任务是${input.butler.actionLabel}。${input.home.summary}`
  }

  return input.home.summary
}

export function buildWorldStageViewModel(input: {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  home: HomeState | null
  incubator: IncubatorState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
  tick: number
}): WorldStageViewModel {
  const pet = buildPetActorViewModel(input.pet)
  const butler = buildButlerActorViewModel(input.butler)
  const home = buildHomeViewModel(input.home)
  const incubator = buildIncubatorViewModel(input.incubator)
  const environment = buildEnvironmentViewModel({
    time: input.time,
    stimuli: input.stimuli,
    ecology: input.ecology,
    worldRuntime: input.worldRuntime,
  })

  return {
    title: "AI-PET-WORLD 世界舞台",
    tickLabel: `Tick ${input.tick}`,
    environment,
    pet,
    butler,
    home,
    incubator,
    visibleStorySummary: buildVisibleStorySummary({
      pet,
      butler,
      home,
      incubator,
    }),
    tags: [
      "world_stage_view_model",
      ...environment.tags,
      ...pet.tags.slice(0, 3),
      ...butler.tags.slice(0, 3),
      ...home.tags.slice(0, 3),
    ],
  }
}
