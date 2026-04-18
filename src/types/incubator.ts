/**
 * ======================================================
 * AI-PET-WORLD
 * Incubator Type
 *
 * 功能：
 * 定义孵化器与胚胎的数据结构
 *
 * 正确业务逻辑：
 * - 胚胎阶段没有人格
 * - 孵化器只负责胚胎的孵化过程
 * - 人格只会在出生那一刻产生
 *
 * 所以当前孵化器状态只保留：
 * - 是否有胚胎
 * - 胚胎名字
 * - 孵化进度
 * - 稳定度
 * - 孵化状态
 * ======================================================
 */

/**
 * 胚胎当前状态
 *
 * - incubating：正在孵化中
 * - ready_to_hatch：已达到可孵化状态
 * - hatched：已完成孵化
 */
export type EmbryoStatus =
  | "incubating"
  | "ready_to_hatch"
  | "hatched"

/**
 * 孵化器状态结构
 */
export type IncubatorState = {
  hasEmbryo: boolean
  embryoName: string
  progress: number
  stability: number
  status: EmbryoStatus
}