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
  const total = Object.values(input).reduce((sum, value) => {
    return sum + Number(value)
  }, 0)

  const result = {} as Record<T, number>

  Object.entries(input).forEach(([key, value]) => {
    result[key as T] = total > 0 ? round((Number(value) / total) * 100, 2) : 0
  })

  return result
}

export function getTopKeys<T extends string>(
  input: Record<T, number>,
  count = 2
): T[] {
  return Object.entries(input)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, count)
    .map(([key]) => key as T)
}

export function getBottomKeys<T extends string>(
  input: Record<T, number>,
  count = 2
): T[] {
  return Object.entries(input)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, count)
    .map(([key]) => key as T)
}