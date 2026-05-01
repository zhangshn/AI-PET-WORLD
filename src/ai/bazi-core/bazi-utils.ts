/**
 * 当前文件负责：提供八字动力系统通用工具函数。
 */

export function safeModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function round(value: number, digits = 2): number {
  const base = 10 ** digits
  return Math.round(value * base) / base
}

export function normalizeRecordToPercent<T extends string>(
  input: Record<T, number>
): Record<T, number> {
  const entries = Object.entries(input) as Array<[T, number]>

  const total = entries.reduce((sum, [, value]) => {
    return sum + value
  }, 0)

  const result = {} as Record<T, number>

  entries.forEach(([key, value]) => {
    result[key] = total > 0 ? round((value / total) * 100, 2) : 0
  })

  return result
}

export function getTopKeys<T extends string>(
  input: Record<T, number>,
  count = 2
): T[] {
  const entries = Object.entries(input) as Array<[T, number]>

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => key)
}

export function getBottomKeys<T extends string>(
  input: Record<T, number>,
  count = 2
): T[] {
  const entries = Object.entries(input) as Array<[T, number]>

  return entries
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([key]) => key)
}