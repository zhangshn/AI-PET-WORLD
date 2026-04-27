/**
 * 当前文件负责：驱动世界 Tick 循环，并统一调度时间、孵化器、管家、宠物、事件与 UI 状态同步。
 */

import { TimeSystem, TimeState } from "./timeSystem"
import { PetSystem } from "../systems/petSystem"
import { ButlerSystem } from "../systems/butlerSystem"
import type { ButlerState } from "../types/butler"
import { EventSystem } from "../systems/eventSystem"
import { HomeSystem } from "../systems/homeSystem"
import { IncubatorSystem } from "../systems/incubatorSystem"

import type { WorldStimulus } from "../ai/gateway"

import type { PetState } from "../types/pet"
import type { HomeState } from "../types/home"
import type { IncubatorState } from "../types/incubator"
import type { WorldEvent } from "../types/event"
import type { WorldEcologyState } from "../world/ecology/ecology-engine"
import type { WorldRuntimeState } from "../world/runtime/world-runtime"
import {
  runWorldStimulus,
  runPetCognition,
  runPetRuntime,
  runButlerOpportunities,
  runManagementInteractions,
  refreshWorldSystemState,
  createWorldRuntime,
  stepWorldRuntime,
} from "./world-engine/world-engine-gateway"
import {
  buildWorldState,
  type WorldState,
} from "./world-engine/world-engine-state"

export type { WorldState } from "./world-engine/world-engine-state"

export class WorldEngine {
  private tick = 0

  private timeSystem: TimeSystem
  private petSystem: PetSystem
  private butlerSystem: ButlerSystem
  private eventSystem: EventSystem
  private homeSystem: HomeSystem
  private incubatorSystem: IncubatorSystem

  private worldStimuli: WorldStimulus[] = []
  private worldRuntime: WorldRuntimeState

  private initialized = false
  private timer: ReturnType<typeof setInterval> | null = null

  onUpdate?: (state: WorldState) => void

  constructor() {
    this.timeSystem = new TimeSystem()
    this.petSystem = new PetSystem()
    this.butlerSystem = new ButlerSystem()
    this.eventSystem = new EventSystem()
    this.homeSystem = new HomeSystem()
    this.incubatorSystem = new IncubatorSystem()

    this.worldRuntime = this.createInitialRuntime()
  }

  initialize() {
    if (this.initialized) return

    this.initialized = true
    this.emitUpdate()
  }

  start(intervalMs = 2000) {
    this.initialize()

    if (this.timer) return

    this.timer = setInterval(() => {
      this.update()
    }, intervalMs)
  }

  stop() {
    if (!this.timer) return

    clearInterval(this.timer)
    this.timer = null
  }

  update() {
    if (!this.initialized) {
      this.initialize()
    }

    this.tick += 1

    const prevTime = this.timeSystem.getTime()

    const previousState = this.refreshCurrentState()
    const prevPet = previousState.pet
    const prevButler = previousState.butler
    const prevIncubator = previousState.incubator

    this.timeSystem.update()
    const currentTime = this.timeSystem.getTime()

    let currentState = this.refreshCurrentState()
    let currentHome = currentState.home
    let currentPet = currentState.pet
    let currentIncubator = currentState.incubator
    let currentButler = currentState.butler

    this.worldRuntime = this.stepRuntime({
      time: currentTime,
      home: currentHome,
      pet: currentPet,
    })

    const stimulusState = runWorldStimulus({
      tick: this.tick,
      time: currentTime,
      worldRuntime: this.worldRuntime,
      existingStimuli: this.worldStimuli,
    })

    this.worldStimuli = stimulusState.activeStimuli

    this.incubatorSystem.update()

    currentState = this.refreshCurrentState()
    currentHome = currentState.home
    currentPet = currentState.pet
    currentIncubator = currentState.incubator
    currentButler = currentState.butler

    this.butlerSystem.update({
      tick: this.tick,
      pet: currentPet,
      incubator: currentIncubator,
      home: currentHome,
      time: currentTime,
      butlerPersonalityProfile: currentPet?.finalPersonalityProfile ?? null,
    })

    currentState = this.refreshCurrentState()
    currentHome = currentState.home
    currentPet = currentState.pet
    currentIncubator = currentState.incubator
    currentButler = currentState.butler

    runManagementInteractions({
      tick: this.tick,
      time: currentTime,
      butler: currentButler,
      petSystem: this.petSystem,
      butlerSystem: this.butlerSystem,
      incubatorSystem: this.incubatorSystem,
      homeSystem: this.homeSystem,
      eventSystem: this.eventSystem,
    })

    currentState = this.refreshCurrentState()
    currentHome = currentState.home
    currentPet = currentState.pet
    currentIncubator = currentState.incubator
    currentButler = currentState.butler

    runPetCognition({
      tick: this.tick,
      time: currentTime,
      petSystem: this.petSystem,
      eventSystem: this.eventSystem,
      latestStimuli: stimulusState.latestGenerated,
    })

    const petRuntimeResult = runPetRuntime({
      time: currentTime,
      petSystem: this.petSystem,
      zones: this.worldRuntime.ecology.zones,
    })

    currentPet = petRuntimeResult.pet

    runButlerOpportunities({
      tick: this.tick,
      time: currentTime,
      petSystem: this.petSystem,
      butlerSystem: this.butlerSystem,
      eventSystem: this.eventSystem,
    })

    currentState = this.refreshCurrentState()
    currentHome = currentState.home
    currentPet = currentState.pet
    currentIncubator = currentState.incubator
    currentButler = currentState.butler

    this.worldRuntime = this.stepRuntime({
      time: currentTime,
      home: currentHome,
      pet: currentPet,
      shouldLog: false,
    })

    this.eventSystem.update({
      tick: this.tick,
      day: currentTime.day,
      hour: currentTime.hour,
      prevPeriod: prevTime.period,
      currentPeriod: currentTime.period,
      prevPet,
      currentPet,
      prevButler,
      currentButler,
      prevIncubator,
      currentIncubator,
    })

    console.log("世界 Tick：", this.tick)
    console.log("当前时间：", this.timeSystem.getFormattedTime())

    this.emitUpdate()
  }

