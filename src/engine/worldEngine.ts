/**
 * 当前文件负责：驱动世界 Tick 循环，并统一调度时间、世界运行流程与 UI 状态同步。
 */

import { TimeSystem, TimeState } from "./timeSystem"
import type { ButlerState } from "../types/butler"
import type { WorldStimulus } from "../ai/gateway"
import type { PetState } from "../types/pet"
import type { HomeState } from "../types/home"
import type { IncubatorState } from "../types/incubator"
import type { WorldEvent } from "../types/event"
import type { WorldEcologyState } from "../world/ecology/ecology-engine"
import type { WorldRuntimeState } from "../world/runtime/world-runtime"
import {
  PetSystem,
  ButlerSystem,
  EventSystem,
  HomeSystem,
  IncubatorSystem,
} from "../systems/systems-gateway"
import {
  createWorldRuntime,
  refreshWorldSystemState,
  runWorldTick,
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

    this.timeSystem.update()
    const currentTime = this.timeSystem.getTime()

    const tickResult = runWorldTick({
      tick: this.tick,
      prevTime,
      currentTime,
      petSystem: this.petSystem,
      butlerSystem: this.butlerSystem,
      eventSystem: this.eventSystem,
      homeSystem: this.homeSystem,
      incubatorSystem: this.incubatorSystem,
      worldStimuli: this.worldStimuli,
      worldRuntime: this.worldRuntime,
    })

    this.worldStimuli = tickResult.worldStimuli
    this.worldRuntime = tickResult.worldRuntime

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

    const currentState = this.refreshCurrentState()

    this.onUpdate(
      buildWorldState({
        tick: this.tick,
        formattedTime: this.timeSystem.getFormattedTime(),
        timeState: this.timeSystem.getTime(),

        pet: currentState.pet,
        butler: currentState.butler,

        home: currentState.home,
        incubator: currentState.incubator,

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