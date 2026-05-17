"use client"

/**
 * 当前文件负责：调试 Intent → MapDiff → HomeMapState 数据闭环。
 */

import { useEffect, useMemo, useState } from "react"

import { runConstructionIntentDiffCycle } from "@/world/construction/construction-gateway"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"

import {
  buildWorldCreationRuntime,
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
  type CreateWorldInput,
} from "../../world/world-creation-runtime"

import styles from "./page.module.css"

type DebugPetPreset = "tired_hungry" | "stable" | "resting"
type DebugButlerPreset = "balanced" | "protective" | "aesthetic"

const DEFAULT_CREATE_WORLD_INPUT: CreateWorldInput = {
  year: 1998,
  month: 1,
  day: 1,
  time: "08:00",
  perspective: "unspecified",
  createdAt: 1_700_000_000_000,
}

const DEBUG_WORLD_TICK = 12

export default function MapDiffDebugPage() {
  const [petPreset, setPetPreset] = useState<DebugPetPreset>("tired_hungry")
  const [butlerPreset, setButlerPreset] =
    useState<DebugButlerPreset>("balanced")
  const [createWorldInput, setCreateWorldInput] =
    useState<CreateWorldInput | null>(null)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    const parsedInput =
      parseCreateWorldInput(
        window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY)
      ) ?? DEFAULT_CREATE_WORLD_INPUT

    setCreateWorldInput(parsedInput)
    setHasMounted(true)
  }, [])

  const debugResult = useMemo(() => {
    if (!hasMounted || !createWorldInput) return null

    const runtime = buildWorldCreationRuntime({
      createWorldInput,
    })

    const adjustedConstructionStyle = buildDebugConstructionStyle({
      baseStyle: runtime.butlerConstructionStyle,
      butlerPreset,
    })

    const initialHomeMapState = generateInitialHomeMap({
      worldId: runtime.worldId,
      ownerId: runtime.ownerId,
      birthSignature: runtime.birthSignature,
      worldSalt: runtime.worldSalt,
      butlerConstructionStyle: adjustedConstructionStyle,
      now: runtime.now,
    })

    const constructionCycle = runConstructionIntentDiffCycle({
      homeMapState: initialHomeMapState,
      pet: buildDebugPetContext(petPreset),
      butler: {
        mood: "focused",
        currentTask: "observe_home",
        constructionStyle: adjustedConstructionStyle,
        tags: ["mapdiff_debug_butler"],
      },
      worldTick: DEBUG_WORLD_TICK,
      now: runtime.now + DEBUG_WORLD_TICK,
    })

    return {
      createWorldInput,
      runtime: {
        ...runtime,
        butlerConstructionStyle: adjustedConstructionStyle,
      },
      initialHomeMapState,
      constructionCycle,
    }
  }, [butlerPreset, createWorldInput, hasMounted, petPreset])

  if (!debugResult) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>AI-PET-WORLD DEBUG</div>
          <h1 className={styles.title}>Intent → MapDiff 数据闭环测试</h1>
          <p className={styles.description}>正在读取本地创建世界输入……</p>
        </header>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>AI-PET-WORLD DEBUG</div>
        <h1 className={styles.title}>Intent → MapDiff 数据闭环测试</h1>
        <p className={styles.description}>
          这个页面只测试结构化数据链路，不渲染正式世界画面，不进入正式 /world。
        </p>
      </header>

      <section className={styles.controls}>
        <label className={styles.control}>
          <span>宠物状态预设</span>
          <select
            value={petPreset}
            onChange={(event) =>
              setPetPreset(event.target.value as DebugPetPreset)
            }
          >
            <option value="tired_hungry">疲惫 + 饥饿</option>
            <option value="stable">稳定</option>
            <option value="resting">偏休息</option>
          </select>
        </label>

        <label className={styles.control}>
          <span>管家建设倾向预设</span>
          <select
            value={butlerPreset}
            onChange={(event) =>
              setButlerPreset(event.target.value as DebugButlerPreset)
            }
          >
            <option value="balanced">平衡</option>
            <option value="protective">偏保护边界</option>
            <option value="aesthetic">偏整理美化</option>
          </select>
        </label>
      </section>

      <section className={styles.grid}>
        <DebugCard
          title="CreateWorldInput"
          value={debugResult.createWorldInput}
        />
        <DebugCard title="Runtime" value={debugResult.runtime} />
        <DebugCard
          title="Initial HomeMapState Summary"
          value={{
            zones: debugResult.initialHomeMapState.zones.map((zone) => ({
              id: zone.id,
              type: zone.type,
              bounds: zone.bounds,
              tags: zone.tags,
            })),
            placementCount:
              debugResult.initialHomeMapState.placements.length,
            resources: debugResult.initialHomeMapState.resources,
          }}
        />
        <DebugCard
          title="ConstructionIntent[]"
          value={debugResult.constructionCycle.intents}
        />
        <DebugCard
          title="Proposed MapDiff[]"
          value={debugResult.constructionCycle.proposedDiffs}
        />
        <DebugCard
          title="Accepted MapDiff[]"
          value={debugResult.constructionCycle.acceptedDiffs}
        />
        <DebugCard
          title="Rejected MapDiff[]"
          value={debugResult.constructionCycle.rejectedDiffs}
        />
        <DebugCard
          title="Next HomeMapState Summary"
          value={{
            didAdvance: debugResult.constructionCycle.didAdvance,
            placementCount:
              debugResult.constructionCycle.nextHomeMapState.placements.length,
            mapDiffCount:
              debugResult.constructionCycle.nextHomeMapState.mapDiffs.length,
            messages: debugResult.constructionCycle.messages,
          }}
        />
      </section>
    </main>
  )
}

function DebugCard(input: { title: string; value: unknown }) {
  return (
    <article className={styles.card}>
      <h2>{input.title}</h2>
      <pre>{JSON.stringify(input.value, null, 2)}</pre>
    </article>
  )
}

function buildDebugPetContext(preset: DebugPetPreset) {
  if (preset === "stable") {
    return {
      energy: 68,
      hunger: 32,
      mood: "stable",
      currentZoneType: "initial_care" as const,
      recentAction: "observing",
      tags: ["mapdiff_debug_pet", "stable_pet"],
    }
  }

  if (preset === "resting") {
    return {
      energy: 22,
      hunger: 38,
      mood: "quiet",
      currentZoneType: "pet_rest" as const,
      recentAction: "resting",
      tags: ["mapdiff_debug_pet", "resting_pet"],
    }
  }

  return {
    energy: 28,
    hunger: 72,
    mood: "curious",
    currentZoneType: "pet_arrival" as const,
    recentAction: "arrived",
    tags: ["mapdiff_debug_pet", "tired_hungry_pet"],
  }
}

function buildDebugConstructionStyle(input: {
  baseStyle: ReturnType<typeof buildWorldCreationRuntime>["butlerConstructionStyle"]
  butlerPreset: DebugButlerPreset
}) {
  if (input.butlerPreset === "protective") {
    return {
      ...input.baseStyle,
      protectiveKeeper: 0.86,
      aestheticOrganizer: Math.max(input.baseStyle.aestheticOrganizer, 0.42),
    }
  }

  if (input.butlerPreset === "aesthetic") {
    return {
      ...input.baseStyle,
      aestheticOrganizer: 0.86,
      warmCaretaker: Math.max(input.baseStyle.warmCaretaker, 0.68),
    }
  }

  return input.baseStyle
}