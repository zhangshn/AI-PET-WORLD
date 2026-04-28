/**
 * 当前文件负责：集中承载 /world 开发调试面板。
 */

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"

import CognitionPanel from "../../components/CognitionPanel"
import BehaviorProcessPanel from "../../components/BehaviorProcessPanel"
import RuntimeDebugPanel from "../../components/RuntimeDebugPanel"
import WorldRuntimePanel from "../../components/WorldRuntimePanel"
import WorldEcologyPanel from "../../components/WorldEcologyPanel"
import WorldStimulusPanel from "../../components/WorldStimulusPanel"

import styles from "@/styles/world-styles/developer-dock.module.css"

type Props = {
  world: WorldEngineViewState
}

export default function DeveloperDock({ world }: Props) {
  return (
    <section className={styles.dock}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>DEVELOPER</p>
          <h2 className={styles.title}>世界调试面板</h2>
        </div>

        <p className={styles.hint}>按 F3 隐藏</p>
      </div>

      <div className={styles.grid}>
        <CognitionPanel cognition={world.pet?.latestCognition ?? null} />
        <BehaviorProcessPanel process={world.pet?.activeBehaviorProcess ?? null} />
        <WorldRuntimePanel runtime={world.worldRuntime} />
        <RuntimeDebugPanel pet={world.pet} tick={world.tick} />
        <WorldEcologyPanel ecology={world.ecology} />
        <WorldStimulusPanel stimuli={world.stimuli} />
      </div>
    </section>
  )
}