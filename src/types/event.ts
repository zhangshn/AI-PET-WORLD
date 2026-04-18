/**
 * ======================================================
 * AI-PET-WORLD
 * Event Type
 *
 * 功能：
 * 定义世界事件的数据结构
 *
 * 这一版新增了与孵化器相关的事件类型，
 * 因为现在世界开局逻辑已经从“直接有宠物”
 * 调整为“先有胚胎，再孵化出生”。
 * ======================================================
 */

/**
 * 世界事件类型
 */
export type WorldEventType =
  | "time_period_changed"
  | "pet_action_changed"
  | "pet_mood_changed"
  | "butler_task_changed"
  | "interaction_result"
  | "incubator_status_changed"
  | "pet_hatched"

/**
 * 世界事件数据结构
 */
export type WorldEvent = {
  id: string
  tick: number
  type: WorldEventType
  message: string
  day: number
  hour: number
}