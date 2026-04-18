/**
 * ======================================================
 * AI-PET-WORLD
 * Event System
 *
 * 功能：
 * 1. 检测世界状态变化
 * 2. 生成世界事件日志
 * 3. 提供手动写入互动结果事件的方法
 * 4. 支持孵化器相关事件
 * 5. 当前版本开始支持“人格化宠物事件文案”
 *
 * 当前支持：
 * - 时间段变化
 * - 孵化器状态变化
 * - 管家任务变化
 * - 宠物行为变化（人格化文案）
 * - 宠物心情变化（人格化文案）
 * - 手动互动结果事件
 * - 宠物出生事件
 * ======================================================
 */

import { TimePeriod } from "../engine/timeSystem"
import { PetState } from "../types/pet"
import { ButlerState } from "../types/butler"
import { IncubatorState } from "../types/incubator"
import { WorldEvent } from "../types/event"
import { buildPetEventMessage } from "../ai/event-style/gateway"

/**
 * EventSystem 一次更新所需输入
 *
 * 说明：
 * - 宠物在未出生阶段可能为 null
 * - 所以宠物相关字段必须允许空值
 */
type EventSystemUpdateInput = {
  tick: number
  day: number
  hour: number

  prevPeriod: TimePeriod
  currentPeriod: TimePeriod

  prevPet: PetState | null
  currentPet: PetState | null

  prevButler: ButlerState
  currentButler: ButlerState

  prevIncubator: IncubatorState
  currentIncubator: IncubatorState
}

export class EventSystem {
  /**
   * 事件列表
   * 最新事件放在前面
   */
  private events: WorldEvent[] = []

  /**
   * 最大事件数量
   */
  private maxEvents: number = 80

  /**
   * ======================================================
   * 每个世界 Tick 后的自动事件检测
   * ======================================================
   */
  update(input: EventSystemUpdateInput) {
    this.checkTimeEvents(input)
    this.checkIncubatorEvents(input)
    this.checkButlerEvents(input)
    this.checkPetEvents(input)
  }

  /**
   * ======================================================
   * 手动添加互动结果事件
   * ======================================================
   */
  addInteractionEvent(params: {
    tick: number
    day: number
    hour: number
    message: string
  }) {
    this.addEvent({
      tick: params.tick,
      day: params.day,
      hour: params.hour,
      type: "interaction_result",
      message: params.message
    })
  }

  /**
   * ======================================================
   * 手动添加宠物出生事件
   * ======================================================
   */
  addPetHatchedEvent(params: {
    tick: number
    day: number
    hour: number
    petName: string
  }) {
    this.addEvent({
      tick: params.tick,
      day: params.day,
      hour: params.hour,
      type: "pet_hatched",
      message: `${params.petName}成功孵化，正式来到这个世界了。`
    })
  }

  /**
   * ======================================================
   * 获取事件列表
   * ======================================================
   */
  getEvents(): WorldEvent[] {
    return [...this.events]
  }

  /**
   * ======================================================
   * 检查时间事件
   * ======================================================
   */
  private checkTimeEvents(input: EventSystemUpdateInput) {
    if (input.prevPeriod !== input.currentPeriod) {
      this.addEvent({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        type: "time_period_changed",
        message: `世界进入了${this.getPeriodText(input.currentPeriod)}。`
      })
    }
  }

  /**
   * ======================================================
   * 检查孵化器状态事件
   * ======================================================
   */
  private checkIncubatorEvents(input: EventSystemUpdateInput) {
    if (input.prevIncubator.status !== input.currentIncubator.status) {
      this.addEvent({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        type: "incubator_status_changed",
        message: this.getIncubatorStatusMessage(input.currentIncubator)
      })
    }
  }

