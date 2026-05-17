"use client"

/**
 * 当前文件负责：调试 Intent → MapDiff → HomeMapState 数据闭环。
 */

import { useEffect, useMemo, useState } from "react"

import { runConstructionIntentDiffCycle } from "@/world/construction/construction-gateway"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  createAddPlacementDiff,
  createMovePlacementDiff,
  createRemovePlacementDiff,
} from "@/world/map-state/map-diff-engine"
import { validateMapDiffs } from "@/world/map-state/map-diff-validator"
import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"

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

    const validatorSafetyTest = buildValidatorSafetyTest({
      homeMapState: initialHomeMapState,
      now: runtime.now + DEBUG_WORLD_TICK + 1,
    })

    return {
      createWorldInput,
      runtime: {
        ...runtime,
        butlerConstructionStyle: adjustedConstructionStyle,
      },
      initialHomeMapState,
      constructionCycle,
      validatorSafetyTest,
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

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div className={styles.eyebrow}>VALIDATOR SAFETY TEST</div>
          <h2 className={styles.sectionTitle}>非法 MapDiff 拦截测试</h2>
          <p className={styles.description}>
            这里故意构造错误地图变化，验证 Validator 是否能拒绝它们。
          </p>
        </header>

        <section className={styles.grid}>
          <DebugCard
            title="Unsafe Proposed MapDiff[]"
            value={debugResult.validatorSafetyTest.proposedDiffs}
          />
          <DebugCard
            title="Unsafe Accepted MapDiff[]"
            value={debugResult.validatorSafetyTest.acceptedDiffs}
          />
          <DebugCard
            title="Unsafe Rejected MapDiff[]"
            value={debugResult.validatorSafetyTest.rejectedDiffs}
          />
          <DebugCard
            title="Validator Safety Summary"
            value={debugResult.validatorSafetyTest.summary}
          />
        </section>
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

function buildValidatorSafetyTest(input: {
  homeMapState: HomeMapState
  now: number
}) {
  const protectedPlacement = findProtectedPlacement(input.homeMapState)
  const pathPlacement = input.homeMapState.placements.find(
    (placement) => placement.layer === "path"
  )
  const firstPlacement = input.homeMapState.placements[0]

  const proposedDiffs = [
    createAddPlacementDiff({
      id: "safety-test-invalid-asset",
      placementId: "safety-test-invalid-asset",
      placement: createDebugPlacement({
        id: "safety-test-invalid-asset",
        assetId: "notRegisteredAsset01" as WorldMapAssetId,
        x: 2,
        y: 2,
        layer: "surface-decoration",
        tags: ["safety_test", "invalid_asset"],
      }),
      reason: "安全测试：未注册 assetId 应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "invalid_asset"],
    }),
    createAddPlacementDiff({
      id: "safety-test-out-of-bounds",
      placementId: "safety-test-out-of-bounds",
      placement: createDebugPlacement({
        id: "safety-test-out-of-bounds",
        assetId: "surfaceFlowerPatch01",
        x: input.homeMapState.mapSize.columns + 99,
        y: input.homeMapState.mapSize.rows + 99,
        layer: "surface-decoration",
        tags: ["safety_test", "out_of_bounds"],
      }),
      reason: "安全测试：越界坐标应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "out_of_bounds"],
    }),
    createAddPlacementDiff({
      id: "safety-test-duplicate-placement",
      placementId: firstPlacement?.id ?? "missing-placement",
      placement: createDebugPlacement({
        id: firstPlacement?.id ?? "missing-placement",
        assetId: "surfaceFlowerPatch01",
        x: 3,
        y: 3,
        layer: "surface-decoration",
        tags: ["safety_test", "duplicate_placement"],
      }),
      reason: "安全测试：重复 placementId 应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "duplicate_placement"],
    }),
    createAddPlacementDiff({
      id: "safety-test-layer-mismatch",
      placementId: "safety-test-layer-mismatch",
      placement: createDebugPlacement({
        id: "safety-test-layer-mismatch",
        assetId: "facilityFoodBowlFull01",
        x: 4,
        y: 4,
        layer: "nature",
        tags: ["safety_test", "layer_mismatch"],
      }),
      reason: "安全测试：asset category 与 layer 不匹配应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "layer_mismatch"],
    }),
    createAddPlacementDiff({
      id: "safety-test-cover-path",
      placementId: "safety-test-cover-path",
      placement: createDebugPlacement({
        id: "safety-test-cover-path",
        assetId: "surfaceFlowerPatch01",
        x: pathPlacement?.x ?? 1,
        y: pathPlacement?.y ?? 1,
        layer: "surface-decoration",
        tags: ["safety_test", "cover_path"],
      }),
      reason: "安全测试：覆盖路径应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "cover_path"],
    }),
    createMovePlacementDiff({
      id: "safety-test-move-protected",
      placementId: protectedPlacement?.id ?? "missing-protected-placement",
      patch: {
        x: 1,
        y: 1,
      },
      reason: "安全测试：移动受保护核心对象应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "move_protected"],
    }),
    createRemovePlacementDiff({
      id: "safety-test-remove-protected",
      placementId: protectedPlacement?.id ?? "missing-protected-placement",
      reason: "安全测试：删除受保护核心对象应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "remove_protected"],
    }),
  ]

  const validationResult = validateMapDiffs({
    homeMapState: input.homeMapState,
    mapDiffs: proposedDiffs,
  })

  return {
    proposedDiffs,
    acceptedDiffs: validationResult.acceptedDiffs,
    rejectedDiffs: validationResult.rejectedDiffs,
    summary: {
      proposedCount: proposedDiffs.length,
      acceptedCount: validationResult.acceptedDiffs.length,
      rejectedCount: validationResult.rejectedDiffs.length,
      passed:
        validationResult.acceptedDiffs.length === 0 &&
        validationResult.rejectedDiffs.length === proposedDiffs.length,
      warnings: validationResult.warnings,
    },
  }
}

function createDebugPlacement(input: {
  id: string
  assetId: WorldMapAssetId
  x: number
  y: number
  layer: MapPlacement["layer"]
  tags: string[]
}): MapPlacement {
  return {
    id: input.id,
    assetId: input.assetId,
    x: input.x,
    y: input.y,
    layer: input.layer,
    scale: 1,
    alpha: 1,
    label: input.id,
    source: "construction_plan",
    tags: input.tags,
  }
}

function findProtectedPlacement(homeMapState: HomeMapState) {
  return homeMapState.placements.find((placement) =>
    placement.tags.some((tag) =>
      [
        "core_living",
        "arrival_focus",
        "temporary_shelter",
        "pet_bed",
        "butler",
        "pet",
        "actor",
      ].includes(tag)
    )
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