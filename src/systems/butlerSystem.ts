/**
 * ======================================================
 * AI-PET-WORLD
 * Butler System
 * ======================================================
 *
 * 当前文件负责：
 * 1. 管家自身任务判断
 * 2. 管家发起对宠物的“行为机会”
 * 3. 管家作为玩家映射体/平行主体存在，而不是宠物控制器
 *
 * 关键原则：
 * - 管家不能直接替宠物做决定
 * - 管家不能直接改写宠物最终行为结果
 * - 管家只能提供资源、发起机会、执行管理
 * ======================================================
 */

import type { PetState } from "../types/pet"
import type { IncubatorState } from "../types/incubator"
import type { HomeState } from "../types/home"
import {
  getEntityAutonomyPolicy,
  getOpportunityRule,
} from "../ai/autonomy-core/autonomy-gateway"

export type ButlerTask =
  | "watching_incubator"
  | "building_home"
  | "watching_pet"
  | "offering_food"
  | "offering_rest"
  | "offering_approach"
  | "idle"

export type ButlerMood =
  | "calm"
  | "busy"
  | "gentle"
  | "alert"
  | "focused"

export type ButlerOpportunityType =
  | "food_offer"
  | "rest_offer"
  | "approach_offer"

export type ButlerOpportunity = {
  id: string
  type: ButlerOpportunityType
  createdAtTick: number
  expiresAtTick: number
  createdBy: "butler"
  target: "pet"
  summary: string

  /**
   * 机会强度，不是结果强度
   * 例如 food_offer 的 portion 只是“提供量”，不是“实际吃掉量”
   */
  intensity: number

  /**
   * 可选附加信息
   */
  payload?: {
    foodPortion?: number
    comfortLevel?: number
    socialWarmth?: number
  }
}

export type ButlerState = {
  /**
   * 兼容世界层 / 事件层正式 ButlerState
   */
  name: string
  task: ButlerTask
  mood: ButlerMood
  lastTaskChangedTick: number
  pendingOpportunities: ButlerOpportunity[]
}

