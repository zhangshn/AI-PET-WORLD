/**
 * 当前文件负责：封装世界引擎单次 Tick 的完整运行流程。
 */

import type { TimeState } from "../../timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { ButlerState } from "@/types/butler"
import type { PetState } from "@/types/pet"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { WorldProgressionSystem } from "@/world/progression/world-progression-gateway"

import type {
  PetSystem,
  ButlerSystem,
  EventSystem,
  HomeSystem,
  IncubatorSystem,
} from "@/systems/systems-gateway"

import {
  runWorldStimulus,
  runPetCognition,
  runPetRuntime,
  runButlerOpportunities,
  runManagementInteractions,
  refreshWorldSystemState,
  stepWorldRuntime,
  runWorldEventUpdate,
} from "../world-engine-gateway"

import {
  runLifeRuntimeLog,
} from "./life-runtime-log-runner"

import {
  logButlerAgentTrace,
} from "../world-runtime-logger"

export type RunWorldTickInput = {
  tick: number
  prevTime: TimeState
  currentTime: TimeState
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  eventSystem: EventSystem
  homeSystem: HomeSystem
  incubatorSystem: IncubatorSystem
  worldProgressionSystem: WorldProgressionSystem
  worldStimuli: WorldStimulus[]
  worldRuntime: WorldRuntimeState
}

export type RunWorldTickResult = {
  worldStimuli: WorldStimulus[]
  worldRuntime: WorldRuntimeState
}

function cloneSnapshot<T>(value: T): T {
  if (value == null) return value

  const clone = globalThis.structuredClone as
    | (<V>(input: V) => V)
    | undefined

  if (clone) {
    return clone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function refreshTickState(input: RunWorldTickInput) {
  return refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })
}

function emitWorldProgressionNotices(input: {
  tick: number
  time: TimeState
  currentHome: ReturnType<HomeSystem["getHome"]>
  currentPet: ReturnType<PetSystem["getPet"]>
  eventSystem: EventSystem
  worldProgressionSystem: WorldProgressionSystem
}): void {
  const notices = input.worldProgressionSystem.update({
    tick: input.tick,
    time: input.time,
    home: input.currentHome,
    pet: input.currentPet,
  })

  notices.forEach((notice) => {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message: notice.message,
      sourceAction: "world_progression",
      narrativeType: "unknown",
      intensity: 0.78,
      payload: {
        source: "world_progression",
        noticeId: notice.id,
        facilityId: notice.facilityId,
        noticeType: notice.type,
      },
    })
  })
}

function isExcursionGoal(pet: PetState): boolean {
  return (
    pet.currentGoal?.type === "expand_territory" ||
    pet.currentGoal?.type === "observe_boundary"
  )
}

function isExcursionAction(pet: PetState): boolean {
  return (
    pet.action === "exploring" ||
    pet.action === "walking" ||
    pet.action === "observing" ||
    pet.action === "alert_idle"
  )
}

function shouldEmitDualAgentInteractionEvent(input: {
  tick: number
  prevPet: PetState | null
  currentPet: PetState | null
}): boolean {
  const pet = input.currentPet
  if (!pet) return false
  if (!isExcursionGoal(pet)) return false
  if (!isExcursionAction(pet)) return false

  const prevGoalType = input.prevPet?.currentGoal?.type
  const currentGoalType = pet.currentGoal?.type
  const prevAction = input.prevPet?.action

  return (
    prevGoalType !== currentGoalType ||
    prevAction !== pet.action ||
    input.tick % 8 === 0
  )
}

function resolveButlerBoundaryResponse(butler: ButlerState | null): string {
  if (!butler) return "not_observed"

  if (butler.task === "offering_rest") return "boundary_waiting"
  if (butler.task === "offering_approach") return "companion_response"
  if (butler.task === "watching_pet") return "boundary_waiting"

  return "observing"
}

