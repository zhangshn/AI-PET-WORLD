/**
 * ======================================================
 * AI-PET-WORLD
 * Event Style Schema
 * ======================================================
 *
 * 当前文件负责：定义事件文案系统（event-style）的输入结构
 *
 * 设计原则：
 * - 不暴露紫微斗数细节（仅使用 PersonalityProfile）
 * - 支持行为叙事（action narrative）
 * - 支持连续事件（continuity）
 * - 支持强度变化（intensity）
 * - 支持未来扩展（但保持当前最小稳定结构）
 * ======================================================
 */

import type { PersonalityProfile } from "../ziwei-core/schema"

/**
 * ======================================================
 * 场景类型
 * ======================================================
 */
export type PetEventScene =
  | "pet_action_changed"
  | "pet_action_narrative"
  | "pet_mood_changed"
  | "pet_action_end"

/**
 * ======================================================
 * 行为类型（与 PetAction 对齐，但不强耦合 types/pet.ts）
 * ======================================================
 */
export type PetEventAction =
  | "sleeping"
  | "walking"
  | "eating"
  | "exploring"
  | "approaching"
  | "idle"
  | "observing"
  | "resting"
  | "alert_idle"

/**
 * ======================================================
 * 情绪类型（用于 mood 事件）
 * ======================================================
 */
export type PetEventMood =
  | "happy"
  | "normal"
  | "sad"
  | "calm"
  | "curious"
  | "alert"

/**
 * ======================================================
 * 家园上下文（弱依赖）
 * ======================================================
 */
export type PetHomeContext = {
  /**
   * 一句轻量环境提示
   */
  homeNote?: string
}

/**
 * ======================================================
 * 事件输入结构（核心）
 * ======================================================
 */
export interface PetEventStyleInput {
  /**
   * 当前场景
   */
  scene: PetEventScene

  /**
   * 宠物名称
   */
  petName: string

  /**
   * 行为（可选：仅 action 场景使用）
   */
  action?: PetEventAction

  /**
   * 情绪（可选：仅 mood 场景使用）
   */
  mood?: PetEventMood

  /**
   * 人格（核心输入）
   */
  personalityProfile: PersonalityProfile

  /**
   * 家园上下文（弱影响）
   */
  homeContext?: PetHomeContext

  /**
   * 强度（0~1）
   */
  intensity?: number

  /**
   * 叙事类型（由 eventSystem 决定）
   */
  narrativeType?: string

  /**
   * 连续事件链 ID
   */
  continuityId?: string

  /**
   * 当前是第几步（连续叙事）
   *
   * ⚠ 注意：
   * - 只用于文案风格变化
   * - 不进入 WorldEvent 顶层
   */
  continuityStep?: number
}