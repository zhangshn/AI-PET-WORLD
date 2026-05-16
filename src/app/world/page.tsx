"use client"

/**
 * 当前文件负责：作为 /world 新版地图入口。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ConstructionPlan } from "@/world/construction/construction-schema"
import {
  advanceMvpConstruction,
  advanceMvpConstructionByWorldTick,
  createMvpPetRestConstructionPlan,
  MVP_CONSTRUCTION_AUTO_ADVANCE_TICK_INTERVAL,
} from "@/world/construction/construction-gateway"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import {
  clearHomeMapLocalSnapshot,
  HOME_MAP_LOCAL_STORAGE_VERSION,
  loadHomeMapLocalSnapshot,
  saveHomeMapLocalSnapshot,
} from "@/world/map-state/home-map-local-persistence"
import { HomeMapRenderer } from "@/world/rendering/HomeMapRenderer"
import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"

import { WorldConstructionTestControls } from "./WorldConstructionTestControls"
import { useWorldEngineState } from "./hooks/useWorldEngineState"

const WORLD_ID = "mvp-visible-world"
const OWNER_ID = "local-player"
const DEFAULT_CONSTRUCTION_MESSAGE = "管家建设尚未开始。"

const DEFAULT_CONSTRUCTION_STYLE = {
  structuredBuilder: 0.56,
  warmCaretaker: 0.72,
  protectiveKeeper: 0.42,
  aestheticOrganizer: 0.38,
  quietMaintainer: 0.48,
  adaptivePlanner: 0.52,
}

export default function WorldPage() {
  const worldState = useWorldEngineState()
  const lastAutoConstructionTickRef = useRef<number | null>(worldState.tick)

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
  const localSnapshot = useMemo(
    () =>
      loadHomeMapLocalSnapshot({
        worldId: WORLD_ID,
        ownerId: OWNER_ID,
      }),
    []
  )
  const [currentHomeMapState, setCurrentHomeMapState] = useState(
    () => localSnapshot?.homeMapState ?? initialHomeMapState
  )
  const [currentConstructionPlan, setCurrentConstructionPlan] =
    useState<ConstructionPlan | null>(
      () => localSnapshot?.constructionPlan ?? null
    )
  const [constructionMessage, setConstructionMessage] = useState(
    () => localSnapshot?.constructionMessage ?? DEFAULT_CONSTRUCTION_MESSAGE
  )
  const [lastAutoConstructionTick, setLastAutoConstructionTick] = useState<
    number | null
  >(() => localSnapshot?.lastAutoConstructionTick ?? null)

  const renderModel = useMemo(
    () => buildHomeMapRenderModel(currentHomeMapState),
    [currentHomeMapState]
  )

  const handleAdvanceConstruction = useCallback(() => {
    const plan =
      currentConstructionPlan ??
      createMvpPetRestConstructionPlan(currentHomeMapState)
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
    lastAutoConstructionTickRef.current = worldState.tick
    setCurrentHomeMapState(initialHomeMapState)
    setCurrentConstructionPlan(null)
    setConstructionMessage(DEFAULT_CONSTRUCTION_MESSAGE)
    setLastAutoConstructionTick(null)
  }, [initialHomeMapState, worldState.tick])

  useEffect(() => {
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
  ])

  useEffect(() => {
    if (lastAutoConstructionTickRef.current === worldState.tick) return

    lastAutoConstructionTickRef.current = worldState.tick

    const result = advanceMvpConstructionByWorldTick({
      homeMapState: currentHomeMapState,
      plan: currentConstructionPlan,
      worldTick: worldState.tick,
      now: Date.now(),
    })

    if (!result.didAdvance) return

    window.setTimeout(() => {
      setCurrentHomeMapState(result.homeMapState)
      setCurrentConstructionPlan(result.plan)
      setConstructionMessage(result.messages[0] ?? "")
      setLastAutoConstructionTick(worldState.tick)
    }, 0)
  }, [currentConstructionPlan, currentHomeMapState, worldState.tick])

  return (
    <>
      <WorldConstructionTestControls
        currentConstructionPlan={currentConstructionPlan}
        constructionMessage={constructionMessage}
        autoAdvanceIntervalTicks={MVP_CONSTRUCTION_AUTO_ADVANCE_TICK_INTERVAL}
        lastAutoConstructionTick={lastAutoConstructionTick}
        onAdvanceConstruction={handleAdvanceConstruction}
        onResetLocalHomeMap={handleResetLocalHomeMap}
      />
      <HomeMapRenderer
        renderModel={renderModel}
        worldTick={worldState.tick}
      />
    </>
  )
}