function buildDualAgentInteractionMessage(input: {
  pet: PetState
  butler: ButlerState | null
}): string {
  const petName = input.pet.name
  const butlerName = input.butler?.name ?? "管家"

  if (input.pet.currentGoal?.type === "expand_territory") {
    return `${petName}沿着庭院外侧继续探索。${butlerName}注意到了这次外扩行为，但没有直接打断它。`
  }

  return `${petName}停在边界附近观察环境。${butlerName}保持距离记录了这次边界观察。`
}

function emitDualAgentInteractionEvent(input: {
  tick: number
  time: TimeState
  prevPet: PetState | null
  currentPet: PetState | null
  currentButler: ButlerState | null
  butlerSystem: ButlerSystem
  eventSystem: EventSystem
}): void {
  if (!shouldEmitDualAgentInteractionEvent({
    tick: input.tick,
    prevPet: input.prevPet,
    currentPet: input.currentPet,
  })) {
    return
  }

  const pet = input.currentPet
  if (!pet) return

  const goalType = pet.currentGoal?.type ?? "unknown"
  const butlerResponse = resolveButlerBoundaryResponse(input.currentButler)
  const reason = pet.currentGoal?.summary ?? "宠物当前目标进入边界表达场景。"
  const target = pet.currentGoal?.targetWorldPosition

  input.butlerSystem.recordBoundaryInteraction({
    tick: input.tick,
    petName: pet.name,
    petGoalType: goalType,
    petAction: pet.action,
    butlerResponse,
    reason,
  })

  input.eventSystem.addInteractionEvent({
    tick: input.tick,
    day: input.time.day,
    hour: input.time.hour,
    petName: pet.name,
    message: buildDualAgentInteractionMessage({
      pet,
      butler: input.currentButler,
    }),
    sourceAction: pet.action,
    narrativeType:
      goalType === "observe_boundary" ? "observe_environment" : "discover",
    intensity: goalType === "expand_territory" ? 0.72 : 0.58,
    payload: {
      source: "dual_agent_interaction",
      interactionKind:
        goalType === "expand_territory"
          ? "pet_short_excursion"
          : "pet_boundary_observation",
      petGoalType: goalType,
      petAction: pet.action,
      butlerName: input.currentButler?.name ?? "管家",
      butlerTask: input.currentButler?.task ?? "unknown",
      butlerResponse,
      reason,
      targetX: target?.x ?? null,
      targetY: target?.y ?? null,
    },
  })
}

