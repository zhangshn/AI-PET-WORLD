/**
 * 当前文件负责：
 * 1. 世界顶部状态栏
 * 2. 展示天气、时间、生态状态
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

export default function WorldInfoBar({
  time,
  stimuli,
  ecology,
}: Props) {
  return (
    <section className={styles.bar}>
      <div className={styles.group}>
        <span className={styles.label}>DAY</span>

        <strong>
          {time?.day ?? "-"}
        </strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>TIME</span>

        <strong>
          {time?.hour ?? "--"}:00
        </strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>WEATHER</span>

        <strong>
          {ecology?.environment.activeWeather ?? "clear"}
        </strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>TEMP</span>

        <strong>
          {ecology?.environment.temperature ?? "--"}°
        </strong>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>STIMULI</span>

        <strong>
          {stimuli.length}
        </strong>
      </div>
    </section>
  )
}