/**
 * 当前文件负责：驱动世界 Tick 循环，并统一调度时间、世界运行流程、存档快照与 UI 状态同步。
 */

import { TimeSystem, TimeState } from "./timeSystem"
import type { ButlerState } from "../types/butler"
import type {
  ButlerProfile,
  WorldStimulus,
} from "../ai/gateway"
import type { PetState } from "../types/pet"
import type { HomeState } from "../types/home"
import type { IncubatorState } from "../types/incubator"
import type { WorldEvent } from "../types/event"
import type { WorldEcologyState } from "../world/ecology/ecology-engine"
import type { WorldRuntimeState } from "../world/runtime/world-runtime"
import {
  buildAdoptionStateFromIncubator,
  type AdoptionState,
} from "../world/adoption/adoption-center-gateway"

import {
  exportAiDataSnapshot,
  restoreAiDataSnapshot,
} from "../ai/data-core/ai-data-gateway"

import {
  WORLD_SAVE_VERSION,
  type WorldSaveSnapshot,
  type WorldSaveSource,
} from "../world/persistence/world-save-gateway"

import type {
  OfflineCatchupResult,
} from "../world/offline/offline-catchup-gateway"

import { WorldProgressionSystem } from "../world/progression/world-progression-gateway"

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

import { logWorldTick } from "./world-engine/world-runtime-logger"

export type { WorldState } from "./world-engine/world-engine-state"

export class WorldEngine {
  private tick = 0

  private timeSystem: TimeSystem
  private petSystem: PetSystem
  private butlerSystem: ButlerSystem
  private eventSystem: EventSystem
  private homeSystem: HomeSystem
  private incubatorSystem: IncubatorSystem
  private worldProgressionSystem: WorldProgressionSystem

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
    this.worldProgressionSystem = new WorldProgressionSystem()

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
      worldProgressionSystem: this.worldProgressionSystem,
      worldStimuli: this.worldStimuli,
      worldRuntime: this.worldRuntime,
    })

    this.worldStimuli = tickResult.worldStimuli
    this.worldRuntime = tickResult.worldRuntime

    logWorldTick({
      tick: this.tick,
      formattedTime: this.timeSystem.getFormattedTime(),
    })

    this.emitUpdate()
  }

  createSaveSnapshot(source: WorldSaveSource): WorldSaveSnapshot {
    const now = Date.now()

    return {
      version: WORLD_SAVE_VERSION,
      saveVersion: WORLD_SAVE_VERSION,
      savedAt: now,
      lastPlayedAt: now,
      tick: this.tick,
      time: this.timeSystem.getTime(),
      pet: this.petSystem.getPet(),
      butler: this.butlerSystem.getState(),
      home: this.homeSystem.getHome(),
      incubator: this.incubatorSystem.getIncubator(),
      worldRuntime: this.worldRuntime,
      ecology: this.worldRuntime.ecology,
      tags: [source],

      engine: {
        tick: this.tick,
        time: this.timeSystem.getTime(),
      },

      systems: {
        pet: this.petSystem.getPet(),
        butler: this.butlerSystem.getState(),
        home: this.homeSystem.getHome(),
        incubator: this.incubatorSystem.getIncubator(),
        events: this.eventSystem.getEvents(),
      },

      world: {
        stimuli: this.worldStimuli,
        runtime: this.worldRuntime,
        progression: this.worldProgressionSystem.getState(),
      },

      aiData: {
        records: exportAiDataSnapshot(),
      },

      meta: {
        source,
        appVersion: "desktop-mvp-v1",
      },
    }
  }

  restoreFromSnapshot(snapshot: WorldSaveSnapshot): void {
    this.stop()

    this.tick = Math.max(0, Math.floor(snapshot.engine.tick))
    this.timeSystem.restore(snapshot.engine.time)

    this.petSystem.restore(snapshot.systems.pet, this.tick)
    this.butlerSystem.restore(snapshot.systems.butler)
    this.homeSystem.restore(snapshot.systems.home)
    this.incubatorSystem.restore(snapshot.systems.incubator)
    this.eventSystem.restore(snapshot.systems.events)
    this.worldProgressionSystem.restore(snapshot.world.progression)

    this.worldStimuli = [...snapshot.world.stimuli]
    this.worldRuntime = snapshot.world.runtime

    restoreAiDataSnapshot(snapshot.aiData.records)

    this.initialized = true
    this.emitUpdate()
  }

addOfflineCatchupReport(result: OfflineCatchupResult): void {
    if (!result.plan.shouldCatchup || result.appliedTickCount <= 0) {
      return
    }

    const currentTime = this.timeSystem.getTime()
    const pet = this.petSystem.getPet()

    const petStateText = pet
      ? `宠物目前保持${pet.action}，能量 ${pet.energy}，饥饿 ${pet.hunger}，情绪 ${pet.mood}。`
      : "领养宠物的抵达准备仍是当前世界的主要照看对象。"

    this.eventSystem.addInteractionEvent({
      tick: this.tick,
      day: currentTime.day,
      hour: currentTime.hour,
      petName: pet?.name,
      message: `你离开期间，我继续照看了这个世界。世界补记了 ${result.appliedTickCount} 个 Tick，当前时间来到 Day ${currentTime.day} - ${String(currentTime.hour).padStart(2, "0")}:00。${petStateText}`,
      sourceAction: "offline_catchup",
      narrativeType: "observe_environment",
      intensity: 0.75,
      payload: {
        source: "offline_catchup",
        offlineMinutes: result.plan.offlineMinutes,
        appliedTickCount: result.appliedTickCount,
        startedAtTick: result.startedAtTick,
        endedAtTick: result.endedAtTick,
        reportSender: "butler",
      },
    })

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
        worldProgression: this.worldProgressionSystem.getState(),
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

  setButlerProfile(profile: ButlerProfile | null): void {
    this.butlerSystem.setProfile(profile)
    this.emitUpdate()
  }

  getButlerProfile(): ButlerProfile | null {
    return this.butlerSystem.getProfile()
  }

  getHome(): HomeState {
    return this.homeSystem.getHome()
  }

  getIncubator(): IncubatorState {
    return this.incubatorSystem.getIncubator()
  }

  getAdoptionState(): AdoptionState {
    const time = this.timeSystem.getTime()

    return buildAdoptionStateFromIncubator(
      this.incubatorSystem.getIncubator(),
      {
        tick: this.tick,
        day: time.day,
        hour: time.hour,
      }
    )
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

  getWorldProgression() {
    return this.worldProgressionSystem.getState()
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
    this.worldProgressionSystem = new WorldProgressionSystem()
    this.worldStimuli = []
    this.worldRuntime = this.createInitialRuntime()
    this.initialized = false
  }
}

export const worldEngine = new WorldEngine()
