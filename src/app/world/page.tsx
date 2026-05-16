"use client"

/**
 * 当前文件负责：作为 /world 新版地图入口。
 */

import { useMemo, useState } from "react"

import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import { HomeMapRenderer } from "@/world/rendering/HomeMapRenderer"
import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"
import type { ConstructionPlan } from "@/world/construction/construction-schema"
import {
  advanceMvpConstruction,
  createMvpPetRestConstructionPlan,
} from "@/world/construction/construction-gateway"

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
  const [currentHomeMapState, setCurrentHomeMapState] =
    useState(initialHomeMapState)
  const [currentConstructionPlan, setCurrentConstructionPlan] =
    useState<ConstructionPlan | null>(null)
  const [constructionMessage, setConstructionMessage] =
    useState("管家建设尚未开始。")

  const renderModel = useMemo(
    () => buildHomeMapRenderModel(currentHomeMapState),
    [currentHomeMapState]
  )

  function handleAdvanceConstruction() {
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
  }

  return (
    <>
      <WorldConstructionTestControls
        currentConstructionPlan={currentConstructionPlan}
        constructionMessage={constructionMessage}
        onAdvanceConstruction={handleAdvanceConstruction}
      />
      <HomeMapRenderer
        renderModel={renderModel}
        worldTick={worldState.tick}
      />
    </>
  )
}
