/**
 * 当前文件负责：封装世界引擎单次 Tick 的完整运行流程。
 */

import type { TimeState } from "../../timeSystem"
import type { PetSystem } from "@/systems/petSystem"
import type { ButlerSystem } from "@/systems/butlerSystem"
import type { EventSystem } from "@/systems/eventSystem"
import type { HomeSystem } from "@/systems/homeSystem"
import type { IncubatorSystem } from "@/systems/incubatorSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

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

export function runWorldTick(input: RunWorldTickInput): RunWorldTickResult {
  const previousState = refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })

  const prevPet = previousState.pet
  const prevButler = previousState.butler
  const prevIncubator = previousState.incubator

  let currentState = refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })

  let currentHome = currentState.home
  let currentPet = currentState.pet
  let currentIncubator = currentState.incubator
  let currentButler = currentState.butler

  let nextRuntime = stepWorldRuntime({
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

  input.incubatorSystem.update()

  currentState = refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })

  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  input.butlerSystem.update({
    tick: input.tick,
    pet: currentPet,
    incubator: currentIncubator,
    home: currentHome,
    time: input.currentTime,
    butlerPersonalityProfile: currentPet?.finalPersonalityProfile ?? null,
  })

  currentState = refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })

  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

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

  currentState = refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })

  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  runPetCognition({
    tick: input.tick,
    time: input.currentTime,
    petSystem: input.petSystem,
    eventSystem: input.eventSystem,
    latestStimuli: stimulusState.latestGenerated,
  })

  const petRuntimeResult = runPetRuntime({
    time: input.currentTime,
    petSystem: input.petSystem,
    zones: nextRuntime.ecology.zones,
  })

  currentPet = petRuntimeResult.pet

  runButlerOpportunities({
    tick: input.tick,
    time: input.currentTime,
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    eventSystem: input.eventSystem,
  })

  currentState = refreshWorldSystemState({
    petSystem: input.petSystem,
    butlerSystem: input.butlerSystem,
    homeSystem: input.homeSystem,
    incubatorSystem: input.incubatorSystem,
  })

  currentHome = currentState.home
  currentPet = currentState.pet
  currentIncubator = currentState.incubator
  currentButler = currentState.butler

  nextRuntime = stepWorldRuntime({
    previous: nextRuntime,
    tick: input.tick,
    time: input.currentTime,
    home: currentHome,
    pet: currentPet,
    shouldLog: false,
  })

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