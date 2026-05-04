/**
 * 当前文件负责：展示正式用户可理解的世界顶部运行摘要。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import {
  buildWorldRunSummary,
  formatWorldHour,
  getWorldPeriodLabel,
  getWorldPulseLabel,
  getWorldPulseTone,
  getWorldTemperatureLabel,
  getWorldWeatherLabel,
} from "../utils/worldInfoMappers"

import WorldStatusPill from "./common/WorldStatusPill"

import styles from "@/styles/world-styles/world-info-bar.module.css"

type Props = {
  time: TimeState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
}

export default function WorldInfoBar({ time, stimuli, ecology }: Props) {
  const stimuliCount = stimuli.length
  const weatherLabel = getWorldWeatherLabel(ecology?.environment.activeWeather)

  return (
    <section className={styles.wrapper}>
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>当前运行摘要</span>

        <p className={styles.summaryText}>
          {buildWorldRunSummary({
            time,
            stimuliCount,
            weatherLabel,
          })}
        </p>
      </div>

      <div className={styles.bar}>
        <WorldStatusPill
          label="世界日"
          value={`Day ${time?.day ?? "-"}`}
          tone="warm"
        />

        <WorldStatusPill
          label="时间"
          value={formatWorldHour(time?.hour)}
          tone="blue"
        />

        <WorldStatusPill
          label="时段"
          value={getWorldPeriodLabel(time?.period)}
          tone="amber"
        />

        <WorldStatusPill
          label="天气"
          value={weatherLabel}
          tone="green"
        />

        <WorldStatusPill
          label="温度"
          value={getWorldTemperatureLabel(ecology)}
          tone="warm"
        />

        <WorldStatusPill
          label="世界动静"
          value={getWorldPulseLabel(stimuliCount)}
          tone={getWorldPulseTone(stimuliCount)}
        />
      </div>
    </section>
  )
}