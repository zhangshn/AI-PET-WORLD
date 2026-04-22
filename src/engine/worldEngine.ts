/**
 * ======================================================
 * AI-PET-WORLD
 * World Engine
 * ======================================================
 *
 * 当前文件负责：
 * 1. 驱动世界 Tick 循环
 * 2. 推进时间系统
 * 3. 更新孵化器系统
 * 4. 更新管家系统
 * 5. 处理世界管理互动
 * 6. 在宠物出生后启动宠物行为系统
 * 7. 处理“机会模型”下的管家->宠物互动
 * 8. 汇总事件并同步给 UI
 *
 * 关键原则：
 * - 管家只能提供机会，不能直接替宠物做决定
 * - 宠物是否接受机会，由宠物当前状态 / 目标 / 行为自主决定
 * - 世界规则是参照物，不是命令器
 * ======================================================
 */

import { TimeSystem, TimeState } from "./timeSystem"
import { PetSystem } from "../systems/petSystem"
import {
  ButlerSystem,
  type ButlerOpportunity,
} from "../systems/butlerSystem"

import type { ButlerState } from "../types/butler"
import { EventSystem } from "../systems/eventSystem"
import { HomeSystem } from "../systems/homeSystem"
import { IncubatorSystem } from "../systems/incubatorSystem"

import { buildPetBirthBundle } from "../ai/gateway"

import type { PetState } from "../types/pet"
import type { HomeState } from "../types/home"
import type { IncubatorState } from "../types/incubator"
import type { WorldEvent } from "../types/event"

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