export function runWorldTick(input: RunWorldTickInput): RunWorldTickResult {
  /**
   * 阶段 0：保存 Tick 前快照。
   * 这些快照只用于最后的事件差异判断，不参与中途修改。
   */
  const previousState = refreshTickState(input)

  const prevPet = cloneSnapshot(previousState.pet)
  const prevButler = cloneSnapshot(previousState.butler)
  const prevIncubator = cloneSnapshot(previousState.incubator)

  /**
   * 阶段 1：读取当前世界状态，推进世界 runtime。
   * runtime 代表天气、生态、地图区域等世界底层状态。
   */
  let currentState = refreshTickState(input)

  let currentHome = currentState.home
  let currentPet = currentState.pet
  let currentIncubator = currentState.incubator
  let currentButler = currentState.butler

  const nextRuntime = stepWorldRuntime({
    previous: input.worldRuntime,
    tick: input.tick,
    time: input.currentTime,
    home: currentHome,
    pet: currentPet,
  })

  /**
   * 阶段 2：基于世界 runtime 生成本轮刺激。
   * 刺激先生成，后续宠物认知会读取本轮最新刺激。
   */
  const stimulusState = runWorldStimulus({
    tick: input.tick,
    time: input.currentTime,
    worldRuntime: nextRuntime,
    existingStimuli: input.worldStimuli,
  })

  const nextStimuli = stimulusState.activeStimuli

  /**
   * 阶段 3：推进孵化器自然状态。
   * 这里只做自然推进；真正的照看、出生由管理交互阶段处理。
   */
  input.incubatorSystem.update()

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  /**
   * 阶段 4：管家根据最新状态判断本轮任务。
   * 管家只选择任务和创造机会，不直接控制宠物行为。
   */
  input.butlerSystem.update({
    tick: input.tick,
    pet: currentPet,
    incubator: currentIncubator,
    home: currentHome,
    time: input.currentTime,
    butlerBehaviorBias: currentPet?.lifeProfile.genderAwareBehaviorBias ?? null,
  })

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  /**
   * 阶段 4.5：管家 AgentCycleTrace 审计日志。
   * 这里只把管家当前任务映射为 autonomous agent cycle，
   * 不改变任务、不执行行为、不控制宠物。
   */
  logButlerAgentTrace({
    tick: input.tick,
    butler: currentButler,
    pet: currentPet,
    incubator: currentIncubator,
    home: currentHome,
    time: input.currentTime,
  })

  /**
   * 阶段 5：执行管家管理交互。
   * 包括照看孵化器、宠物出生、家园建设。
   */
  runManagementInteractions({
    tick: input.tick,
    time: input.currentTime,
    butler: currentButler,
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    incubatorSystem: input.incubatorSystem,
    homeSystem: input.homeSystem,
    eventSystem: input.eventSystem,
  })

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  /**
   * 阶段 5.5：推进 MVP 世界进度。
   * 这里只推进世界设施建设与世界公告，不改变宠物自主行为。
   */
  emitWorldProgressionNotices({
    tick: input.tick,
    time: input.currentTime,
    currentHome,
    currentPet,
    eventSystem: input.eventSystem,
    worldProgressionSystem: input.worldProgressionSystem,
  })

  /**
   * 阶段 6：宠物感知世界刺激。
   * 这里会写入认知类 interaction 事件，但不会直接替宠物决定行为。
   */
  runPetCognition({
    tick: input.tick,
    time: input.currentTime,
    petSystem: input.petSystem,
    eventSystem: input.eventSystem,
    latestStimuli: stimulusState.latestGenerated,
  })

  currentState = refreshTickState(input)
  currentPet = currentState.pet

  /**
   * 阶段 6.5：生命运行动态包更新。
   * 必须在宠物自主行为运行前写入 PetState。
   * 这样 pet-drive 读取到的是当前世界时间下的动态生命趋向。
   *
   * 注意：
   * 这里只更新生命运行上下文，不直接改变宠物行为。
   */
  const lifeRuntimeBundle = runLifeRuntimeLog({
    tick: input.tick,
    time: input.currentTime,
    pet: currentPet,
  })

  if (lifeRuntimeBundle) {
    input.petSystem.updateLifeRuntimeBundle(lifeRuntimeBundle)
  }

  /**
   * 阶段 7：宠物自主行为运行。
   * 宠物根据自身状态、记忆、世界区域、当前生命运行趋向等信息更新行为。
   */
  const petRuntimeResult = runPetRuntime({
    time: input.currentTime,
    petSystem: input.petSystem,
    zones: nextRuntime.ecology.zones,
  })

  currentPet = petRuntimeResult.pet

  /**
   * 阶段 7.5：双主角边界互动表达。
   * 这里只记录宠物自主目标与管家当前回应，不替宠物或管家改决定。
   */
  emitDualAgentInteractionEvent({
    tick: input.tick,
    time: input.currentTime,
    prevPet,
    currentPet,
    currentButler,
    butlerSystem: input.butlerSystem,
    eventSystem: input.eventSystem,
  })

  /**
   * 阶段 8：处理管家提供的机会。
   * 宠物自主判断是否接受食物、恢复、接近机会。
   * 接受机会只影响状态 / 记忆倾向，不强制改当前行为。
   */
  runButlerOpportunities({
    tick: input.tick,
    time: input.currentTime,
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    eventSystem: input.eventSystem,
  })

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  /**
   * 阶段 9：统一生成世界事件变化。
   * 这里根据 Tick 前后的状态差异生成时间、孵化器、宠物行为等事件。
   */
  runWorldEventUpdate({
    tick: input.tick,
    prevTime: input.prevTime,
    currentTime: input.currentTime,
    prevPet,
    currentPet,
    prevButler,
    currentButler,
    prevIncubator,
    currentIncubator,
    eventSystem: input.eventSystem,
  })

  return {
    worldStimuli: nextStimuli,
    worldRuntime: nextRuntime,
  }
}
