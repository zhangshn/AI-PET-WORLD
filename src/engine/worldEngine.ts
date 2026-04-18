/**
 * ======================================================
 * AI-PET-WORLD
 * World Engine
 *
 * 功能：
 * 1. 驱动世界 Tick 循环
 * 2. 更新时间系统
 * 3. 更新孵化器系统
 * 4. 更新管家系统
 * 5. 处理世界互动
 * 6. 宠物出生后启动行为循环
 * 7. 汇总事件并同步给 UI
 *
 * 正确业务逻辑：
 * - 胚胎阶段没有人格
 * - 人格只在出生那一刻，根据出生时间生成
 * - 出生后人格绑定到宠物实体，并开始影响行为与事件
 * ======================================================
 */

import { TimeSystem, TimeState } from "./timeSystem"
import { PetSystem } from "../systems/petSystem"
import { ButlerSystem } from "../systems/butlerSystem"
import { EventSystem } from "../systems/eventSystem"
import { HomeSystem } from "../systems/homeSystem"
import { IncubatorSystem } from "../systems/incubatorSystem"

import { createPersonalityProfile } from "../ai/personality-core/gateway"

import { PetState } from "../types/pet"
import { ButlerState } from "../types/butler"
import { HomeState } from "../types/home"
import { IncubatorState } from "../types/incubator"
import { WorldEvent } from "../types/event"

export type WorldState = {
  tick: number
  time: string
  timeState: TimeState
  pet: PetState | null
  butler: ButlerState
  home: HomeState
  incubator: IncubatorState
  events: WorldEvent[]
}

export class WorldEngine {
  private tick: number = 0

  private timeSystem: TimeSystem
  private petSystem: PetSystem
  private butlerSystem: ButlerSystem
  private eventSystem: EventSystem
  private homeSystem: HomeSystem
  private incubatorSystem: IncubatorSystem

  private interval: ReturnType<typeof setInterval> | null = null

  onUpdate?: (state: WorldState) => void

  constructor() {
    this.timeSystem = new TimeSystem()
    this.petSystem = new PetSystem()
    this.butlerSystem = new ButlerSystem()
    this.eventSystem = new EventSystem()
    this.homeSystem = new HomeSystem()
    this.incubatorSystem = new IncubatorSystem()
  }

  /**
   * ======================================================
   * 启动世界循环
   * ======================================================
   */
  start() {
    this.interval = setInterval(() => {
      this.update()
    }, 1000)
  }

