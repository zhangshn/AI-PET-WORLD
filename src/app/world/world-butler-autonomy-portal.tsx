"use client"

/**
 * 当前文件职责：把 AI 管家自主意识面板插入 /world 主世界只读展示区。
 */

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"

import {
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
  type CreateWorldInput,
} from "@/world/creation/world-creation-runtime"
import { runAiPetWorldMvpPipeline } from "@/world/mvp-core/mvp-core-gateway"
import { buildWorldFirstSceneModel } from "@/world/runtime/world-first-scene-model"

import { ButlerAutonomyPanel } from "./butler-autonomy-panel"
import { buildMvpWorldViewModel } from "./mvp-world-view-model"

const DEFAULT_WORLD_PREVIEW_INPUT: CreateWorldInput = {
  year: 1991,
  month: 6,
  day: 18,
  time: "08:00",
  perspective: "unspecified",
  createdAt: 1000,
}

export function WorldButlerAutonomyPortal() {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )
  const [createWorldInput, setCreateWorldInput] =
    useState<CreateWorldInput>(DEFAULT_WORLD_PREVIEW_INPUT)

  useEffect(() => {
    const storedInput = window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY)
    if (!storedInput) return

    try {
      setCreateWorldInput(parseCreateWorldInput(storedInput))
    } catch {
      setCreateWorldInput(DEFAULT_WORLD_PREVIEW_INPUT)
    }
  }, [])

  useEffect(() => {
    let frameId = 0
    let container: HTMLDivElement | null = null
    let isMounted = true

    function attachPortal() {
      if (!isMounted) return

      const worldPanel = document.querySelector<HTMLElement>(
        '[aria-label="主世界"]'
      )
      const resourcePanel = worldPanel
        ? Array.from(worldPanel.querySelectorAll<HTMLElement>("article")).find(
            (article) =>
              article.querySelector("h3")?.textContent?.trim() === "资源状态"
          )
        : null

      if (!resourcePanel) {
        frameId = window.requestAnimationFrame(attachPortal)
        return
      }

      container = document.createElement("div")
      container.dataset.worldButlerAutonomyPortal = "true"
      resourcePanel.insertAdjacentElement("afterend", container)
      setPortalContainer(container)
    }

    attachPortal()

    return () => {
      isMounted = false
      if (frameId) window.cancelAnimationFrame(frameId)
      container?.remove()
      setPortalContainer(null)
    }
  }, [])

  const summary = useMemo(() => {
    const firstSceneModel = buildWorldFirstSceneModel({ createWorldInput })
    const homeMapState = firstSceneModel.homeMapState
    const mvpPipelineResult = runAiPetWorldMvpPipeline({
      playerId: homeMapState.ownerId,
      ownerId: homeMapState.ownerId,
      worldId: firstSceneModel.worldId,
      birthYear: createWorldInput.year,
      birthMonth: createWorldInput.month,
      birthDay: createWorldInput.day,
      birthHour: parseBirthHour(createWorldInput.time),
      timezone: "Asia/Shanghai",
      worldDay: 1,
      now: homeMapState.updatedAt + 1,
      seed: homeMapState.seed,
      runMode: "preview",
      persistenceMode: "memory_preview",
      visualMode: "formal_precheck",
      tags: [
        "world_route_butler_autonomy_portal",
        "read_only_world_view",
        "no_default_companion_entry",
      ],
    })

    return buildMvpWorldViewModel(mvpPipelineResult).butlerAutonomyProbe
  }, [createWorldInput])

  if (!portalContainer) return null

  return createPortal(
    <ButlerAutonomyPanel summary={summary} />,
    portalContainer
  )
}

function parseBirthHour(time: string): number {
  const [hourText] = time.split(":")
  const parsedHour = Number(hourText)

  if (!Number.isFinite(parsedHour)) return 8

  return Math.min(23, Math.max(0, Math.trunc(parsedHour)))
}
