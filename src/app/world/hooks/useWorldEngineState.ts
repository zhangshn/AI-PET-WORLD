"use client"

/**
 * 当前文件负责：集中管理 /world 页面运行状态与本地存档。
 */

import { useCallback, useEffect, useRef, useState } from "react"

import {
  worldEngine,
} from "@/engine/worldEngine"
import {
  loadWorldSnapshot,
  saveWorldSnapshot,
} from "@/world/persistence/world-save-gateway"
import {
  runOfflineCatchup,
} from "@/world/offline/offline-catchup-gateway"
import {
  buildMvpWorldCheckReport,
  type MvpCheckReport,
} from "@/world/mvp-check/mvp-check-gateway"

import type {
  TimeState,
} from "@/engine/timeSystem"
import type {
  ButlerProfile,
  WorldStimulus,
} from "@/ai/gateway"
import type {
  ButlerState,
} from "@/types/butler"
import type {
  WorldEvent,
} from "@/types/event"
import type {
  HomeState,
} from "@/types/home"
import type {
  IncubatorState,
} from "@/types/incubator"
import type {
  PetState,
} from "@/types/pet"
import type {
  WorldEcologyState,
} from "@/world/ecology/ecology-engine"
import type {
  WorldProgressionState,
} from "@/world/progression/world-progression-gateway"
import type {
  WorldRuntimeState,
} from "@/world/runtime/world-runtime"
import type {
  AdoptionState,
} from "@/world/adoption/adoption-center-gateway"

const AUTO_SAVE_INTERVAL_MS = 4000

export type WorldEngineViewState = {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  home: HomeState | null
  incubator: IncubatorState | null
  adoptionState: AdoptionState
  events: WorldEvent[]
  stimuli: WorldStimulus[]
  tick: number
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
  worldProgression: WorldProgressionState | null
  mvpCheckReport: MvpCheckReport
  showDeveloperPanel: boolean
  toggleDeveloperPanel: () => void
  setButlerProfile: (profile: ButlerProfile | null) => void
}

function readWorldEngineState() {
  const state = {
    time: worldEngine.getTime(),
    pet: worldEngine.getPet(),
    butler: worldEngine.getButler(),
    home: worldEngine.getHome(),
    incubator: worldEngine.getIncubator(),
    adoptionState: worldEngine.getAdoptionState(),
    events: worldEngine.getEvents(),
    stimuli: worldEngine.getWorldStimuli(),
    tick: worldEngine.getTick(),
    ecology: worldEngine.getEcology(),
    worldRuntime: worldEngine.getWorldRuntime(),
    worldProgression: worldEngine.getWorldProgression(),
  }

  return {
    ...state,
    mvpCheckReport: buildMvpWorldCheckReport(state),
  }
}

function saveCurrentWorldSnapshot(): void {
  saveWorldSnapshot(worldEngine.createSaveSnapshot("auto_save"))
}

export function useWorldEngineState(): WorldEngineViewState {
  const didBootRef = useRef(false)
  const lastAutoSaveAtRef = useRef(0)

  const [time, setTime] = useState<TimeState | null>(() =>
    worldEngine.getTime()
  )
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
  const [adoptionState, setAdoptionState] = useState<AdoptionState>(() =>
    worldEngine.getAdoptionState()
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
  const [mvpCheckReport, setMvpCheckReport] = useState<MvpCheckReport>(() =>
    readWorldEngineState().mvpCheckReport
  )
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false)

  const syncWorld = useCallback(() => {
    const nextState = readWorldEngineState()

    setTime(nextState.time)
    setPet(nextState.pet)
    setButler(nextState.butler)
    setHome(nextState.home)
    setIncubator(nextState.incubator)
    setAdoptionState(nextState.adoptionState)
    setEvents(nextState.events)
    setStimuli(nextState.stimuli)
    setTick(nextState.tick)
    setEcology(nextState.ecology)
    setWorldRuntime(nextState.worldRuntime)
    setWorldProgression(nextState.worldProgression)
    setMvpCheckReport(nextState.mvpCheckReport)
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
    if (didBootRef.current) return

    didBootRef.current = true

    const savedSnapshot = loadWorldSnapshot()

    if (savedSnapshot) {
      const catchupResult = runOfflineCatchup({
        worldEngine,
        snapshot: savedSnapshot,
        now: Date.now(),
      })

      if (catchupResult.appliedTickCount > 0) {
        saveCurrentWorldSnapshot()
        lastAutoSaveAtRef.current = Date.now()
      }
    } else {
      worldEngine.initialize()
      saveCurrentWorldSnapshot()
      lastAutoSaveAtRef.current = Date.now()
    }

    syncWorld()

    const interval = setInterval(() => {
      worldEngine.update()

      const now = Date.now()

      if (now - lastAutoSaveAtRef.current >= AUTO_SAVE_INTERVAL_MS) {
        saveCurrentWorldSnapshot()
        lastAutoSaveAtRef.current = now
      }

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
    adoptionState,
    events,
    stimuli,
    tick,
    ecology,
    worldRuntime,
    worldProgression,
    mvpCheckReport,
    showDeveloperPanel,
    toggleDeveloperPanel,
    setButlerProfile,
  }
}
