/**
 * ======================================================
 * AI-PET-WORLD
 * Butler Type
 *
 * 功能：
 * 定义 AI 管家的数据结构
 *
 * 当前版本：
 * - name      管家名字
 * - task      当前任务
 * - mood      管家心情
 *
 * 后续会继续扩展：
 * - personality   紫微斗数人格
 * - efficiency    效率
 * - loyalty       忠诚度
 * - memory        记忆系统
 * ======================================================
 */

/**
 * 管家当前任务
 */
export type ButlerTask =
  | "idle"
  | "feeding_pet"
  | "watching_pet"
  | "building_home"

/**
 * 管家当前心情
 */
export type ButlerMood =
  | "calm"
  | "busy"
  | "worried"

/**
 * 管家状态结构
 */
export type ButlerState = {
  name: string
  task: ButlerTask
  mood: ButlerMood
}