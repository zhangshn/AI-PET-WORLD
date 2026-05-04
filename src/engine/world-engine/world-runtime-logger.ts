/**
 * 当前文件负责：统一控制世界运行时日志输出。
 */

import type {
  LifePersonalityProfileBundle,
  WorldStimulus,
} from "@/ai/gateway"
import type { TimeState } from "@/engine/timeSystem"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

const ENABLE_WORLD_TICK_LOG = true
const ENABLE_ECOLOGY_LOG = false
const ENABLE_STIMULUS_LOG = false
const ENABLE_INCUBATOR_LOG = true
const ENABLE_PET_RUNTIME_LOG = true
const ENABLE_PET_COGNITION_LOG = true
const ENABLE_PET_DECISION_LOG = true
const ENABLE_BIRTH_PROFILE_LOG = true

export function logWorldTick(input: {
  tick: number
  formattedTime: string
}) {
  if (!ENABLE_WORLD_TICK_LOG) return

  console.log("世界 Tick：", input.tick)
  console.log("当前时间：", input.formattedTime)
}

export function logWorldEcology(runtime: WorldRuntimeState) {
  if (!ENABLE_ECOLOGY_LOG) return

  console.log("🌱 世界生态：", {
    weather: runtime.ecology.environment.activeWeather,
    mood: runtime.ecology.environment.environmentMood,
    temperature: runtime.ecology.environment.temperature,
    humidity: runtime.ecology.environment.humidity,
    windLevel: runtime.ecology.environment.windLevel,
    lightLevel: runtime.ecology.environment.lightLevel,
  })
}

export function logGeneratedWorldStimuli(stimuli: WorldStimulus[]) {
  if (!ENABLE_STIMULUS_LOG) return
  if (stimuli.length === 0) return

  for (const item of stimuli) {
    if (item.source?.kind === "world_entity") {
      console.log("🌍 世界刺激：", item.type, item.summary, {
        source: item.source.name ?? item.source.id,
        sourceType: item.source.type,
      })
      continue
    }

    console.log("🌍 世界刺激：", item.type, item.summary)
  }
}

export function logIncubatorState(incubator: IncubatorState) {
  if (!ENABLE_INCUBATOR_LOG) return

  console.log(
    `孵化器状态：进度=${incubator.progress} 稳定度=${incubator.stability} 状态=${incubator.status}`
  )
}

export function logPetRuntimeInactive() {
  if (!ENABLE_PET_RUNTIME_LOG) return

  console.log("世界引擎：当前宠物尚未出生，宠物行为系统未激活。")
}

export function logPetRuntimeState(pet: PetState) {
  if (!ENABLE_PET_RUNTIME_LOG) return

  console.log("🐾 宠物行为：", pet.action)
  console.log(
    "📊 状态：",
    "能量",
    pet.timelineSnapshot?.state.physical.energy ?? pet.energy,
    "饥饿",
    pet.timelineSnapshot?.state.physical.hunger ?? pet.hunger,
    "情绪",
    pet.timelineSnapshot?.state.emotional.label ?? pet.mood,
    "生命阶段",
    pet.lifeState.phase
  )
}

export function logPetCognition(summary: string) {
  if (!ENABLE_PET_COGNITION_LOG) return

  console.log("🧠 宠物认知：", summary)
}

export function logPetDecisionTrace(input: {
  tick: number
  petName: string
  previousAction: string
  rawAction: string
  finalAction: string
  actionSelectionReason: string
  stabilityReason: string
  driveDominant: string
  driveDominantScore: number
  driveValues: Record<string, number>
  goalType: string
  goalPriority: string
  goalSource: string
  goalSummary: string
  energy: number
  hunger: number
  mood: string
  lifePhase: string
}) {
  if (!ENABLE_PET_DECISION_LOG) return

  console.log("🧭 宠物行为决策：", {
    tick: input.tick,
    petName: input.petName,
    action: {
      previous: input.previousAction,
      raw: input.rawAction,
      final: input.finalAction,
      selectionReason: input.actionSelectionReason,
      stabilityReason: input.stabilityReason,
    },
    drive: {
      dominant: input.driveDominant,
      dominantScore: input.driveDominantScore,
      values: input.driveValues,
    },
    goal: {
      type: input.goalType,
      priority: input.goalPriority,
      source: input.goalSource,
      summary: input.goalSummary,
    },
    state: {
      energy: input.energy,
      hunger: input.hunger,
      mood: input.mood,
      lifePhase: input.lifePhase,
    },
  })
}

export function logPetBirthProfile(input: {
  petName: string
  birthInput: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
  }
  gender: unknown
  lifeProfile: LifePersonalityProfileBundle
  createdPet: PetState | null
  time: TimeState
}) {
  if (!ENABLE_BIRTH_PROFILE_LOG) return

  console.log("世界引擎：宠物已通过 LifeProfile 核心完成出生数据构建并绑定。", {
    petName: input.petName,
    birthInput: input.birthInput,
    gender: input.gender,
    mode: input.lifeProfile.mode,
    genderPerspective: input.lifeProfile.genderPerspective,
    publicPersonality: input.lifeProfile.publicPersonalityView,
    bazi: input.lifeProfile.baziProfile,
    interpretation: input.lifeProfile.personalityInterpretationProfile.summary,
    behaviorBias: input.lifeProfile.genderAwareBehaviorBias,
    summaries: input.lifeProfile.ziweiProfile?.summaries ?? [],
    traits: input.lifeProfile.ziweiProfile?.traits ?? null,
    consciousness: input.lifeProfile.consciousnessProfile,
    timelinePhase: input.createdPet?.timelineSnapshot?.fortune.phaseTag,
    timelineBranch: input.createdPet?.timelineSnapshot?.trajectory.branchTag,
    timelineEmotion: input.createdPet?.timelineSnapshot?.state.emotional.label,
    timelineDrive: input.createdPet?.timelineSnapshot?.state.drive.primary,
    lifeState: input.createdPet?.lifeState,
    worldTime: {
      day: input.time.day,
      hour: input.time.hour,
      period: input.time.period,
    },
  })
}