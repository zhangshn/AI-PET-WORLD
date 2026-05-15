"use client"

/**
 * 当前文件负责：承载 /world 新版地图舞台，旧 UI 面板已下线。
 */

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"

import WorldPixelStage from "../components/WorldPixelStage"

import styles from "@/styles/world-styles/layout/world-observe-layout.module.css"

type Props = {
  world: WorldEngineViewState
}

export default function WorldObserveLayout({ world }: Props) {
  return (
    <main className={styles.page}>
      <section className={styles.gameShell}>
        <div className={styles.stageLayer}>
          <WorldPixelStage
            time={world.time}
            pet={world.pet}
            butler={world.butler}
            home={world.home}
            incubator={world.incubator}
            stimuli={world.stimuli}
            ecology={world.ecology}
            worldRuntime={world.worldRuntime}
            tick={world.tick}
            sceneMode="exterior"
          />
        </div>
      </section>
    </main>
  )
}
