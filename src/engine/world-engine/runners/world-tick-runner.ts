/**
 * 当前文件负责：封装世界引擎单次 Tick 的完整运行流程。
 */

import type { TimeState } from "../../timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

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

export type RunWorldTickInput = {
  tick: number
  prevTime: TimeState
  currentTime: TimeState
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  eventSystem: EventSystem
  homeSystem: HomeSystem
  incubatorSystem: IncubatorSystem
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

  /**
   * 阶段 7：宠物自主行为运行。
   * 宠物根据自身状态、记忆、世界区域等信息更新行为。
   */
  const petRuntimeResult = runPetRuntime({
    time: input.currentTime,
    petSystem: input.petSystem,
    zones: nextRuntime.ecology.zones,
  })

  currentPet = petRuntimeResult.pet

  /**
   * 阶段 7.5：生命运行动态包更新。
   * 这里只把当前世界时间下的生命运行上下文写入 PetState。
   * 不改变宠物行为，不影响 drive / goal / behavior。
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