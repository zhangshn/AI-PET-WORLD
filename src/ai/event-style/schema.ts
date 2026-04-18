/**
 * ======================================================
 * AI-PET-WORLD
 * Event Style - Schema
 *
 * 功能：
 * 定义事件文案核心模块所需的数据结构
 *
 * 设计原则：
 * 1. 这个模块只负责“文本风格表达”
 * 2. 不负责业务状态变更
 * 3. 外部系统只传入当前事件上下文和人格结果
 * 4. 返回最终可展示的中文事件文案
 * ======================================================
 */

import type { PetAction, PetMood } from "../../types/pet"
import type { PersonalityProfile } from "../personality-core/gateway"

/**
 * 宠物事件场景
 *
 * 当前只先支持两种：
 * - 行为变化
 * - 心情变化
 */
export type PetEventScene =
  | "pet_action_changed"
  | "pet_mood_changed"

/**
 * 宠物行为事件文案输入
 */
export type PetActionEventInput = {
  scene: "pet_action_changed"
  petName: string
  action: PetAction
  personalityProfile: PersonalityProfile
}

/**
 * 宠物心情事件文案输入
 */
export type PetMoodEventInput = {
  scene: "pet_mood_changed"
  petName: string
  mood: PetMood
  personalityProfile: PersonalityProfile
}

/**
 * 宠物事件文案统一输入类型
 */
export type PetEventStyleInput =
  | PetActionEventInput
  | PetMoodEventInput