  /**
   * ======================================================
   * 世界更新主循环
   * ======================================================
   */
  private update() {
    this.tick++

    const prevTime = this.timeSystem.getTime()
    const prevPet = this.petSystem.getPet()
    const prevButler = this.butlerSystem.getButler()
    const prevIncubator = this.incubatorSystem.getIncubator()

    this.timeSystem.update()
    const currentTime = this.timeSystem.getTime()

    this.incubatorSystem.update()
    let currentIncubator = this.incubatorSystem.getIncubator()

    let currentHome = this.homeSystem.getHome()
    let currentPet = this.petSystem.getPet()

    this.butlerSystem.update(
      currentPet,
      currentTime,
      currentIncubator,
      currentHome
    )
    let currentButler = this.butlerSystem.getButler()

    this.handleInteractions(currentTime, currentButler)

    currentIncubator = this.incubatorSystem.getIncubator()
    currentHome = this.homeSystem.getHome()
    currentPet = this.petSystem.getPet()
    currentButler = this.butlerSystem.getButler()

    if (this.petSystem.hasPet()) {
      this.petSystem.update(currentTime)
      currentPet = this.petSystem.getPet()
    } else {
      console.log("世界引擎：当前宠物尚未出生，宠物行为系统未激活。")
    }

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
      currentIncubator
    })

    console.log("世界 Tick：", this.tick)
    console.log("当前时间：", this.timeSystem.getFormattedTime())

    if (this.onUpdate) {
      this.onUpdate({
        tick: this.tick,
        time: this.timeSystem.getFormattedTime(),
        timeState: currentTime,
        pet: currentPet,
        butler: currentButler,
        home: currentHome,
        incubator: currentIncubator,
        events: this.eventSystem.getEvents()
      })
    }
  }

  /**
   * ======================================================
   * 处理互动逻辑
   *
   * 当前支持：
   * 1. 管家照看孵化器
   * 2. 管家建造家园
   * 3. 孵化完成 → 出生时刻生成最终人格 → 绑定宠物
   * 4. 宠物出生后，管家照顾宠物
   * ======================================================
   */
  private handleInteractions(
    time: TimeState,
    butler: ButlerState
  ) {
    /**
     * A. 管家照看孵化器
     */
    if (butler.task === "feeding_pet" && !this.petSystem.hasPet()) {
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
          message: `${butler.name}正在照看孵化器，孵化进度 +${progressAdded}，稳定度 +${stabilityAdded}。`
        })
      }

      /**
       * 如果达到孵化条件，则正式出生
       */
      if (this.incubatorSystem.canHatch()) {
        const petName = this.incubatorSystem.hatch()

        if (petName) {
          /**
           * ------------------------------------------------
           * 出生时间输入
           * ------------------------------------------------
           *
           * 当前世界时间系统还没有完整的 year/month/day 历法，
           * 所以这里先做一个可运行的 MVP 映射：
           *
           * - year：固定世界年份占位
           * - month：用 day 映射近似月份
           * - day：当前世界 day，限制到 28
           * - hour：当前世界 hour
           *
           * 重要业务边界：
           * - 人格只在出生这一刻生成
           * - 出生前不生成、不预存、不预览人格
           */
          const birthInput = {
            year: 2026,
            month: Math.min(Math.max(Math.ceil(time.day / 3), 1), 12),
            day: Math.min(time.day, 28),
            hour: time.hour
          }

          /**
           * 出生时刻，正式生成最终人格
           */
          const finalProfile = createPersonalityProfile(birthInput)

          /**
           * 创建正式宠物实体，并绑定最终人格
           */
          this.petSystem.hatchPetWithProfile(petName, finalProfile)

          this.eventSystem.addPetHatchedEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            petName
          })

          console.log("世界引擎：宠物已在出生时刻生成人格并完成绑定。", {
            petName,
            birthInput,
            summaries: finalProfile.summaries,
            traits: finalProfile.traits
          })
        }
      }
    }

    /**
     * B. 管家建造家园
     */
    if (butler.task === "building_home") {
      const homeBefore = this.homeSystem.getHome()

      if (homeBefore.status !== "completed") {
        this.homeSystem.build(15)

        const homeAfter = this.homeSystem.getHome()
        const progressAdded = homeAfter.progress - homeBefore.progress

        if (progressAdded > 0) {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `${butler.name}推进了家园建造，进度 +${progressAdded}。`
          })
        }

        if (homeAfter.status === "completed") {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `家园第一阶段建造完成了。`
          })
        }
      }
    }

    /**
     * C. 宠物出生后，管家照顾宠物
     */
    if (butler.task === "feeding_pet" && this.petSystem.hasPet()) {
      const petBefore = this.petSystem.getPet()

      if (petBefore && petBefore.hunger > 0) {
        this.petSystem.applyFeeding(20)

        const petAfter = this.petSystem.getPet()

        if (petAfter) {
          const hungerReduced = petBefore.hunger - petAfter.hunger

          if (hungerReduced > 0) {
            this.eventSystem.addInteractionEvent({
              tick: this.tick,
              day: time.day,
              hour: time.hour,
              message: `${butler.name}照顾了${petAfter.name}，饥饿值下降了 ${hungerReduced}。`
            })
          }
        }
      }
    }

    /**
     * D. 宠物睡觉恢复精力（结果事件）
     */
    const pet = this.petSystem.getPet()

    if (pet && pet.action === "sleeping" && pet.energy < 100) {
      this.eventSystem.addInteractionEvent({
        tick: this.tick,
        day: time.day,
        hour: time.hour,
        message: `${pet.name}正在休息，精力正在恢复。`
      })
    }
  }

  /**
   * ======================================================
   * 停止世界循环
   * ======================================================
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}