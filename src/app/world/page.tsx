"use client"

/**
 * 当前文件负责：世界观察页入口，组织正式用户视图与开发调试视图。
 */

import { useEffect, useState } from "react"

import { worldEngine } from "@/engine/worldEngine"

import type { TimeState } from "@/engine/timeSystem"
import type { PetState } from "@/types/pet"
import type { WorldEvent } from "@/types/event"
import type { WorldStimulus } from "@/ai/gateway"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import WorldPixelStage from "./components/WorldPixelStage"
import WorldHUD from "./ui/WorldHUD"

import CognitionPanel from "./components/CognitionPanel"
import BehaviorProcessPanel from "./components/BehaviorProcessPanel"
import RuntimeDebugPanel from "./components/RuntimeDebugPanel"
import WorldRuntimePanel from "./components/WorldRuntimePanel"
import WorldEcologyPanel from "./components/WorldEcologyPanel"
import WorldStimulusPanel from "./components/WorldStimulusPanel"

import styles from "@/styles/world-styles/world-page.module.css"

export default function WorldPage() {
  const [time, setTime] = useState<TimeState | null>(() => worldEngine.getTime())
  const [pet, setPet] = useState<PetState | null>(() => worldEngine.getPet())
  const [butler, setButler] = useState<ButlerState | null>(() =>
    worldEngine.getButler()
  )
  const [incubator, setIncubator] = useState<IncubatorState | null>(() =>
    worldEngine.getIncubator()
  )
  const [events, setEvents] = useState<WorldEvent[]>(() => worldEngine.getEvents())
  const [stimuli, setStimuli] = useState<WorldStimulus[]>(() =>
    worldEngine.getWorldStimuli()
  )
  const [tick, setTick] = useState<number>(() => worldEngine.getTick())
  const [ecology, setEcology] = useState<WorldEcologyState | null>(() =>
    worldEngine.getEcology()
  )
  const [worldRuntime, setWorldRuntime] = useState<WorldRuntimeState | null>(() =>
    worldEngine.getWorldRuntime()
  )
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false)

  useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "F3") {
      event.preventDefault()

      setShowDeveloperPanel((value) => !value)
    }
  }

  window.addEventListener("keydown", handleKeyDown)

  return () => {
    window.removeEventListener("keydown", handleKeyDown)
  }
}, [])

  const syncWorld = () => {
    setTime(worldEngine.getTime())
    setPet(worldEngine.getPet())
    setButler(worldEngine.getButler())
    setIncubator(worldEngine.getIncubator())
    setEvents(worldEngine.getEvents())
    setStimuli(worldEngine.getWorldStimuli())
    setTick(worldEngine.getTick())
    setEcology(worldEngine.getEcology())
    setWorldRuntime(worldEngine.getWorldRuntime())
  }

  useEffect(() => {
    worldEngine.initialize()

    const interval = setInterval(() => {
      worldEngine.update()
      syncWorld()
    }, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [])

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