"use client"

/**
 * 当前文件负责：世界观察页入口，组织正式用户视图与开发调试视图。
 */

import WorldPixelStage from "./components/WorldPixelStage"
import WorldHUD from "./ui/WorldHUD"

import CognitionPanel from "./components/CognitionPanel"
import BehaviorProcessPanel from "./components/BehaviorProcessPanel"
import RuntimeDebugPanel from "./components/RuntimeDebugPanel"
import WorldRuntimePanel from "./components/WorldRuntimePanel"
import WorldEcologyPanel from "./components/WorldEcologyPanel"
import WorldStimulusPanel from "./components/WorldStimulusPanel"

import { useWorldEngineState } from "./hooks/useWorldEngineState"

import styles from "@/styles/world-styles/world-page.module.css"

export default function WorldPage() {
  const {
    time,
    pet,
    butler,
    incubator,
    events,
    stimuli,
    tick,
    ecology,
    worldRuntime,
    showDeveloperPanel,
  } = useWorldEngineState()

  return (
    <main className={styles.worldPage}>
      <section className={styles.worldStageShell}>
        <WorldPixelStage
          time={time}
          pet={pet}
          butler={butler}
          incubator={incubator}
          stimuli={stimuli}
          ecology={ecology}
          worldRuntime={worldRuntime}
          tick={tick}
        />

        <WorldHUD
          time={time}
          pet={pet}
          events={events}
          stimuli={stimuli}
          ecology={ecology}
        />
      </section>

      {showDeveloperPanel && (
        <section className={styles.developerDock}>
          <div className={styles.developerGrid}>
            <CognitionPanel cognition={pet?.latestCognition ?? null} />
            <BehaviorProcessPanel process={pet?.activeBehaviorProcess ?? null} />
            <WorldRuntimePanel runtime={worldRuntime} />
            <RuntimeDebugPanel pet={pet} tick={tick} />
            <WorldEcologyPanel ecology={ecology} />
            <WorldStimulusPanel stimuli={stimuli} />
          </div>
        </section>
      )}
    </main>
  )
}