/**
 * ======================================================
 * AI-PET-WORLD
 * Home Type
 *
 * 功能：
 * 定义家园的数据结构
 *
 * 当前版本：
 * - level        家园等级
 * - progress     当前建造进度
 * - status       当前状态
 * ======================================================
 */

export type HomeStatus =
  | "not_started"
  | "building"
  | "completed"

export type HomeState = {
  level: number
  progress: number
  status: HomeStatus
}