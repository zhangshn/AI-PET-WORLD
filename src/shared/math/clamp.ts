/**
 * ======================================================
 * AI-PET-WORLD
 * Shared Clamp Utilities
 * ======================================================
 *
 * 当前文件负责：
 * 1. 世界统一数值边界限制
 * 2. 防止状态值越界
 * 3. 提供世界统一数学工具
 *
 * 说明：
 * - 世界中的大量状态都需要数值限制
 * - 包括：
 *   hunger
 *   energy
 *   emotion
 *   relationship
 *   trust
 *   memory bias
 *   drive intensity
 * 等
 * ======================================================
 */

/**
 * 通用 clamp
 */
export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 世界默认 0~100 边界
 */
export function clampZeroToHundred(
  value: number
): number {
  return clamp(value, 0, 100)
}