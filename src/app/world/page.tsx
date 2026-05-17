"use client"

/**
 * 当前文件负责：把本地创建世界输入转换为 HomeMapState，并交给固定 Renderer 渲染。
 */

import { useEffect, useMemo, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"

import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import { runConstructionIntentDiffCycle } from "@/world/construction/construction-gateway"
import { HomeMapRenderer } from "@/world/rendering/HomeMapRenderer"
import { buildHomeMapRenderModel } from "@/world/rendering/home-map-render-model"

import styles from "./page.module.css"
import {
  buildWorldCreationRuntime,
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
} from "./world-creation-runtime"

const PREVIEW_WORLD_TICK = 12

export default function WorldPage() {
  const router = useRouter()
  const createWorldInputSnapshot = useSyncExternalStore(
    subscribeCreateWorldInput,
    getCreateWorldInputSnapshot,
    getCreateWorldInputServerSnapshot
  )

  const createWorldInput = useMemo(
    () => parseCreateWorldInput(createWorldInputSnapshot),
    [createWorldInputSnapshot]
  )

  useEffect(() => {
    if (createWorldInputSnapshot === null || !createWorldInput) {
      router.replace("/create-world")
    }
  }, [createWorldInput, createWorldInputSnapshot, router])

  const homeMapState = useMemo(() => {
    if (!createWorldInput) return null

    return buildPreviewHomeMapState(createWorldInput)
  }, [createWorldInput])

  const renderModel = useMemo(() => {
    if (!homeMapState) return null

    return buildHomeMapRenderModel(homeMapState)
  }, [homeMapState])

  if (!renderModel) {
    return <main className={styles.worldPage} aria-label="AI-PET-WORLD" />
  }

  return (
    <main className={styles.worldPage} aria-label="AI-PET-WORLD">
      <section className={styles.worldStage} aria-label="AI-PET-WORLD 世界舞台">
        <HomeMapRenderer
          renderModel={renderModel}
          worldTick={PREVIEW_WORLD_TICK}
        />
      </section>
    </main>
  )
}

function buildPreviewHomeMapState(
  createWorldInput: NonNullable<
    ReturnType<typeof parseCreateWorldInput>
  >
): HomeMapState {
  const runtime = buildWorldCreationRuntime({
    createWorldInput,
  })

  const initialHomeMapState = generateInitialHomeMap({
    worldId: runtime.worldId,
    ownerId: runtime.ownerId,
    birthSignature: runtime.birthSignature,
    worldSalt: runtime.worldSalt,
    butlerConstructionStyle: runtime.butlerConstructionStyle,
    now: runtime.now,
  })

  const constructionCycle = runConstructionIntentDiffCycle({
    homeMapState: initialHomeMapState,
    pet: {
      energy: 28,
      hunger: 72,
      mood: "curious",
      currentZoneType: "pet_arrival",
      recentAction: "arrived",
      tags: ["mvp_preview_pet"],
    },
    butler: {
      mood: "focused",
      currentTask: "observe_home",
      constructionStyle: runtime.butlerConstructionStyle,
      tags: ["mvp_preview_butler"],
    },
    worldTick: PREVIEW_WORLD_TICK,
    now: runtime.now + PREVIEW_WORLD_TICK,
  })

  return constructionCycle.nextHomeMapState
}

function subscribeCreateWorldInput(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined

  window.addEventListener("storage", onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
  }
}

function getCreateWorldInputSnapshot(): string | null {
  if (typeof window === "undefined") return null

  return window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY)
}

function getCreateWorldInputServerSnapshot(): string | null {
  return null
}