export type ButlerSystemInput = {
  tick: number
  pet: PetState | null
  incubator: IncubatorState | null
  home: HomeState | null
  time: {
    day: number
    hour: number
    period?: string
  }
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function buildOpportunityId(
  type: ButlerOpportunityType,
  tick: number
): string {
  return `butler-${type}-${tick}`
}

function createFoodOffer(tick: number, portion: number): ButlerOpportunity {
  return {
    id: buildOpportunityId("food_offer", tick),
    type: "food_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 3,
    createdBy: "butler",
    target: "pet",
    summary: "管家提供了可被宠物自主决定是否接受的食物机会。",
    intensity: clamp(portion, 1, 100),
    payload: {
      foodPortion: clamp(portion, 1, 100),
    },
  }
}

function createRestOffer(
  tick: number,
  comfortLevel: number
): ButlerOpportunity {
  return {
    id: buildOpportunityId("rest_offer", tick),
    type: "rest_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 4,
    createdBy: "butler",
    target: "pet",
    summary: "管家整理了恢复环境，给宠物提供休息机会。",
    intensity: clamp(comfortLevel, 1, 100),
    payload: {
      comfortLevel: clamp(comfortLevel, 1, 100),
    },
  }
}

function createApproachOffer(
  tick: number,
  socialWarmth: number
): ButlerOpportunity {
  return {
    id: buildOpportunityId("approach_offer", tick),
    type: "approach_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 2,
    createdBy: "butler",
    target: "pet",
    summary: "管家发起了一次可被宠物自主回应的关系接近机会。",
    intensity: clamp(socialWarmth, 1, 100),
    payload: {
      socialWarmth: clamp(socialWarmth, 1, 100),
    },
  }
}

function removeExpiredOpportunities(
  opportunities: ButlerOpportunity[],
  tick: number
): ButlerOpportunity[] {
  return opportunities.filter((item) => item.expiresAtTick >= tick)
}

function hasPendingOpportunity(
  opportunities: ButlerOpportunity[],
  type: ButlerOpportunityType
): boolean {
  return opportunities.some((item) => item.type === type)
}

function petExistsAndBorn(pet: PetState | null): boolean {
  return !!pet
}

function isIncubatorCompleted(incubator: IncubatorState | null): boolean {
  if (!incubator) return true

  /**
   * 当前项目里不要假设存在 "completed" 这个 status
   * 统一用 progress 判断是否已完成孵化
   */
  return incubator.progress >= 100
}

function shouldOfferFood(pet: PetState | null): boolean {
  if (!pet?.timelineSnapshot) return false

  const hunger = pet.timelineSnapshot.state.physical.hunger
  const emotion = pet.timelineSnapshot.state.emotional.label

  /**
   * 这里只判断“是否值得提供食物机会”
   * 不是判断“宠物一定会吃”
   */
  if (hunger >= 58) return true

  /**
   * 情绪低或偏紧张时，可以更早准备食物机会
   */
  if (
    hunger >= 48 &&
    (emotion === "low" || emotion === "anxious" || emotion === "irritated")
  ) {
    return true
  }

  return false
}

function shouldOfferRest(
  pet: PetState | null,
  inputTime: ButlerSystemInput["time"]
): boolean {
  if (!pet?.timelineSnapshot) return false

  const energy = pet.timelineSnapshot.state.physical.energy
  const phaseTag = pet.timelineSnapshot.fortune.phaseTag
  const hour = inputTime.hour

  if (energy <= 40) return true
  if (phaseTag === "recovery_phase") return true
  if ((hour >= 22 || hour <= 5) && energy <= 65) return true

  return false
}

function shouldOfferApproach(pet: PetState | null): boolean {
  if (!pet?.timelineSnapshot) return false

  const relation = pet.timelineSnapshot.state.relational.label
  const emotion = pet.timelineSnapshot.state.emotional.label
  const hunger = pet.timelineSnapshot.state.physical.hunger
  const energy = pet.timelineSnapshot.state.physical.energy

  /**
   * 关系较安全、身体没太差时，才更适合发起接近机会
   */
  if (
    (relation === "secure" || relation === "attached") &&
    hunger < 65 &&
    energy > 35 &&
    emotion !== "irritated" &&
    emotion !== "anxious"
  ) {
    return true
  }

  return false
}

function shouldBuildHome(
  home: HomeState | null,
  pet: PetState | null,
  incubator: IncubatorState | null
): boolean {
  if (!home) return false

  /**
   * 孵化阶段优先照看孵化器
   */
  if (!isIncubatorCompleted(incubator)) {
    return false
  }

  /**
   * 宠物出生后，如果状态偏脆弱，先不把建家园放太前
   */
  if (pet?.timelineSnapshot) {
    const energy = pet.timelineSnapshot.state.physical.energy
    const hunger = pet.timelineSnapshot.state.physical.hunger

    if (energy <= 35 || hunger >= 65) {
      return false
    }
  }

  return home.status !== "completed"
}

function chooseButlerTask(
  input: ButlerSystemInput,
  state: ButlerState
): ButlerTask {
  const { pet, incubator, home, time } = input

  if (!isIncubatorCompleted(incubator)) {
    return "watching_incubator"
  }

  if (petExistsAndBorn(pet)) {
    if (shouldOfferFood(pet)) {
      return "offering_food"
    }

    if (shouldOfferRest(pet, time)) {
      return "offering_rest"
    }

    if (shouldOfferApproach(pet)) {
      return "offering_approach"
    }

    if (shouldBuildHome(home, pet, incubator)) {
      return "building_home"
    }

    return "watching_pet"
  }

  if (shouldBuildHome(home, pet, incubator)) {
    return "building_home"
  }

  return state.pendingOpportunities.length > 0 ? "watching_pet" : "idle"
}

function deriveButlerMood(task: ButlerTask): ButlerMood {
  switch (task) {
    case "watching_incubator":
      return "focused"
    case "building_home":
      return "busy"
    case "offering_food":
      return "gentle"
    case "offering_rest":
      return "gentle"
    case "offering_approach":
      return "calm"
    case "watching_pet":
      return "calm"
    case "idle":
    default:
      return "calm"
  }
}

export class ButlerSystem {
  private state: ButlerState = {
    name: "管家",
    task: "idle",
    mood: "calm",
    lastTaskChangedTick: 0,
    pendingOpportunities: [],
  }

  constructor() {}

  update(input: ButlerSystemInput): ButlerState {
    const butlerPolicy = getEntityAutonomyPolicy("butler")
    const foodRule = getOpportunityRule("food_offer")
    const restRule = getOpportunityRule("rest_offer")
    const approachRule = getOpportunityRule("approach_offer")

    /**
     * 清理过期机会
     */
    this.state.pendingOpportunities = removeExpiredOpportunities(
      this.state.pendingOpportunities,
      input.tick
    )

    const nextTask = chooseButlerTask(input, this.state)

    if (nextTask !== this.state.task) {
      this.state.task = nextTask
      this.state.lastTaskChangedTick = input.tick
    }

    this.state.mood = deriveButlerMood(this.state.task)

    /**
     * 管家自己的自主策略仍然存在，
     * 但它不能越过 autonomy-core 去直接写宠物结果。
     */
    if (!butlerPolicy?.ownsFinalDecision) {
      return this.state
    }

    if (
      this.state.task === "offering_food" &&
      foodRule &&
      foodRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "food_offer")
    ) {
      this.state.pendingOpportunities.push(
        createFoodOffer(input.tick, 18)
      )
    }

    if (
      this.state.task === "offering_rest" &&
      restRule &&
      restRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "rest_offer")
    ) {
      this.state.pendingOpportunities.push(
        createRestOffer(input.tick, 16)
      )
    }

    if (
      this.state.task === "offering_approach" &&
      approachRule &&
      approachRule.requiresSelfAcceptance &&
      !hasPendingOpportunity(this.state.pendingOpportunities, "approach_offer")
    ) {
      this.state.pendingOpportunities.push(
        createApproachOffer(input.tick, 12)
      )
    }

    return this.state
  }

  getState(): ButlerState {
    return this.state
  }

  getButler(): ButlerState {
    return this.state
  }

  getPendingOpportunities(): ButlerOpportunity[] {
    return this.state.pendingOpportunities
  }

  /**
   * 当外部系统确认某个机会已经被消费后，移除它
   * 注意：
   * - 这里的“消费”不代表宠物一定接受了
   * - 只是这次机会已经进入宠物决策流程，不再重复悬挂
   */
  consumeOpportunity(opportunityId: string) {
    this.state.pendingOpportunities = this.state.pendingOpportunities.filter(
      (item) => item.id !== opportunityId
    )
  }

  clearAllOpportunities() {
    this.state.pendingOpportunities = []
  }
}

export const butlerSystem = new ButlerSystem()
export default butlerSystem