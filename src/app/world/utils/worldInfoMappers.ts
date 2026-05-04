/**
 * 当前文件负责：转换世界顶部运行摘要展示文案。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

export function formatWorldHour(hour?: number): string {
  if (typeof hour !== "number") {
    return "--:00"
  }

  return `${hour.toString().padStart(2, "0")}:00`
}

export function getWorldPeriodLabel(period?: string): string {
  if (period === "Morning") return "清晨"
  if (period === "Daytime") return "白昼"
  if (period === "Evening") return "黄昏"
  if (period === "Night") return "夜晚"

  return "流动中"
}

export function getWorldWeatherLabel(weather?: string): string {
  if (!weather) return "晴朗"

  const normalized = weather.toLowerCase()

  if (normalized === "warm_morning") return "晴暖"
  if (normalized === "cool_morning") return "清凉"
  if (normalized === "warm_day") return "温暖"
  if (normalized === "hot_day") return "炎热"
  if (normalized === "cool_evening") return "微凉"
  if (normalized === "quiet_night") return "静夜"

  if (normalized.includes("rain")) return "有雨"
  if (normalized.includes("storm")) return "风暴"
  if (normalized.includes("cloud")) return "多云"
  if (normalized.includes("fog")) return "薄雾"
  if (normalized.includes("snow")) return "降雪"
  if (normalized.includes("wind")) return "有风"
  if (normalized.includes("clear")) return "晴朗"
  if (normalized.includes("warm")) return "温暖"
  if (normalized.includes("cool")) return "清凉"
  if (normalized.includes("hot")) return "炎热"
  if (normalized.includes("quiet")) return "安静"

  return "变化中"
}

export function getWorldTemperatureLabel(
  ecology: WorldEcologyState | null
): string {
  return `${ecology?.environment.temperature ?? "--"}°`
}

export function getWorldPulseLabel(stimuliCount: number): string {
  if (stimuliCount >= 8) return "很活跃"
  if (stimuliCount >= 5) return "活跃"
  if (stimuliCount >= 2) return "有动静"
  if (stimuliCount >= 1) return "轻微波动"

  return "安静"
}

export function getWorldPulseTone(stimuliCount: number): "amber" | "muted" {
  return stimuliCount >= 5 ? "amber" : "muted"
}

function getWorldPulseSummary(stimuliCount: number): string {
  if (stimuliCount >= 8) {
    return "世界里的刺激非常密集，生命体更容易被环境牵引。"
  }

  if (stimuliCount >= 5) {
    return "世界正在活跃运行，环境变化可能影响宠物接下来的行为。"
  }

  if (stimuliCount >= 2) {
    return "世界有一些可感知变化，宠物可能会观察或调整行动。"
  }

  if (stimuliCount >= 1) {
    return "世界只有轻微波动，生命体仍会根据自身状态做出选择。"
  }

  return "世界暂时很安静，生命体会更多受自身状态和基础需求影响。"
}

function getWorldPeriodSummary(period?: string): string {
  if (period === "Morning") {
    return "清晨的节奏更适合苏醒、观察和轻微探索。"
  }

  if (period === "Daytime") {
    return "白昼让环境刺激更清晰，活动和建设更容易展开。"
  }

  if (period === "Evening") {
    return "黄昏会让世界节奏放慢，生命体更容易转向整理和恢复。"
  }

  if (period === "Night") {
    return "夜晚降低外部刺激，休息、安全感和低强度行为会变得更重要。"
  }

  return "世界时间正在流动，状态会随环境继续变化。"
}

export function buildWorldRunSummary(input: {
  time: TimeState | null
  stimuliCount: number
  weatherLabel: string
}): string {
  const periodLabel = getWorldPeriodLabel(input.time?.period)
  const periodSummary = getWorldPeriodSummary(input.time?.period)
  const pulseSummary = getWorldPulseSummary(input.stimuliCount)

  return `${periodLabel} · ${input.weatherLabel}。${periodSummary}${pulseSummary}`
}