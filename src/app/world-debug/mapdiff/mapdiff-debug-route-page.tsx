"use client"

/**
 * 当前文件负责：展示 Intent → MapDiff → HomeMapState 数据闭环调试结果。
 */

import { useMemo, useSyncExternalStore, useState } from "react"

import {
  buildConstructionDebugScenario,
  DEFAULT_CONSTRUCTION_DEBUG_CREATE_WORLD_INPUT,
  type ConstructionDebugButlerPreset,
  type ConstructionDebugPetPreset,
} from "@/world/construction/construction-debug-scenario"
import {
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
} from "@/world/creation/world-creation-runtime"
import { buildEnvironmentStateFromHomeMap } from "@/world/environment/environment-gateway"
import { buildPlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"

import styles from "./mapdiff-debug-route-page.styles.module.css"

const CREATE_WORLD_INPUT_PENDING = "__ai_pet_world_create_input_pending__"
const CREATE_WORLD_INPUT_EMPTY = "__ai_pet_world_create_input_empty__"

export default function MapdiffDebugRoutePage() {
  const [petPreset, setPetPreset] =
    useState<ConstructionDebugPetPreset>("tired_hungry")
  const [butlerPreset, setButlerPreset] =
    useState<ConstructionDebugButlerPreset>("balanced")

  const createWorldInputSnapshot = useSyncExternalStore(
    subscribeCreateWorldInput,
    getCreateWorldInputSnapshot,
    getCreateWorldInputServerSnapshot
  )

  const createWorldInput = useMemo(() => {
    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_PENDING) return null

    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_EMPTY) {
      return DEFAULT_CONSTRUCTION_DEBUG_CREATE_WORLD_INPUT
    }

    return (
      parseCreateWorldInput(createWorldInputSnapshot) ??
      DEFAULT_CONSTRUCTION_DEBUG_CREATE_WORLD_INPUT
    )
  }, [createWorldInputSnapshot])

  const debugResult = useMemo(() => {
    if (!createWorldInput) return null

    return buildConstructionDebugScenario({
      createWorldInput,
      petPreset,
      butlerPreset,
    })
  }, [butlerPreset, createWorldInput, petPreset])

  const initialPlacementGeometryAudit = useMemo(() => {
    if (!debugResult) return null

    return buildPlacementGeometryAuditReport({
      homeMapState: debugResult.initialHomeMapState,
      checkedAt: debugResult.initialHomeMapState.updatedAt,
    })
  }, [debugResult])

  const nextPlacementGeometryAudit = useMemo(() => {
    if (!debugResult) return null

    return buildPlacementGeometryAuditReport({
      homeMapState: debugResult.constructionCycle.nextHomeMapState,
      checkedAt: debugResult.constructionCycle.nextHomeMapState.updatedAt,
    })
  }, [debugResult])

  const initialEnvironmentState = useMemo(() => {
    if (!debugResult) return null

    return buildEnvironmentStateFromHomeMap({
      homeMapState: debugResult.initialHomeMapState,
      generatedAt: debugResult.initialHomeMapState.updatedAt,
    })
  }, [debugResult])

  const nextEnvironmentState = useMemo(() => {
    if (!debugResult) return null

    return buildEnvironmentStateFromHomeMap({
      homeMapState: debugResult.constructionCycle.nextHomeMapState,
      generatedAt: debugResult.constructionCycle.nextHomeMapState.updatedAt,
    })
  }, [debugResult])

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
              setPetPreset(event.target.value as ConstructionDebugPetPreset)
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
              setButlerPreset(
                event.target.value as ConstructionDebugButlerPreset
              )
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
          title="World Creation Influence Summary"
          value={debugResult.worldCreationInfluenceTest.summary}
        />
        <DebugCard
          title="World Creation Influence Cases"
          value={debugResult.worldCreationInfluenceTest.cases.map(
            (influenceCase) => ({
              id: influenceCase.id,
              label: influenceCase.label,
              input: influenceCase.input,
              styleSource: influenceCase.runtime.styleSource,
              butlerConstructionStyle:
                influenceCase.runtime.butlerConstructionStyle,
              styleDeltaFromBase: influenceCase.styleDeltaFromBase,
            })
          )}
        />
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
          title="Initial Environment Summary"
          value={mapEnvironmentSummary(initialEnvironmentState)}
        />
        <DebugCard
          title="Initial Terrain Cell Sample"
          value={mapTerrainCellSample(initialEnvironmentState)}
        />
        <DebugCard
          title="Initial Placement Geometry Audit Summary"
          value={initialPlacementGeometryAudit?.summary}
        />
        <DebugCard
          title="Initial Placement Geometry Audit Rejected Items"
          value={mapRejectedPlacementGeometryAuditItems(
            initialPlacementGeometryAudit?.items ?? []
          )}
        />
        <DebugCard
          title="Initial Placement Geometry Audit Unmapped Sample"
          value={mapUnmappedPlacementGeometryAuditItems(
            initialPlacementGeometryAudit?.items ?? []
          )}
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
        <DebugCard
          title="Next Environment Summary"
          value={mapEnvironmentSummary(nextEnvironmentState)}
        />
        <DebugCard
          title="Next Terrain Cell Sample"
          value={mapTerrainCellSample(nextEnvironmentState)}
        />
        <DebugCard
          title="Next Placement Geometry Audit Summary"
          value={nextPlacementGeometryAudit?.summary}
        />
        <DebugCard
          title="Next Placement Geometry Audit Rejected Items"
          value={mapRejectedPlacementGeometryAuditItems(
            nextPlacementGeometryAudit?.items ?? []
          )}
        />
        <DebugCard
          title="Next Placement Geometry Audit Unmapped Sample"
          value={mapUnmappedPlacementGeometryAuditItems(
            nextPlacementGeometryAudit?.items ?? []
          )}
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