  /**
   * ======================================================
   * 检查管家任务事件
   *
   * 当前先保持通用文本，
   * 下一轮如有需要可以再做“管家人格化文案”。
   * ======================================================
   */
  private checkButlerEvents(input: EventSystemUpdateInput) {
    if (input.prevButler.task !== input.currentButler.task) {
      this.addEvent({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        type: "butler_task_changed",
        message: this.getButlerTaskMessage(
          input.currentButler.name,
          input.currentButler.task
        )
      })
    }
  }

  /**
   * ======================================================
   * 检查宠物事件
   *
   * 当前版本重点升级：
   * - 宠物行为变化文案，改为通过独立文案模块生成
   * - 宠物心情变化文案，改为通过独立文案模块生成
   *
   * 这样做的意义：
   * - EventSystem 仍然只负责“检测变化”
   * - 具体怎么表达，由核心文案模块决定
   * ======================================================
   */
  private checkPetEvents(input: EventSystemUpdateInput) {
    /**
     * 当前没有宠物实体，直接跳过
     */
    if (!input.currentPet) {
      return
    }

    /**
     * 上一帧没有宠物，这一帧刚出生，
     * 出生事件会由 addPetHatchedEvent 手动记录，
     * 这里不再额外补行为/心情事件。
     */
    if (!input.prevPet) {
      return
    }

    /**
     * 宠物行为变化
     */
    if (input.prevPet.action !== input.currentPet.action) {
      this.addEvent({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        type: "pet_action_changed",
        message: buildPetEventMessage({
          scene: "pet_action_changed",
          petName: input.currentPet.name,
          action: input.currentPet.action,
          personalityProfile: input.currentPet.personalityProfile
        })
      })
    }

    /**
     * 宠物心情变化
     */
    if (input.prevPet.mood !== input.currentPet.mood) {
      this.addEvent({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        type: "pet_mood_changed",
        message: buildPetEventMessage({
          scene: "pet_mood_changed",
          petName: input.currentPet.name,
          mood: input.currentPet.mood,
          personalityProfile: input.currentPet.personalityProfile
        })
      })
    }
  }

  /**
   * ======================================================
   * 真正写入事件
   * ======================================================
   */
  private addEvent(params: {
    tick: number
    day: number
    hour: number
    type: WorldEvent["type"]
    message: string
  }) {
    const event: WorldEvent = {
      id: `${params.type}-${params.tick}-${params.day}-${params.hour}-${Date.now()}-${Math.random()}`,
      tick: params.tick,
      type: params.type,
      message: params.message,
      day: params.day,
      hour: params.hour
    }

    this.events.unshift(event)

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents)
    }

    console.log("事件：", event.message)
  }

  /**
   * ======================================================
   * 时间段转中文
   * ======================================================
   */
  private getPeriodText(period: TimePeriod): string {
    if (period === "Morning") return "早晨"
    if (period === "Daytime") return "白天"
    if (period === "Evening") return "傍晚"
    return "夜晚"
  }

  /**
   * ======================================================
   * 孵化器状态文案
   * ======================================================
   */
  private getIncubatorStatusMessage(incubator: IncubatorState): string {
    if (incubator.status === "incubating") {
      return `胚胎正在孵化器中稳定成长。`
    }

    if (incubator.status === "ready_to_hatch") {
      return `胚胎已经做好准备，随时可能孵化。`
    }

    if (incubator.status === "hatched") {
      return `孵化器中的胚胎已经完成孵化。`
    }

    return `孵化器状态发生了变化。`
  }

  /**
   * ======================================================
   * 管家任务文案
   * ======================================================
   */
  private getButlerTaskMessage(
    butlerName: string,
    task: ButlerState["task"]
  ): string {
    if (task === "feeding_pet") {
      return `${butlerName}开始照顾当前最需要被照看的对象。`
    }

    if (task === "watching_pet") {
      return `${butlerName}开始巡视宠物的活动情况。`
    }

    if (task === "building_home") {
      return `${butlerName}开始建造家园。`
    }

    if (task === "idle") {
      return `${butlerName}进入了空闲状态。`
    }

    return `${butlerName}切换了任务。`
  }
}