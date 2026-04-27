/**
 * 当前文件负责：
 * 1. 世界 HUD 外层布局
 * 2. 聚合正式用户 UI
 * 3. 隐藏工程调试气息
 */

import type { PetState } from "@/types/pet"
import type { WorldEvent } from "@/types/event"
import type { TimeState } from "@/engine/timeSystem"
import type { WorldStimulus } from "@/ai/gateway"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"

import WorldInfoBar from "./WorldInfoBar"
import PetInsightCard from "./PetInsightCard"
import WorldObservationPanel from "./WorldObservationPanel"

import styles from "@/styles/world-styles/world-hud.module.css"

type Props = {
  time: TimeState | null
  pet: PetState | null
  events: WorldEvent[]
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
}

export default function WorldHUD({
  time,
  pet,
  events,
  stimuli,
  ecology,
}: Props) {
  return (
    <>
      <div className={styles.topHud}>
        <WorldInfoBar
          time={time}
          ecology={ecology}
          stimuli={stimuli}
        />
      </div>

      <div className={styles.rightHud}>
        <WorldObservationPanel events={events} />
      </div>

      <div className={styles.bottomHud}>
        <PetInsightCard pet={pet} />
      </div>
    </>
  )
}