"use client"

// 该文件用于提供 /world-debug 开发验证入口。

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { WorldLogicDashboard } from "@/app/world-debug/components/logic-visualization/WorldLogicDashboard"
import type { ConstructionPlan } from "@/world/construction/construction-schema"
import {
  advanceMvpConstruction,
  advanceMvpConstructionByWorldTick,
  createMvpQuietLivingConstructionPlan,
} from "@/world/construction/construction-gateway"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import {
  clearHomeMapLocalSnapshot,
  HOME_MAP_LOCAL_STORAGE_VERSION,
  loadHomeMapLocalSnapshot,
  saveHomeMapLocalSnapshot,
} from "@/world/map-state/home-map-local-persistence"
import { buildWorldVisualizationModel } from "@/world/visualization/build-world-visualization-model"

const WORLD_ID = "mvp-visible-world"
const OWNER_ID = "local-player"
const DEFAULT_CONSTRUCTION_MESSAGE = "管家建设尚未开始。"
const DEBUG_TICK_INTERVAL_MS = 2000

const DEFAULT_CONSTRUCTION_STYLE = {
  structuredBuilder: 0.56,
  warmCaretaker: 0.72,
  protectiveKeeper: 0.42,
  aestheticOrganizer: 0.38,
  quietMaintainer: 0.48,
  adaptivePlanner: 0.52,
}

export default function WorldDebugRoutePage() {
  const [debugTick, setDebugTick] = useState(0)
  const lastAutoConstructionTickRef = useRef<number | null>(debugTick)
  const hydrationStartTickRef = useRef(debugTick)

  const initialHomeMapState = useMemo(
    () =>
      generateInitialHomeMap({
        worldId: WORLD_ID,
        ownerId: OWNER_ID,
        birthSignature: "mvp-v1-2-visible-world",
        worldSalt: "initial-home",
        butlerConstructionStyle: DEFAULT_CONSTRUCTION_STYLE,
        now: 0,
      }),
    []
  )
  const [currentHomeMapState, setCurrentHomeMapState] = useState(
    initialHomeMapState
  )
  const [currentConstructionPlan, setCurrentConstructionPlan] =
    useState<ConstructionPlan | null>(null)
  const [constructionMessage, setConstructionMessage] = useState(
    DEFAULT_CONSTRUCTION_MESSAGE
  )
  const [lastAutoConstructionTick, setLastAutoConstructionTick] = useState<
    number | null
  >(null)
  const [localSnapshotLoaded, setLocalSnapshotLoaded] = useState(false)

  const visualizationModel = useMemo(
    () =>
      buildWorldVisualizationModel({
        homeMapState: currentHomeMapState,
        constructionPlan: currentConstructionPlan,
        constructionMessage,
        worldTick: debugTick,
        lastAutoConstructionTick,
        localSnapshotLoaded,
      }),
    [
      constructionMessage,
      currentConstructionPlan,
      currentHomeMapState,
      debugTick,
      lastAutoConstructionTick,
      localSnapshotLoaded,
    ]
  )

  const handleAdvanceConstruction = useCallback(() => {
    const plan =
      currentConstructionPlan ??
      createMvpQuietLivingConstructionPlan(currentHomeMapState)
    const result = advanceMvpConstruction(
      currentHomeMapState,
      plan,
      Date.now()
    )

    setCurrentHomeMapState(result.homeMapState)
    setCurrentConstructionPlan(result.plan)
    setConstructionMessage(result.messages.join(" "))
  }, [currentConstructionPlan, currentHomeMapState])

  const handleResetLocalHomeMap = useCallback(() => {
    clearHomeMapLocalSnapshot({
      worldId: WORLD_ID,
      ownerId: OWNER_ID,
    })
    lastAutoConstructionTickRef.current = debugTick
    setCurrentHomeMapState(initialHomeMapState)
    setCurrentConstructionPlan(null)
    setConstructionMessage(DEFAULT_CONSTRUCTION_MESSAGE)
    setLastAutoConstructionTick(null)
  }, [debugTick, initialHomeMapState])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDebugTick((tick) => tick + 1)
    }, DEBUG_TICK_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const snapshot = loadHomeMapLocalSnapshot({
      worldId: WORLD_ID,
      ownerId: OWNER_ID,
    })

    const restoreTimer = window.setTimeout(() => {
      if (snapshot) {
        setCurrentHomeMapState(snapshot.homeMapState)
        setCurrentConstructionPlan(snapshot.constructionPlan)
        setConstructionMessage(snapshot.constructionMessage)
        setLastAutoConstructionTick(snapshot.lastAutoConstructionTick)
      }

      lastAutoConstructionTickRef.current = hydrationStartTickRef.current
      setLocalSnapshotLoaded(true)
    }, 0)

    return () => {
      window.clearTimeout(restoreTimer)
    }
  }, [])

  useEffect(() => {
    if (!localSnapshotLoaded) return

    saveHomeMapLocalSnapshot({
      worldId: WORLD_ID,
      ownerId: OWNER_ID,
      snapshot: {
        version: HOME_MAP_LOCAL_STORAGE_VERSION,
        worldId: WORLD_ID,
        ownerId: OWNER_ID,
        homeMapState: currentHomeMapState,
        constructionPlan: currentConstructionPlan,
        constructionMessage,
        lastAutoConstructionTick,
        savedAt: Date.now(),
      },
    })
  }, [
    constructionMessage,
    currentConstructionPlan,
    currentHomeMapState,
    lastAutoConstructionTick,
    localSnapshotLoaded,
  ])

  useEffect(() => {
    if (!localSnapshotLoaded) return
    if (lastAutoConstructionTickRef.current === debugTick) return

    lastAutoConstructionTickRef.current = debugTick

    const result = advanceMvpConstructionByWorldTick({
      homeMapState: currentHomeMapState,
      plan: currentConstructionPlan,
      worldTick: debugTick,
      now: Date.now(),
    })

    if (!result.didAdvance) return

    window.setTimeout(() => {
      setCurrentHomeMapState(result.homeMapState)
      setCurrentConstructionPlan(result.plan)
      setConstructionMessage(result.messages[0] ?? "")
      setLastAutoConstructionTick(debugTick)
    }, 0)
  }, [
    currentConstructionPlan,
    currentHomeMapState,
    debugTick,
    localSnapshotLoaded,
  ])

  return (
    <>
      <div
        style={{
          padding: "12px 28px",
          color: "#f8fafc",
          background: "#172033",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          fontSize: 14,
        }}
      >
        开发验证页：用于查看 HomeMapState / ConstructionPlan / MapDiff，非正式用户体验。
      </div>
      <WorldLogicDashboard
        model={visualizationModel}
        onManualAdvanceConstruction={handleAdvanceConstruction}
        onResetLocalHomeMap={handleResetLocalHomeMap}
      />
    </>
  )
}