  private createInitialRuntime(): WorldRuntimeState {
    return createWorldRuntime({
      tick: this.tick,
      time: this.timeSystem.getTime(),
      home: this.homeSystem.getHome(),
      petCount: 0,
      shouldLog: false,
    })
  }

  private stepRuntime(input: {
    time: TimeState
    home: HomeState
    pet: PetState | null
    shouldLog?: boolean
  }): WorldRuntimeState {
    return stepWorldRuntime({
      previous: this.worldRuntime,
      tick: this.tick,
      time: input.time,
      home: input.home,
      pet: input.pet,
      shouldLog: input.shouldLog,
    })
  }

  private refreshCurrentState() {
    return refreshWorldSystemState({
      petSystem: this.petSystem,
      butlerSystem: this.butlerSystem,
      homeSystem: this.homeSystem,
      incubatorSystem: this.incubatorSystem,
    })
  }

  private emitUpdate() {
    if (!this.onUpdate) return

    this.onUpdate(
      buildWorldState({
        tick: this.tick,
        formattedTime: this.timeSystem.getFormattedTime(),
        timeState: this.timeSystem.getTime(),

        pet: this.petSystem.getPet(),
        butler: this.butlerSystem.getState(),

        home: this.homeSystem.getHome(),
        incubator: this.incubatorSystem.getIncubator(),

        events: this.eventSystem.getEvents(),

        worldStimuli: this.worldStimuli,
        worldRuntime: this.worldRuntime,
      })
    )
  }

  getTick(): number {
    return this.tick
  }

  getTime(): TimeState {
    return this.timeSystem.getTime()
  }

  getFormattedTime(): string {
    return this.timeSystem.getFormattedTime()
  }

  getPet(): PetState | null {
    return this.petSystem.getPet()
  }

  getButler(): ButlerState {
    return this.butlerSystem.getState()
  }

  getHome(): HomeState {
    return this.homeSystem.getHome()
  }

  getIncubator(): IncubatorState {
    return this.incubatorSystem.getIncubator()
  }

  getEvents(): WorldEvent[] {
    return this.eventSystem.getEvents()
  }

  getWorldStimuli(): WorldStimulus[] {
    return this.worldStimuli
  }

  getEcology(): WorldEcologyState {
    return this.worldRuntime.ecology
  }

  getWorldRuntime(): WorldRuntimeState {
    return this.worldRuntime
  }

  reset() {
    this.stop()
    this.tick = 0
    this.timeSystem = new TimeSystem()
    this.petSystem = new PetSystem()
    this.butlerSystem = new ButlerSystem()
    this.eventSystem = new EventSystem()
    this.homeSystem = new HomeSystem()
    this.incubatorSystem = new IncubatorSystem()
    this.worldStimuli = []
    this.worldRuntime = this.createInitialRuntime()
    this.initialized = false
  }
}

export const worldEngine = new WorldEngine()