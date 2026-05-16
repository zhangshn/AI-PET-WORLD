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
import { HomeMapRenderer } from "@/world/rendering/HomeMapRenderer"
import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"

import { WorldConstructionTestControls } from "./WorldConstructionTestControls"
import { useWorldEngineState } from "./hooks/useWorldEngineState"

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
        worldId: "mvp-visible-world",
        ownerId: "local-player",
        birthSignature: "mvp-v1-2-visible-world",
        worldSalt: "initial-home",
        butlerConstructionStyle: DEFAULT_CONSTRUCTION_STYLE,
        now: 0,
      }),
    []
  )
  const [currentHomeMapState, setCurrentHomeMapState] = useState(
    () => initialHomeMapState
  )
  const [currentConstructionPlan, setCurrentConstructionPlan] =
    useState<ConstructionPlan | null>(null)
  const [constructionMessage, setConstructionMessage] =
    useState("管家建设尚未开始。")
  const [lastAutoConstructionTick, setLastAutoConstructionTick] = useState<
    number | null
  >(null)

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
      />
      <HomeMapRenderer
        renderModel={renderModel}
        worldTick={worldState.tick}
      />
    </>
  )
}
