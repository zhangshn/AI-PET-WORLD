/**
 * ======================================================
 * AI-PET-WORLD
 * Event Type
 * ======================================================
 *
 * 当前文件负责：定义世界事件的统一数据结构
 *
 * 说明：
 * - worldEngine.ts 会把事件系统结果同步给页面
 * - eventSystem.ts 会不断往内部事件列表 push 事件
 * - UI 页面会读取并展示事件
 *
 * 所以 WorldEvent 结构必须稳定、统一、可扩展。
 * ======================================================
 */

/**
 * ======================================================
 * 世界事件类型
 * ======================================================
 */
export type WorldEventType =
  | "interaction"
  | "pet_hatched"
  | "pet_action_changed"
  | "pet_action_narrative"
  | "pet_action_end"
  | "pet_mood_changed"
  | "pet_fortune_phase_changed"
  | "pet_trajectory_branch_changed"
  | "time_period_changed"
  | "incubator_progress_changed"

/**
 * ======================================================
 * 行为叙事类型
 * ======================================================
 */
export type NarrativeType =
  | "observe_environment"
  | "discover"
  | "approach_target"
  | "keep_distance"
  | "satisfy_need"
  | "recover"
  | "linger"
  | "unknown"

/**
 * ======================================================
 * 世界事件统一结构
 * ======================================================
 */
export interface WorldEvent {
  /**
   * 事件唯一标识
   */
  id: string

  /**
   * 世界 tick
   */
  tick: number

  /**
   * 世界第几天
   */
  day: number

  /**
   * 当前小时
   */
  hour: number

  /**
   * 事件类型
   */
  type: WorldEventType

  /**
   * 宠物名称（如果有）
   */
  petName?: string

  /**
   * 展示文本
   */
  message: string

  /**
   * 行为来源（可选）
   * 例：
   * - walking
   * - exploring
   * - eating
   */
  sourceAction?: string

  /**
   * 叙事语义类型
   */
  narrativeType?: NarrativeType

  /**
   * 连续行为链 ID
   */
  continuityId?: string

  /**
   * 事件强度（0 ~ 1）
   */
  intensity?: number

  /**
   * 扩展上下文
   *
   * 说明：
   * - continuityStep 等非核心字段继续放这里
   * - 用于调试 / 兼容 / 临时扩展
   */
  payload?: Record<string, unknown>
}