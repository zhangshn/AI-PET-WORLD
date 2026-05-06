/**
 * 当前文件负责：提供管家开发调试面板的格式化工具。
 */

export function formatDebugValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `${value}`
      : value.toFixed(2)
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否"
  }

  return JSON.stringify(value)
}

export function formatGatePassed(value: boolean): string {
  return value ? "通过" : "未通过"
}