function mapEnvironmentSummary(
  environment: ReturnType<typeof buildEnvironmentStateFromHomeMap> | null
) {
  if (!environment) return null

  return {
    worldId: environment.worldId,
    generatedAt: environment.generatedAt,
    tags: environment.tags,
    terrainSummary: environment.terrain.summary,
    ecology: environment.ecology,
    materials: environment.materials,
  }
}

function mapTerrainCellSample(
  environment: ReturnType<typeof buildEnvironmentStateFromHomeMap> | null
) {
  if (!environment) return []

  return Object.values(environment.terrain.cells)
    .slice(0, 20)
    .map((cell) => ({
      x: cell.x,
      y: cell.y,
      biome: cell.biome,
      surfaceType: cell.surfaceType,
      moisture: cell.moisture,
      fertility: cell.fertility,
      tags: cell.tags.slice(0, 8),
    }))
}

function mapRejectedPlacementGeometryAuditItems(
  items: NonNullable<
    ReturnType<typeof buildPlacementGeometryAuditReport>
  >["items"]
) {
  return items
    .filter((item) => !item.ruleAccepted)
    .map((item) => ({
      placementId: item.placementId,
      label: item.label,
      layer: item.layer,
      assetId: item.assetId,
      objectType: item.objectType,
      ruleReason: item.ruleReason,
      ruleMessage: item.ruleMessage,
      tags: item.tags,
    }))
}

function mapUnmappedPlacementGeometryAuditItems(
  items: NonNullable<
    ReturnType<typeof buildPlacementGeometryAuditReport>
  >["items"]
) {
  return items
    .filter((item) => item.objectType === null)
    .slice(0, 20)
    .map((item) => ({
      placementId: item.placementId,
      label: item.label,
      layer: item.layer,
      assetId: item.assetId,
      tags: item.tags,
    }))
}

function subscribeCreateWorldInput(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined

  window.addEventListener("storage", onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
  }
}

function getCreateWorldInputSnapshot(): string {
  if (typeof window === "undefined") return CREATE_WORLD_INPUT_PENDING

  return (
    window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY) ??
    CREATE_WORLD_INPUT_EMPTY
  )
}

function getCreateWorldInputServerSnapshot(): string {
  return CREATE_WORLD_INPUT_PENDING
}
