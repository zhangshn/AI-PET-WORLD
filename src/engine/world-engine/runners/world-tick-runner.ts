/**
 * 当前文件负责：封装世界引擎单次 Tick 的完整运行流程。
 */

import type { TimeState } from "../../timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { ButlerState } from "@/types/butler"
import type { PetState } from "@/types/pet"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { WorldProgressionSystem } from "@/world/progression/world-progression-gateway"
import type { PetSystem } from "@/systems/petSystem"

import type {
  ButlerSystem,
  EventSystem,
  HomeSystem,
} from "@/systems/systems-gateway"

import { runWorldStimulus } from "./world-stimulus-runner"
import { runPetCognition } from "./pet-cognition-runner"
import { runPetRuntime } from "./pet-runtime-runner"
import { runButlerOpportunities } from "./butler-opportunity-runner"
import { runManagementInteractions } from "./management-interaction-runner"
import { refreshWorldSystemState } from "./world-state-sync-runner"
import { stepWorldRuntime } from "./world-runtime-step-runner"
import { runWorldEventUpdate } from "./world-event-update-runner"

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
  if (butler.task === "offering_approach") return "supportive_response"
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
  const previousState = refreshTickState(input)

  const prevPet = cloneSnapshot(previousState.pet)
  const prevButler = cloneSnapshot(previousState.butler)

  let currentState = refreshTickState(input)

  let currentHome = currentState.home
  let currentPet = currentState.pet
  let currentButler = currentState.butler

  const nextRuntime = stepWorldRuntime({
    previous: input.worldRuntime,
    tick: input.tick,
    time: input.currentTime,
    home: currentHome,
    pet: currentPet,
  })

  const stimulusState = runWorldStimulus({
    tick: input.tick,
    time: input.currentTime,
    worldRuntime: nextRuntime,
    existingStimuli: input.worldStimuli,
  })

  const nextStimuli = stimulusState.activeStimuli

  input.butlerSystem.update({
    tick: input.tick,
    pet: currentPet,
    home: currentHome,
    homeGoals: currentHome?.homeGoals,
    time: input.currentTime,
    butlerBehaviorBias: currentButler.profile?.behaviorBias ?? null,
  })

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet
  currentButler = currentState.butler

  logButlerAgentTrace({
    tick: input.tick,
    butler: currentButler,
    pet: currentPet,
    home: currentHome,
    time: input.currentTime,
  })

  runManagementInteractions({
    tick: input.tick,
    time: input.currentTime,
    butler: currentButler,
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    eventSystem: input.eventSystem,
  })

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet
  currentButler = currentState.butler

  emitWorldProgressionNotices({
    tick: input.tick,
    time: input.currentTime,
    currentHome,
    currentPet,
    eventSystem: input.eventSystem,
    worldProgressionSystem: input.worldProgressionSystem,
  })

  runPetCognition({
    tick: input.tick,
    time: input.currentTime,
    petSystem: input.petSystem,
    eventSystem: input.eventSystem,
    latestStimuli: stimulusState.latestGenerated,
  })

  currentState = refreshTickState(input)
  currentHome = currentState.home
  currentPet = currentState.pet

  const lifeRuntimeBundle = runLifeRuntimeLog({
    tick: input.tick,
    time: input.currentTime,
    pet: currentPet,
  })

  if (lifeRuntimeBundle) {
    input.petSystem.updateLifeRuntimeBundle(lifeRuntimeBundle)
  }

  const petRuntimeResult = runPetRuntime({
    time: input.currentTime,
    petSystem: input.petSystem,
    zones: nextRuntime.ecology.zones,
    home: currentHome,
  })

  currentPet = petRuntimeResult.pet

  emitDualAgentInteractionEvent({
    tick: input.tick,
    time: input.currentTime,
    prevPet,
    currentPet,
    currentButler,
    butlerSystem: input.butlerSystem,
    eventSystem: input.eventSystem,
  })

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
  currentButler = currentState.butler

  runWorldEventUpdate({
    tick: input.tick,
    prevTime: input.prevTime,
    currentTime: input.currentTime,
    prevPet,
    currentPet,
    prevButler,
    currentButler,
    eventSystem: input.eventSystem,
  })

  return {
    worldStimuli: nextStimuli,
    worldRuntime: nextRuntime,
  }
}
