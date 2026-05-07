"use client"

/**
 * 当前文件负责：组织 /world 桌面游戏主界面布局。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"
import type { WorldStageSceneMode } from "../components/stage-renderers/orchestrator/stage-scene-mode"

import { buildWorldHudBundle } from "../utils/worldHudMappers"

import WorldPixelStage from "../components/WorldPixelStage"
import DeveloperDock from "../ui/panels/DeveloperDock"
import WorldMiniMap from "../ui/minimap/WorldMiniMap"
import PPhoneLauncher from "../ui/phone/PPhoneLauncher"
import PPhoneShell from "../ui/phone/PPhoneShell"

import styles from "@/styles/world-styles/layout/world-observe-layout.module.css"

type Props = {
  world: WorldEngineViewState
}

export default function WorldObserveLayout({ world }: Props) {
  const [sceneMode, setSceneMode] = useState<WorldStageSceneMode>("exterior")
  const [isPPhoneOpen, setIsPPhoneOpen] = useState(false)

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
      <section className={styles.gameShell}>
        <div className={styles.stageLayer}>
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
        </div>

        <div className={styles.vignetteLayer} />

        <div className={styles.topHint}>
          <span>AI-PET-WORLD Desktop MVP</span>
          <strong>F3 开发审计</strong>
        </div>

        <WorldMiniMap world={world} hud={hud} />

        {isPPhoneOpen && (
          <PPhoneShell
            world={world}
            hud={hud}
            onClose={() => setIsPPhoneOpen(false)}
          />
        )}

        <PPhoneLauncher
          isOpen={isPPhoneOpen}
          unreadCount={world.events.length}
          onToggle={() => setIsPPhoneOpen((value) => !value)}
        />
      </section>

      {world.showDeveloperPanel && <DeveloperDock world={world} />}
    </main>
  )
}