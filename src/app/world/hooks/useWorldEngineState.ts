"use client"

/**
 * 当前文件负责：集中管理 /world 页面所需的世界运行状态，并接入本地存档读取与自动保存。
 */

import { useCallback, useEffect, useRef, useState } from "react"

import { worldEngine } from "@/engine/worldEngine"

import {
  loadWorldSnapshotFromLocal,
  saveWorldSnapshotToLocal,
} from "@/world/persistence/world-save-gateway"

import {
  buildOfflineCatchupPlan,
  buildOfflineCatchupResult,
} from "@/world/offline/offline-catchup-gateway"

import type { TimeState } from "@/engine/timeSystem"
import type { PetState } from "@/types/pet"
import type { WorldEvent } from "@/types/event"
import type {
  ButlerProfile,
  WorldStimulus,
} from "@/ai/gateway"
import type { ButlerState } from "@/types/butler"
import type { HomeState } from "@/types/home"
import type { IncubatorState } from "@/types/incubator"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"
import type { WorldProgressionState } from "@/world/progression/world-progression-gateway"

export type WorldEngineViewState = {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  home: HomeState | null
  incubator: IncubatorState | null
  events: WorldEvent[]
  stimuli: WorldStimulus[]
  tick: number
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
  worldProgression: WorldProgressionState | null
  showDeveloperPanel: boolean
  toggleDeveloperPanel: () => void
  setButlerProfile: (profile: ButlerProfile | null) => void
}

function readWorldEngineState() {
  return {
    time: worldEngine.getTime(),
    pet: worldEngine.getPet(),
    butler: worldEngine.getButler(),
    home: worldEngine.getHome(),
    incubator: worldEngine.getIncubator(),
    events: worldEngine.getEvents(),
    stimuli: worldEngine.getWorldStimuli(),
    tick: worldEngine.getTick(),
    ecology: worldEngine.getEcology(),
    worldRuntime: worldEngine.getWorldRuntime(),
    worldProgression: worldEngine.getWorldProgression(),
  }
}

function saveCurrentWorldSnapshot(): void {
  const snapshot = worldEngine.createSaveSnapshot("auto_save")
  saveWorldSnapshotToLocal(snapshot)
}

function saveOfflineCatchupWorldSnapshot(): void {
  const snapshot = worldEngine.createSaveSnapshot("offline_catchup")
  saveWorldSnapshotToLocal(snapshot)
}

function runOfflineCatchupIfNeeded(lastSavedAt: number): void {
  const plan = buildOfflineCatchupPlan({
    lastSavedAt,
    now: Date.now(),
  })

  if (!plan.shouldCatchup) {
    return
  }

  const startedAtTick = worldEngine.getTick()

  for (let index = 0; index < plan.tickCount; index += 1) {
    worldEngine.update()
  }

  const result = buildOfflineCatchupResult({
    plan,
    startedAtTick,
    endedAtTick: worldEngine.getTick(),
  })

  worldEngine.addOfflineCatchupReport(result)

  console.info("🌙 离线补算完成：", result)

  saveOfflineCatchupWorldSnapshot()
}

export function useWorldEngineState(): WorldEngineViewState {
  const didBootRef = useRef(false)

  const [time, setTime] = useState<TimeState | null>(() => worldEngine.getTime())
  const [pet, setPet] = useState<PetState | null>(() => worldEngine.getPet())
  const [butler, setButler] = useState<ButlerState | null>(() =>
    worldEngine.getButler()
  )
  const [home, setHome] = useState<HomeState | null>(() =>
    worldEngine.getHome()
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
  const [worldProgression, setWorldProgression] =
    useState<WorldProgressionState | null>(() =>
      worldEngine.getWorldProgression()
    )
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false)

  const syncWorld = useCallback(() => {
    const nextState = readWorldEngineState()

    setTime(nextState.time)
    setPet(nextState.pet)
    setButler(nextState.butler)
    setHome(nextState.home)
    setIncubator(nextState.incubator)
    setEvents(nextState.events)
    setStimuli(nextState.stimuli)
    setTick(nextState.tick)
    setEcology(nextState.ecology)
    setWorldRuntime(nextState.worldRuntime)
    setWorldProgression(nextState.worldProgression)
  }, [])

  const toggleDeveloperPanel = useCallback(() => {
    setShowDeveloperPanel((value) => !value)
  }, [])

  const setButlerProfile = useCallback(
    (profile: ButlerProfile | null) => {
      worldEngine.setButlerProfile(profile)
      saveCurrentWorldSnapshot()
      syncWorld()
    },
    [syncWorld]
  )

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
    if (didBootRef.current) {
      return
    }

    didBootRef.current = true

    const savedSnapshot = loadWorldSnapshotFromLocal()

     if (savedSnapshot) {
      worldEngine.restoreFromSnapshot(savedSnapshot)
      runOfflineCatchupIfNeeded(savedSnapshot.savedAt)
    } else {
      worldEngine.initialize()
      saveCurrentWorldSnapshot()
    }

    syncWorld()

    const interval = setInterval(() => {
      worldEngine.update()
      saveCurrentWorldSnapshot()
      syncWorld()
    }, 2000)

    const handleBeforeUnload = () => {
      saveCurrentWorldSnapshot()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveCurrentWorldSnapshot()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      saveCurrentWorldSnapshot()
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [syncWorld])

  return {
    time,
    pet,
    butler,
    home,
    incubator,
    events,
    stimuli,
    tick,
    ecology,
    worldRuntime,
    worldProgression,
    showDeveloperPanel,
    toggleDeveloperPanel,
    setButlerProfile,
  }
}