type FoodAcceptanceResult = {
  accepted: boolean
  intakeAmount: number
  reason: string
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
   * ====================================================
   * 启动世界循环
   * ====================================================
   */
  start() {
    if (this.interval) return

    this.interval = setInterval(() => {
      this.update()
    }, 1000)
  }

  /**
   * ====================================================
   * 世界更新主循环
   * ====================================================
   */
  private update() {
    this.tick++

    const prevTime = this.timeSystem.getTime()
    const prevPet = this.petSystem.getPet()
    const prevButler = this.butlerSystem.getState()
    const prevIncubator = this.incubatorSystem.getIncubator()

    // ===============================
    // A. 时间推进
    // ===============================
    this.timeSystem.update()
    const currentTime = this.timeSystem.getTime()

    // ===============================
    // B. 孵化器更新
    // ===============================
    this.incubatorSystem.update()
    let currentIncubator = this.incubatorSystem.getIncubator()

    // ===============================
    // C. 取当前家园 / 宠物
    // ===============================
    let currentHome = this.homeSystem.getHome()
    let currentPet = this.petSystem.getPet()

    // ===============================
    // D. 管家更新（只判断自己的任务与机会）
    // ===============================
    this.butlerSystem.update({
      tick: this.tick,
      pet: currentPet,
      incubator: currentIncubator,
      home: currentHome,
      time: currentTime,
    })

    let currentButler = this.butlerSystem.getState()

    // ===============================
    // E. 世界管理互动（孵化器 / 家园）
    // ===============================
    this.handleManagementInteractions(currentTime, currentButler)

    // ===============================
    // F. 重新获取最新状态
    // ===============================
    currentIncubator = this.incubatorSystem.getIncubator()
    currentHome = this.homeSystem.getHome()
    currentPet = this.petSystem.getPet()
    currentButler = this.butlerSystem.getState()

    // ===============================
    // G. 宠物行为系统
    // ===============================
    if (this.petSystem.hasPet()) {
      this.petSystem.update(currentTime)
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
          currentPet.timelineSnapshot?.state.emotional.label ?? currentPet.mood
        )
      }
    } else {
      console.log("世界引擎：当前宠物尚未出生，宠物行为系统未激活。")
    }

    // ===============================
    // H. 处理管家提供的机会（宠物出生后）
    // ===============================
    this.handleButlerOpportunities(currentTime)

    // ===============================
    // I. 再取一遍最新状态
    // ===============================
    currentIncubator = this.incubatorSystem.getIncubator()
    currentHome = this.homeSystem.getHome()
    currentPet = this.petSystem.getPet()
    currentButler = this.butlerSystem.getState()

    // ===============================
    // J. 事件系统
    // ===============================
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

    // ===============================
    // K. UI 同步
    // ===============================
    if (this.onUpdate) {
      this.onUpdate({
        tick: this.tick,
        time: this.timeSystem.getFormattedTime(),
        timeState: currentTime,
        pet: currentPet,
        butler: currentButler,
        home: currentHome,
        incubator: currentIncubator,
        events: this.eventSystem.getEvents(),
      })
    }
  }

  /**
   * ====================================================
   * 世界管理互动
   * 这里只处理：
   * 1. 照看孵化器
   * 2. 宠物出生
   * 3. 建造家园
   *
   * 注意：
   * - 不在这里直接替宠物吃饭
   * ====================================================
   */
  private handleManagementInteractions(time: TimeState, butler: ButlerState) {
    const butlerName = "管家"

    /**
     * --------------------------------------------------
     * A. 管家照看孵化器（宠物未出生时）
     * --------------------------------------------------
     */
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

      /**
       * 达到出生条件
       */
      if (this.incubatorSystem.canHatch()) {
        const petName = this.incubatorSystem.hatch()

        if (petName) {
          /**
           * ============================================
           * 出生时刻：personality 使用真实时间
           * timeline 使用世界时间
           * ============================================
           */
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
            summaries: birthBundle.personalityProfile.summaries,
            traits: birthBundle.personalityProfile.traits,
            consciousness: birthBundle.consciousnessProfile,
            memory: birthBundle.memoryState,
            timelinePhase: createdPet?.timelineSnapshot?.fortune.phaseTag,
            timelineBranch: createdPet?.timelineSnapshot?.trajectory.branchTag,
            timelineEmotion: createdPet?.timelineSnapshot?.state.emotional.label,
            timelineDrive: createdPet?.timelineSnapshot?.state.drive.primary,
          })
        }
      }
    }

    /**
     * --------------------------------------------------
     * B. 管家建造家园
     * --------------------------------------------------
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
            message: `${butlerName}推进了家园建造，进度 +${progressAdded}。`,
          })
        }

        if (homeAfter.status === "completed") {
          this.eventSystem.addInteractionEvent({
            tick: this.tick,
            day: time.day,
            hour: time.hour,
            message: `家园第一阶段建造完成了。`,
          })
        }
      }
    }
  }

  /**
   * ====================================================
   * 处理管家提供的机会
   *
   * 关键变化：
   * - 不再直接 if task === feeding_pet -> hunger -= x
   * - 改成读取 butlerSystem 的 pending opportunities
   * - 再由宠物依据自己的状态/目标/行为决定是否接受
   * ====================================================
   */
  private handleButlerOpportunities(time: TimeState) {
    if (!this.petSystem.hasPet()) {
      return
    }

    const pet = this.petSystem.getPet()
    if (!pet) return

    const opportunities = this.butlerSystem.getPendingOpportunities()
    if (opportunities.length === 0) {
      return
    }

    const petName = pet.name
    const butlerName = "管家"

    for (const opportunity of opportunities) {
      if (opportunity.target !== "pet") {
        continue
      }

      /**
       * ------------------------------------------------
       * A. food_offer
       * ------------------------------------------------
       * 管家只是提供食物机会。
       * 是否接受、吃多少，由宠物当下状态自主决定。
       */
      if (opportunity.type === "food_offer") {
        const result = this.resolveFoodOfferByPet(pet, opportunity)

        if (result.accepted && result.intakeAmount > 0) {
          this.petSystem.applyFeeding(result.intakeAmount)

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

      /**
       * ------------------------------------------------
       * B. rest_offer
       * ------------------------------------------------
       * 这里只提供恢复机会和提示，不直接强制恢复。
       */
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

      /**
       * ------------------------------------------------
       * C. approach_offer
       * ------------------------------------------------
       * 管家发起接近机会，但不直接等于宠物接受靠近。
       */
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

    /**
     * --------------------------------------------------
     * D. 宠物睡觉恢复精力（结果提示事件）
     * --------------------------------------------------
     */
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

  /**
   * ====================================================
   * 宠物对 food_offer 的自主判断
   *
   * 这是当前 worldEngine 中的过渡实现：
   * - 管家提供 food_offer
   * - 宠物依据自己的状态/目标/行为决定是否接受
   * - 实际摄食量不是固定值
   *
   * 未来可以进一步下沉到 petSystem / autonomous behavior chain
   * ====================================================
   */
  private resolveFoodOfferByPet(
    pet: PetState,
    opportunity: ButlerOpportunity
  ): FoodAcceptanceResult {
    const snapshot = pet.timelineSnapshot

    if (!snapshot) {
      return {
        accepted: false,
        intakeAmount: 0,
        reason: "当前没有可用状态快照",
      }
    }

    const hunger = snapshot.state.physical.hunger
    const energy = snapshot.state.physical.energy
    const emotion = snapshot.state.emotional.label
    const appetiteTrait = pet.personalityProfile.traits.appetite
    const comfortSeeking = pet.consciousnessProfile.bias.comfortSeeking
    const changeSeeking = pet.consciousnessProfile.bias.changeSeeking
    const memoryEatBias = pet.memoryState.preferenceBias.eatBias
    const currentGoal = pet.currentGoal?.type
    const currentAction = pet.action

    const offeredPortion =
      opportunity.payload?.foodPortion ?? Math.round(opportunity.intensity)

    /**
     * ============================================
     * 1. 是否接受机会
     * ============================================
     */
    let acceptanceScore = 0

    /**
     * 身体需求
     */
    acceptanceScore += Math.max(0, hunger - 35) * 1.1

    /**
     * 很低能量时，也会更愿意接受食物
     */
    if (energy <= 30) {
      acceptanceScore += 10
    }

    /**
     * 当前目标与行为
     */
    if (currentGoal === "satisfy_need") {
      acceptanceScore += 22
    }

    if (currentAction === "eating") {
      acceptanceScore += 16
    }

    /**
     * 性格与意识偏压
     */
    acceptanceScore += (appetiteTrait - 50) * 0.35
    acceptanceScore += memoryEatBias * 0.35
    acceptanceScore += (comfortSeeking - 50) * 0.12

    /**
     * 强变化倾向个体，在轻度饥饿时可能更不愿中断当前外向行为
     */
    if (changeSeeking >= 70 && hunger < 65) {
      acceptanceScore -= 8
    }

    /**
     * 情绪影响
     */
    if (emotion === "anxious" || emotion === "irritated") {
      if (hunger < 70) {
        acceptanceScore -= 10
      } else {
        acceptanceScore -= 4
      }
    }

    if (emotion === "relaxed" || emotion === "content") {
      acceptanceScore += 4
    }

    /**
     * 最终是否接受
     */
    const accepted = acceptanceScore >= 18

    if (!accepted) {
      return {
        accepted: false,
        intakeAmount: 0,
        reason: "当前自主判断未选择接受食物机会",
      }
    }

    /**
     * ============================================
     * 2. 实际摄食量
     * ============================================
     *
     * 这不是固定喂食值，而是：
     * - 看 hunger
     * - 看 appetite
     * - 看 goal
     * - 看情绪
     * - 看记忆偏压
     */
    let intakeRatio = 0.35

    /**
     * hunger 越高，越容易吃得多
     */
    intakeRatio += Math.max(0, hunger - 40) / 100 * 0.45

    /**
     * appetiteTrait 越高，越容易吃得更足
     */
    intakeRatio += (appetiteTrait - 50) / 100 * 0.22

    /**
     * 当前就是满足需求目标时，会吃得更完整
     */
    if (currentGoal === "satisfy_need") {
      intakeRatio += 0.16
    }

    /**
     * 已进入 eating 行为时，会比“只是看到食物机会”吃得更多
     */
    if (currentAction === "eating") {
      intakeRatio += 0.12
    }

    /**
     * 焦躁/不安时，在不是极饿的情况下会偏少吃
     */
    if ((emotion === "anxious" || emotion === "irritated") && hunger < 75) {
      intakeRatio -= 0.12
    }

    /**
     * 记忆中“吃东西有效”会略提升实际摄食量
     */
    intakeRatio += memoryEatBias / 100 * 0.18

    intakeRatio = Math.max(0.2, Math.min(1, intakeRatio))

    const intakeAmount = Math.max(
      4,
      Math.min(offeredPortion, Math.round(offeredPortion * intakeRatio))
    )

    /**
     * 3. 给一个简短原因
     */
    let reason = "基于当前身体状态与自主意愿选择了摄食"

    if (currentGoal === "satisfy_need") {
      reason = "当前目标正在满足身体需求"
    } else if (currentAction === "eating") {
      reason = "当前已经进入进食行为，继续完成这次摄食"
    } else if (hunger >= 70) {
      reason = "当前饥饿感较强，因此接受了食物机会"
    }

    return {
      accepted: true,
      intakeAmount,
      reason,
    }
  }

  /**
   * ====================================================
   * 停止世界循环
   * ====================================================
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}