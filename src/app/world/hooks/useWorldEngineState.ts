"use client"

/**
 * 当前文件负责：集中管理 /world 页面所需的世界运行状态。
 */

import { useCallback, useEffect, useState } from "react"

import { worldEngine } from "@/engine/worldEngine"

import type { TimeState } from "@/engine/timeSystem"
import type { PetState } from "@/types/pet"
import type { WorldEvent } from "@/types/event"
import type { WorldStimulus } from "@/ai/gateway"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

export type WorldEngineViewState = {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  incubator: IncubatorState | null
  events: WorldEvent[]
  stimuli: WorldStimulus[]
  tick: number
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
  showDeveloperPanel: boolean
  toggleDeveloperPanel: () => void
}

function readWorldEngineState() {
  return {
    time: worldEngine.getTime(),
    pet: worldEngine.getPet(),
    butler: worldEngine.getButler(),
    incubator: worldEngine.getIncubator(),
    events: worldEngine.getEvents(),
    stimuli: worldEngine.getWorldStimuli(),
    tick: worldEngine.getTick(),
    ecology: worldEngine.getEcology(),
    worldRuntime: worldEngine.getWorldRuntime(),
  }
}

export function useWorldEngineState(): WorldEngineViewState {
  const [time, setTime] = useState<TimeState | null>(() => worldEngine.getTime())
  const [pet, setPet] = useState<PetState | null>(() => worldEngine.getPet())
  const [butler, setButler] = useState<ButlerState | null>(() =>
    worldEngine.getButler()
  )
  const [incubator, setIncubator] = useState<IncubatorState | null>(() =>
    worldEngine.getIncubator()
  )
  const [events, setEvents] = useState<WorldEvent[]>(() =>
    worldEngine.getEvents()
  )
  const [stimuli, setStimuli] = useState<WorldStimulus[]>(() =>
    worldEngine.getWorldStimuli()
  )
  const [tick, setTick] = useState<number>(() => worldEngine.getTick())
  const [ecology, setEcology] = useState<WorldEcologyState | null>(() =>
    worldEngine.getEcology()
  )
  const [worldRuntime, setWorldRuntime] =
    useState<WorldRuntimeState | null>(() => worldEngine.getWorldRuntime())
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false)

  const syncWorld = useCallback(() => {
    const nextState = readWorldEngineState()

    setTime(nextState.time)
    setPet(nextState.pet)
    setButler(nextState.butler)
    setIncubator(nextState.incubator)
    setEvents(nextState.events)
    setStimuli(nextState.stimuli)
    setTick(nextState.tick)
    setEcology(nextState.ecology)
    setWorldRuntime(nextState.worldRuntime)
  }, [])

  const toggleDeveloperPanel = useCallback(() => {
    setShowDeveloperPanel((value) => !value)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F3") {
        event.preventDefault()
        toggleDeveloperPanel()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [toggleDeveloperPanel])

  useEffect(() => {
    worldEngine.initialize()

    const interval = setInterval(() => {
        worldEngine.update()
    }, 2000)

    return () => {
        clearInterval(interval)
    }
    }, [syncWorld])

  return {
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
    toggleDeveloperPanel,
  }
}