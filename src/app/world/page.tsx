"use client"

/**
 * 当前文件负责：作为 /world 新版地图入口。
 */

import { useMemo } from "react"

import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import { HomeMapRenderer } from "@/world/rendering/HomeMapRenderer"
import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"

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

  const homeMapState = useMemo(
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

  const renderModel = useMemo(
    () => buildHomeMapRenderModel(homeMapState),
    [homeMapState]
  )

  return (
    <HomeMapRenderer
      renderModel={renderModel}
      worldTick={worldState.tick}
    />
  )
}
