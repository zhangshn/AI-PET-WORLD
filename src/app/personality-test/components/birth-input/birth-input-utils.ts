/**
 * 当前文件负责：提供出生输入栏使用的工具函数。
 */

export function parseBirthHourInput(value: string): number | null {
  const normalized = value.trim()

  if (
    !normalized ||
    normalized === "未知" ||
    normalized.toLowerCase() === "unknown"
  ) {
    return null
  }

  const numericHour = Number(normalized)

  if (Number.isInteger(numericHour) && numericHour >= 0 && numericHour <= 23) {
    return numericHour
  }

  return null
}

export function buildYearOptions(): string[] {
  return Array.from({ length: 201 }, (_, index) => {
    return String(1900 + index)
  })
}

export function buildMonthOptions(): string[] {
  return Array.from({ length: 12 }, (_, index) => {
    return String(index + 1)
  })
}

export function buildDayOptions(): string[] {
  return Array.from({ length: 31 }, (_, index) => {
    return String(index + 1)
  })
}

export function buildHourOptions(): string[] {
  return [
    "未知",
    ...Array.from({ length: 24 }, (_, index) => {
      return String(index)
    })
  ]
}