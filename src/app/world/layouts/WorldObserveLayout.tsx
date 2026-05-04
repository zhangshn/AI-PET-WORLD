"use client"

/**
 * 当前文件负责：组织 /world 正式观察页的整体产品布局。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"
import type { WorldStageSceneMode } from "../components/stage-renderers/orchestrator/stage-scene-mode"

import { buildWorldHudBundle } from "../utils/worldHudMappers"

import WorldInfoBar from "../ui/WorldInfoBar"
import WorldCompactHud from "../ui/WorldCompactHud"
import PetInsightCard from "../ui/PetInsightCard"
import ButlerInsightCard from "../ui/ButlerInsightCard"
import HomeInsightCard from "../ui/HomeInsightCard"
import WorldObservationPanel from "../ui/WorldObservationPanel"
import WorldPixelStage from "../components/WorldPixelStage"

import WorldStagePanel from "../ui/panels/WorldStagePanel"
import WorldSidePanel from "../ui/panels/WorldSidePanel"
import WorldBottomPanel from "../ui/panels/WorldBottomPanel"
import DeveloperDock from "../ui/panels/DeveloperDock"

import styles from "@/styles/world-styles/layout/world-observe-layout.module.css"

type Props = {
  world: WorldEngineViewState
}

export default function WorldObserveLayout({ world }: Props) {
  const [sceneMode, setSceneMode] = useState<WorldStageSceneMode>("exterior")

  const hud = useMemo(() => {
    return buildWorldHudBundle({
      time: world.time,
      pet: world.pet,
      butler: world.butler,
      home: world.home,
      stimuli: world.stimuli,
      ecology: world.ecology,
    })
  }, [
    world.time,
    world.pet,
    world.butler,
    world.home,
    world.stimuli,
    world.ecology,
  ])

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>AI-PET-WORLD ALPHA</p>
            <h1 className={styles.title}>生命观察舱</h1>
          </div>

          <WorldInfoBar
            time={world.time}
            stimuli={world.stimuli}
            ecology={world.ecology}
          />
        </header>

        <section className={styles.contentGrid}>
          <WorldStagePanel overlay={<WorldCompactHud hud={hud} />}>
            <WorldPixelStage
              time={world.time}
              pet={world.pet}
              butler={world.butler}
              incubator={world.incubator}
              stimuli={world.stimuli}
              ecology={world.ecology}
              worldRuntime={world.worldRuntime}
              tick={world.tick}
              sceneMode={sceneMode}
              onEnterShelter={() => setSceneMode("shelterInterior")}
              onExitShelter={() => setSceneMode("exterior")}
            />
          </WorldStagePanel>

          <WorldSidePanel>
            <WorldObservationPanel events={world.events} />
          </WorldSidePanel>
        </section>

        <WorldBottomPanel>
          <PetInsightCard pet={world.pet} />
          <ButlerInsightCard butler={world.butler} />
          <HomeInsightCard home={world.home} />
        </WorldBottomPanel>
      </section>

      {world.showDeveloperPanel && <DeveloperDock world={world} />}
    </main>
  )
}