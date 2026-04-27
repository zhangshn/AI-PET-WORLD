/**
 * 当前文件负责：驱动世界 Tick 循环，并统一调度时间、世界 runtime、生态、刺激、孵化器、管家、宠物、事件与 UI 状态同步。
 */

import { TimeSystem, TimeState } from "./timeSystem"
import { PetSystem } from "../systems/petSystem"
import { ButlerSystem } from "../systems/butlerSystem"
import type { ButlerState } from "../types/butler"
import { EventSystem } from "../systems/eventSystem"
import { HomeSystem } from "../systems/homeSystem"
import { IncubatorSystem } from "../systems/incubatorSystem"

import {
  buildPetBirthBundle,
  buildWorldStimuli,
  type WorldStimulus,
} from "../ai/gateway"

import type { PetState } from "../types/pet"
import type { HomeState } from "../types/home"
import type { IncubatorState } from "../types/incubator"
import type { WorldEvent } from "../types/event"
import type { WorldEcologyState } from "../world/ecology/ecology-engine"
import {
  runWorldSimulation,
} from "../world/simulation/world-simulation"
import type {
  WorldRuntimeState,
} from "../world/runtime/world-runtime"

export type WorldState = {
  tick: number
  time: string
  timeState: TimeState
  pet: PetState | null
  butler: ButlerState
  home: HomeState
  incubator: IncubatorState
  events: WorldEvent[]
  worldStimuli: WorldStimulus[]
  ecology: WorldEcologyState
  worldRuntime: WorldRuntimeState
}

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

    this.worldRuntime = runWorldSimulation({
      previous: null,
      tick: this.tick,
      time: this.timeSystem.getTime(),
      homeLevel: this.homeSystem.getHome().level,
      petCount: 0,
      hasHospital: false,
      hasShop: false,
      hasPark: false,
    }).runtime
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

    this.tick++

    const prevTime = this.timeSystem.getTime()
    const prevPet = this.petSystem.getPet()
    const prevButler = this.butlerSystem.getState()
    const prevIncubator = this.incubatorSystem.getIncubator()

    this.timeSystem.update()
    const currentTime = this.timeSystem.getTime()

    let currentHome = this.homeSystem.getHome()
    let currentPet = this.petSystem.getPet()
    let currentIncubator = this.incubatorSystem.getIncubator()

    this.worldRuntime = runWorldSimulation({
      previous: this.worldRuntime,
      tick: this.tick,
      time: currentTime,
      homeLevel: currentHome.level,
      petCount: currentPet ? 1 : 0,
      hasHospital: false,
      hasShop: false,
      hasPark: false,
    }).runtime

    console.log("🌱 世界生态：", {
      weather: this.worldRuntime.ecology.environment.activeWeather,
      mood: this.worldRuntime.ecology.environment.environmentMood,
      temperature: this.worldRuntime.ecology.environment.temperature,
      humidity: this.worldRuntime.ecology.environment.humidity,
      windLevel: this.worldRuntime.ecology.environment.windLevel,
      lightLevel: this.worldRuntime.ecology.environment.lightLevel,
    })

    const stimulusState = buildWorldStimuli({
      tick: this.tick,

      time: {
        day: currentTime.day,
        hour: currentTime.hour,
        period: currentTime.period,
      },

      ecology: this.worldRuntime.ecology,

      existingStimuli: this.worldStimuli,
    })

    this.worldStimuli = stimulusState.activeStimuli

    if (stimulusState.latestGenerated.length > 0) {
      for (const item of stimulusState.latestGenerated) {
        console.log("🌍 世界刺激：", item.type, item.summary)
      }
    }

    this.incubatorSystem.update()
    currentIncubator = this.incubatorSystem.getIncubator()
    currentHome = this.homeSystem.getHome()
    currentPet = this.petSystem.getPet()

    this.butlerSystem.update({
      tick: this.tick,
      pet: currentPet,
      incubator: currentIncubator,
      home: currentHome,
      time: currentTime,
      butlerPersonalityProfile: currentPet?.finalPersonalityProfile ?? null,
    })

    let currentButler = this.butlerSystem.getState()

    this.handleManagementInteractions(currentTime, currentButler)

    currentIncubator = this.incubatorSystem.getIncubator()
    currentHome = this.homeSystem.getHome()
    currentPet = this.petSystem.getPet()
    currentButler = this.butlerSystem.getState()

    if (this.petSystem.hasPet() && stimulusState.latestGenerated.length > 0) {
      const cognitionResults = this.petSystem.perceiveWorldStimuli(
        stimulusState.latestGenerated,
        {
          day: currentTime.day,
          hour: currentTime.hour,
          period: currentTime.period,
        }
      )

      for (const result of cognitionResults) {
        console.log("🧠 宠物认知：", result.summary)

        this.eventSystem.addInteractionEvent({
          tick: this.tick,
          day: currentTime.day,
          hour: currentTime.hour,
          message: result.summary,
        })
      }
    }

    if (this.petSystem.hasPet()) {
      this.petSystem.update(currentTime, this.worldRuntime.ecology.zones)
      currentPet = this.petSystem.getPet()

      if (currentPet) {
        console.log("🐾 宠物行为：", currentPet.action)
        console.log(
          "📊 状态：",
          "能量",
          currentPet.timelineSnapshot?.state.physical.energy ?? currentPet.energy,
          "饥饿",
          currentPet.timelineSnapshot?.state.physical.hunger ?? currentPet.hunger,
          "情绪",
          currentPet.timelineSnapshot?.state.emotional.label ?? currentPet.mood,
          "生命阶段",
          currentPet.lifeState.phase
        )
      }
    } else {
      console.log("世界引擎：当前宠物尚未出生，宠物行为系统未激活。")
    }

    this.handleButlerOpportunities(currentTime)

    currentIncubator = this.incubatorSystem.getIncubator()
    currentHome = this.homeSystem.getHome()
    currentPet = this.petSystem.getPet()
    currentButler = this.butlerSystem.getState()

    this.worldRuntime = runWorldSimulation({
      previous: this.worldRuntime,
      tick: this.tick,
      time: currentTime,
      homeLevel: currentHome.level,
      petCount: currentPet ? 1 : 0,
      hasHospital: false,
      hasShop: false,
      hasPark: false,
    }).runtime

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

  private handleManagementInteractions(
    time: TimeState,
    butler: ButlerState
  ) {
    const butlerName = butler.name

    if (butler.task === "watching_incubator" && !this.petSystem.hasPet()) {
      const before = this.incubatorSystem.getIncubator()

      this.incubatorSystem.care(12, 6)

      const after = this.incubatorSystem.getIncubator()

      const progressAdded = after.progress - before.progress
      const stabilityAdded = after.stability - before.stability

      if (progressAdded > 0 || stabilityAdded > 0) {
        this.eventSystem.addInteractionEvent({
          tick: this.tick,
          day: time.day,
          hour: time.hour,
          message: `${butlerName}正在照看孵化器，孵化进度 +${progressAdded}，稳定度 +${stabilityAdded}。`,
        })
      }

      if (this.incubatorSystem.canHatch()) {
        const petName = this.incubatorSystem.hatch()

        if (petName) {
          const now = new Date()

          const birthInput = {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
          }

          const birthBundle = buildPetBirthBundle({
            birthInput,
            time: {
              day: time.day,
              hour: time.hour,
              period: time.period,
            },
          })

          this.petSystem.hatchPetWithAiBundle(petName, birthBundle)

          this.eventSystem.addPetHatchedEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            petName,
          })

          const createdPet = this.petSystem.getPet()

          console.log("世界引擎：宠物已通过 AI 总入口完成出生数据构建并绑定。", {
            petName,
            birthInput,
            publicPersonality: birthBundle.publicPersonalityView,
            bazi: birthBundle.baziProfile,
            finalPersonality: birthBundle.finalPersonalityProfile,
            summaries: birthBundle.personalityProfile.summaries,
            traits: birthBundle.personalityProfile.traits,
            consciousness: birthBundle.consciousnessProfile,
            memory: birthBundle.memoryState,
            timelinePhase: createdPet?.timelineSnapshot?.fortune.phaseTag,
            timelineBranch: createdPet?.timelineSnapshot?.trajectory.branchTag,
            timelineEmotion: createdPet?.timelineSnapshot?.state.emotional.label,
            timelineDrive: createdPet?.timelineSnapshot?.state.drive.primary,
            lifeState: createdPet?.lifeState,
          })
        }
      }
    }

    if (butler.task === "building_home") {
      const homeBefore = this.homeSystem.getHome()

      if (homeBefore.status !== "completed") {
        this.homeSystem.build(
          15,
          this.petSystem.getPet()?.finalPersonalityProfile ??
            butler.finalPersonalityProfile ??
            null
        )

        const homeAfter = this.homeSystem.getHome()
        const progressAdded = Math.round(homeAfter.progress - homeBefore.progress)

        if (progressAdded > 0) {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}推进了家园建造，进度 +${progressAdded}，当前阶段：${homeAfter.constructionStage}。`,
          })
        }

        if (homeAfter.status === "completed") {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: "家园第一阶段建造完成了。",
          })
        }
      }
    }
  }

  private handleButlerOpportunities(time: TimeState) {
    if (!this.petSystem.hasPet()) return

    const pet = this.petSystem.getPet()
    if (!pet) return

    const opportunities = this.butlerSystem.getPendingOpportunities()
    if (opportunities.length === 0) return

    const petName = pet.name
    const butlerName = this.butlerSystem.getState().name

    for (const opportunity of opportunities) {
      if (opportunity.target !== "pet") continue

      if (opportunity.type === "food_offer") {
        const result = this.petSystem.evaluateFoodOffer(opportunity)

        if (result.accepted && result.intakeAmount > 0) {
          this.petSystem.applyAcceptedFoodOffer(result.intakeAmount)

          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}提供了食物，${petName}自主决定进食，实际摄食量为 ${result.intakeAmount}（${result.reason}）。`,
          })
        } else {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}提供了食物，但${petName}这次没有接受（${result.reason}）。`,
          })
        }

        this.butlerSystem.consumeOpportunity(opportunity.id)
        continue
      }

      if (opportunity.type === "rest_offer") {
        const currentPet = this.petSystem.getPet()

        if (
          currentPet &&
          (currentPet.action === "resting" || currentPet.action === "sleeping")
        ) {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}整理了恢复环境，${petName}当前正在自主休息。`,
          })
        } else {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}准备了更适合恢复的环境，但${petName}是否进入休息仍由自己决定。`,
          })
        }

        this.butlerSystem.consumeOpportunity(opportunity.id)
        continue
      }

      if (opportunity.type === "approach_offer") {
        const currentPet = this.petSystem.getPet()

        if (currentPet && currentPet.action === "approaching") {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}发起了接近，${petName}当前表现出接受接近的倾向。`,
          })
        } else {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butlerName}试图靠近，但${petName}是否回应仍由自己决定。`,
          })
        }

        this.butlerSystem.consumeOpportunity(opportunity.id)
      }
    }

    const latestPet = this.petSystem.getPet()

    if (
      latestPet &&
      latestPet.action === "sleeping" &&
      (latestPet.timelineSnapshot?.state.physical.energy ?? latestPet.energy) < 100
    ) {
      this.eventSystem.addInteractionEvent({
        tick: this.tick,
        day: time.day,
        hour: time.hour,
        message: `${latestPet.name}正在休息，精力正在恢复。`,
      })
    }
  }

  private emitUpdate() {
    if (!this.onUpdate) return

    this.onUpdate({
      tick: this.tick,
      time: this.timeSystem.getFormattedTime(),
      timeState: this.timeSystem.getTime(),
      pet: this.petSystem.getPet(),
      butler: this.butlerSystem.getState(),
      home: this.homeSystem.getHome(),
      incubator: this.incubatorSystem.getIncubator(),
      events: this.eventSystem.getEvents(),
      worldStimuli: this.worldStimuli,
      ecology: this.getEcology(),
      worldRuntime: this.getWorldRuntime(),
    })
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
    this.worldRuntime = runWorldSimulation({
      previous: null,
      tick: this.tick,
      time: this.timeSystem.getTime(),
      homeLevel: this.homeSystem.getHome().level,
      petCount: 0,
      hasHospital: false,
      hasShop: false,
      hasPark: false,
    }).runtime
    this.initialized = false
  }
}

export const worldEngine = new WorldEngine()
