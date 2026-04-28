/**
 * 当前文件负责：展示正式用户可理解的世界顶部状态栏。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import styles from "@/styles/world-styles/world-info-bar.module.css"

type Props = {
  time: TimeState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
}

function formatHour(hour?: number): string {
  if (typeof hour !== "number") {
    return "--:00"
  }

  return `${hour.toString().padStart(2, "0")}:00`
}

function getPeriodLabel(period?: string): string {
  if (period === "Morning") return "清晨"
  if (period === "Daytime") return "白昼"
  if (period === "Evening") return "黄昏"
  if (period === "Night") return "夜晚"

  return "流动中"
}

function getWeatherLabel(weather?: string): string {
  if (!weather) return "晴朗"

  const normalized = weather.toLowerCase()

  if (normalized.includes("rain")) return "有雨"
  if (normalized.includes("storm")) return "风暴"
  if (normalized.includes("cloud")) return "多云"
  if (normalized.includes("fog")) return "薄雾"
  if (normalized.includes("snow")) return "降雪"
  if (normalized.includes("wind")) return "有风"
  if (normalized.includes("clear")) return "晴朗"

  return weather
}

function getWorldPulse(stimuliCount: number): string {
  if (stimuliCount >= 6) return "活跃"
  if (stimuliCount >= 3) return "有动静"
  if (stimuliCount >= 1) return "轻微波动"

  return "安静"
}

export default function WorldInfoBar({ time, stimuli, ecology }: Props) {
  const stimuliCount = stimuli.length

  return (
    <section className={styles.bar}>
      <div className={styles.group}>
        <span className={styles.label}>世界日</span>
        <strong>Day {time?.day ?? "-"}</strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>时间</span>
        <strong>{formatHour(time?.hour)}</strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>时段</span>
        <strong>{getPeriodLabel(time?.period)}</strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>天气</span>
        <strong>{getWeatherLabel(ecology?.environment.activeWeather)}</strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>温度</span>
        <strong>{ecology?.environment.temperature ?? "--"}°</strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>世界动静</span>
        <strong>{getWorldPulse(stimuliCount)}</strong>
      </div>
    </section>
  )
}