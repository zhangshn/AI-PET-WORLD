/**
 * ======================================================
 * AI-PET-WORLD
 * Butler System
 *
 * 功能：
 * 1. 管理 AI 管家
 * 2. 根据世界阶段决定优先任务
 *
 * 这一版的重要变化：
 * - 开局世界没有已出生宠物
 * - 管家的优先任务不再是“直接照顾宠物”
 * - 而是：
 *   1. 优先照看孵化器
 *   2. 其次建造家园
 *   3. 宠物出生后再巡视/照顾宠物
 *
 * 说明：
 * 为了减少当前类型改动，我们暂时继续复用已有 task 枚举：
 * - feeding_pet：在前期表示“照看孵化器 / 生命照护任务”
 * - building_home：建造家园
 * - watching_pet：宠物出生后巡视宠物
 * ======================================================
 */

import { ButlerState } from "../types/butler"
import { PetState } from "../types/pet"
import { TimeState } from "../engine/timeSystem"
import { IncubatorState } from "../types/incubator"
import { HomeState } from "../types/home"

export class ButlerSystem {
  /**
   * 当前管家状态
   */
  private butler: ButlerState

  constructor() {
    this.butler = {
      name: "Astra",
      task: "idle",
      mood: "calm"
    }
  }

  /**
   * ======================================================
   * 每个世界 Tick 更新一次管家状态
   *
   * 新逻辑输入：
   * - pet：当前已出生宠物（可能为 null）
   * - time：当前时间
   * - incubator：当前孵化器状态
   * - home：当前家园状态
   * ======================================================
   */
  update(
    pet: PetState | null,
    time: TimeState,
    incubator: IncubatorState,
    home: HomeState
  ) {
    this.updateTask(pet, time, incubator, home)
    this.updateMood()

    console.log(
      `管家状态：任务=${this.butler.task} 心情=${this.butler.mood}`
    )
  }

  /**
   * ======================================================
   * 管家任务决策
   *
   * 当前业务优先级：
   *
   * 1. 如果胚胎还未孵化完成，优先照看孵化器
   * 2. 如果孵化器阶段暂时稳定，则建造家园
   * 3. 宠物出生后，如果宠物很饿，优先照顾宠物
   * 4. 其余情况巡视宠物 / 世界
   *
   * 注意：
   * 这是 MVP 简化版，不做复杂 AI 权重，只做优先级规则。
   * ======================================================
   */
  private updateTask(
    pet: PetState | null,
    time: TimeState,
    incubator: IncubatorState,
    home: HomeState
  ) {
    /**
     * 第一优先级：胚胎尚未孵化完成时，优先照看孵化器
     *
     * 条件：
     * - 孵化器中有胚胎
     * - 状态不是 hatched
     * - 如果稳定度偏低，或者进度还没完成，就继续照看
     */
    if (
      incubator.hasEmbryo &&
      incubator.status !== "hatched" &&
      (incubator.stability < 90 || incubator.progress < 100)
    ) {
      this.butler.task = "feeding_pet"
      return
    }

    /**
     * 第二优先级：如果家园还没完成，就建造家园
     */
    if (home.status !== "completed") {
      this.butler.task = "building_home"
      return
    }

    /**
     * 第三优先级：宠物出生后，如果很饿，则优先照顾宠物
     */
    if (pet && pet.hunger >= 60) {
      this.butler.task = "feeding_pet"
      return
    }

    /**
     * 第四优先级：宠物出生后，巡视宠物
     */
    if (pet) {
      this.butler.task = "watching_pet"
      return
    }

    /**
     * 最后：如果没有宠物也没有其他任务，就空闲
     */
    this.butler.task = "idle"
  }

  /**
   * ======================================================
   * 根据任务更新管家心情
   * ======================================================
   */
  private updateMood() {
    if (this.butler.task === "feeding_pet") {
      this.butler.mood = "busy"
      return
    }

    if (this.butler.task === "building_home") {
      this.butler.mood = "busy"
      return
    }

    if (this.butler.task === "watching_pet") {
      this.butler.mood = "calm"
      return
    }

    this.butler.mood = "calm"
  }

  /**
   * ======================================================
   * 获取当前管家状态
   * ======================================================
   */
  getButler(): ButlerState {
    return { ...this.butler }
  }
}