/**
 * ======================================================
 * AI-PET-WORLD
 * Attention System
 * ======================================================
 *
 * 当前文件负责：
 * 1. 管理宠物当前的注意力锁定
 * 2. 避免行为每个 tick 都大幅抖动
 * 3. 让宠物在短时间内更像“盯着某个方向行动”
 *
 * 设计原则：
 * - 不替代 DriveSystem
 * - 不替代 PetSystem
 * - 只做“注意力持续性”这一层
 * - 是行为系统和状态系统之间的一层缓冲器
 * ======================================================
 */

import type { PetAction } from "../types/pet"
import type { DriveType } from "./driveSystem"

export type AttentionFocusType =
  | "rest"
  | "food"
  | "explore"
  | "observe"
  | "approach"
  | "avoid"
  | "none"

export type AttentionState = {
  /**
   * 当前注意力焦点
   */
  focus: AttentionFocusType

  /**
   * 从哪个 tick 开始锁定
   */
  startedAtTick: number

  /**
   * 最近一次刷新 tick
   */
  lastUpdatedTick: number

  /**
   * 预计至少持续到哪个 tick
   */
  holdUntilTick: number

  /**
   * 当前锁定强度
   * 建议 0 ~ 1
   */
  strength: number
}

export type BuildAttentionContext = {
  tick: number
  currentAction: PetAction
  dominantDrive: DriveType
  energy: number
  hunger: number
  emotionalLabel?: string
  phaseTag?: string
  branchTag?: string
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function mapDriveToFocus(drive: DriveType): AttentionFocusType {
  switch (drive) {
    case "rest":
      return "rest"
    case "eat":
      return "food"
    case "explore":
      return "explore"
    case "observe":
      return "observe"
    case "approach":
      return "approach"
    case "avoid":
      return "avoid"
    default:
      return "none"
  }
}

function mapActionToFocus(action: PetAction): AttentionFocusType {
  switch (action) {
    case "sleeping":
    case "resting":
      return "rest"

    case "eating":
      return "food"

    case "exploring":
    case "walking":
      return "explore"

    case "observing":
      return "observe"

    case "approaching":
      return "approach"

    case "alert_idle":
      return "avoid"

    case "idle":
    default:
      return "none"
  }
}

function getBaseHoldDuration(
  focus: AttentionFocusType
): number {
  switch (focus) {
    case "rest":
      return 4

    case "food":
      return 3

    case "explore":
      return 3

    case "observe":
      return 3

    case "approach":
      return 2

    case "avoid":
      return 2

    case "none":
    default:
      return 1
  }
}

function getBaseStrength(
  focus: AttentionFocusType
): number {
  switch (focus) {
    case "rest":
      return 0.72

    case "food":
      return 0.78

    case "explore":
      return 0.65

    case "observe":
      return 0.62

    case "approach":
      return 0.58

    case "avoid":
      return 0.66

    case "none":
    default:
      return 0.3
  }
}

function applyContextBias(
  baseHold: number,
  baseStrength: number,
  context: BuildAttentionContext
): {
  hold: number
  strength: number
} {
  let hold = baseHold
  let strength = baseStrength

  /**
   * 低精力时，恢复相关注意力更容易持续
   */
  if (context.energy <= 30) {
    if (
      context.currentAction === "sleeping" ||
      context.currentAction === "resting"
    ) {
      hold += 2
      strength += 0.1
    }
  }

  /**
   * 高饥饿时，进食相关注意力更容易持续
   */
  if (context.hunger >= 70 && context.dominantDrive === "eat") {
    hold += 2
    strength += 0.12
  }

  /**
   * 敏感阶段 / 防御路径，更容易维持观察与警觉
   */
  if (
    context.phaseTag === "sensitive_phase" ||
    context.branchTag === "defense"
  ) {
    if (
      context.currentAction === "observing" ||
      context.currentAction === "alert_idle"
    ) {
      hold += 1
      strength += 0.08
    }
  }

  /**
   * 恢复阶段，更容易维持 resting / sleeping
   */
  if (context.phaseTag === "recovery_phase") {
    if (
      context.currentAction === "sleeping" ||
      context.currentAction === "resting"
    ) {
      hold += 2
      strength += 0.08
    }
  }

  /**
   * 情绪紧张时，更容易锁住 observe / avoid
   */
  if (
    context.emotionalLabel === "anxious" ||
    context.emotionalLabel === "irritated" ||
    context.emotionalLabel === "alert"
  ) {
    if (
      context.currentAction === "observing" ||
      context.currentAction === "alert_idle"
    ) {
      hold += 1
      strength += 0.06
    }
  }

  return {
    hold,
    strength: clamp(strength),
  }
}

export class AttentionSystem {
  private attention: AttentionState | null = null

  /**
   * ======================================================
   * 获取当前注意力状态
   * ======================================================
   */
  getAttention(): AttentionState | null {
    if (!this.attention) {
      return null
    }

    return { ...this.attention }
  }

  /**
   * ======================================================
   * 初始化 / 刷新注意力
   * ======================================================
   */
  lockAttention(context: BuildAttentionContext): AttentionState {
    const actionFocus = mapActionToFocus(context.currentAction)
    const driveFocus = mapDriveToFocus(context.dominantDrive)

    /**
     * 优先使用动作焦点；idle 时退回 drive 焦点
     */
    const nextFocus =
      actionFocus !== "none" ? actionFocus : driveFocus

    const baseHold = getBaseHoldDuration(nextFocus)
    const baseStrength = getBaseStrength(nextFocus)

    const biased = applyContextBias(baseHold, baseStrength, context)

    this.attention = {
      focus: nextFocus,
      startedAtTick: context.tick,
      lastUpdatedTick: context.tick,
      holdUntilTick: context.tick + biased.hold,
      strength: biased.strength,
    }

    return { ...this.attention }
  }

  /**
   * ======================================================
   * 判断当前注意力是否仍然有效
   * ======================================================
   */
  isAttentionActive(currentTick: number): boolean {
    if (!this.attention) {
      return false
    }

    return currentTick <= this.attention.holdUntilTick
  }

  /**
   * ======================================================
   * 根据当前 tick 做自然衰减
   * ======================================================
   */
  decayAttention(currentTick: number): AttentionState | null {
    if (!this.attention) {
      return null
    }

    const delta = currentTick - this.attention.lastUpdatedTick

    if (delta <= 0) {
      return { ...this.attention }
    }

    const nextStrength = clamp(
      this.attention.strength - delta * 0.06
    )

    this.attention = {
      ...this.attention,
      lastUpdatedTick: currentTick,
      strength: nextStrength,
    }

    if (
      currentTick > this.attention.holdUntilTick &&
      this.attention.strength <= 0.12
    ) {
      this.attention = null
      return null
    }

    return this.attention ? { ...this.attention } : null
  }

  /**
   * ======================================================
   * 根据注意力判断是否应该压住行为切换
   *
   * 返回 true：
   * - 说明当前注意力还在，应该倾向保留原行为
   *
   * 返回 false：
   * - 说明可以自由切换
   * ======================================================
   */
  shouldHoldCurrentAction(params: {
    tick: number
    currentAction: PetAction
    candidateAction: PetAction
  }): boolean {
    if (!this.attention) {
      return false
    }

    const { tick, currentAction, candidateAction } = params

    if (candidateAction === currentAction) {
      return true
    }

    /**
     * 超出最短保持期后，不再硬压
     */
    if (tick > this.attention.holdUntilTick) {
      return false
    }

    const currentFocus = mapActionToFocus(currentAction)
    const candidateFocus = mapActionToFocus(candidateAction)

    /**
     * 如果候选动作仍然属于同一注意力焦点，则允许切换
     * 例如：
     * exploring -> walking
     * resting -> sleeping
     */
    if (
      currentFocus !== "none" &&
      currentFocus === candidateFocus
    ) {
      return false
    }

    /**
     * 强度越高，越倾向压住切换
     */
    const roll = Math.random()

    return roll < this.attention.strength
  }

  /**
   * ======================================================
   * 主动打断注意力
   * ======================================================
   */
  clearAttention() {
    this.attention = null
  }
}

export const attentionSystem = new AttentionSystem()
export default attentionSystem