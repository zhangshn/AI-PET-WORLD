/**
 * 当前文件负责：提供家园系统通用数值工具。
 */

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}