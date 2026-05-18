"use client"

/**
 * 当前文件负责：展示 ProceduralRenderer v0 的 VisualState 与 DrawCommand JSON 调试结果。
 */

import { useMemo, useState, useSyncExternalStore } from "react"

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
import { buildWorldEngineDebugScenario } from "@/world/debug-scenarios/world-debug-scenario-gateway"
import {
  buildRenderableWorldSnapshot,
  buildVisualState,
  type DrawCommand,
  type RenderableWorldSnapshot,
  type VisualRuleStatus,
  type VisualState,
} from "@/world/rendering/renderer-gateway"

import styles from "../mapdiff/mapdiff-debug-route-page.styles.module.css"

const CREATE_WORLD_INPUT_PENDING = "__ai_pet_world_create_input_pending__"
const CREATE_WORLD_INPUT_EMPTY = "__ai_pet_world_create_input_empty__"

type CountMap = Record<string, number>

type PlacementRuleSummary = Record<VisualRuleStatus, number>

export default function ProceduralRendererDebugRoutePage() {
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

  const worldEngineDebugScenario = useMemo(() => {
    if (!debugResult) return null

    return buildWorldEngineDebugScenario({
      debugResult,
      petPreset,
    })
  }, [debugResult, petPreset])

  const initialVisualState = useMemo(() => {
    if (!debugResult || !worldEngineDebugScenario) return null

    return buildVisualState({
      homeMapState: debugResult.initialHomeMapState,
      environmentState: worldEngineDebugScenario.initial.environmentState,
      placementGeometryAudit:
        worldEngineDebugScenario.initial.placementGeometryAudit,
      generatedAt: debugResult.initialHomeMapState.updatedAt,
    })
  }, [debugResult, worldEngineDebugScenario])

  const nextVisualState = useMemo(() => {
    if (!debugResult || !worldEngineDebugScenario) return null

    return buildVisualState({
      homeMapState: debugResult.constructionCycle.nextHomeMapState,
      environmentState: worldEngineDebugScenario.next.environmentState,
      placementGeometryAudit:
        worldEngineDebugScenario.next.placementGeometryAudit,
      generatedAt: debugResult.constructionCycle.nextHomeMapState.updatedAt,
    })
  }, [debugResult, worldEngineDebugScenario])

  const initialRenderableWorldSnapshot = useMemo(() => {
    if (!initialVisualState) return null

    return buildRenderableWorldSnapshot({
      visualState: initialVisualState,
    })
  }, [initialVisualState])

  const nextRenderableWorldSnapshot = useMemo(() => {
    if (!nextVisualState) return null

    return buildRenderableWorldSnapshot({
      visualState: nextVisualState,
    })
  }, [nextVisualState])

  if (!debugResult || !initialVisualState || !nextVisualState) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>AI-PET-WORLD DEBUG</div>
          <h1 className={styles.title}>ProceduralRenderer v0 JSON 调试</h1>
          <p className={styles.description}>正在读取本地创建世界输入...</p>
        </header>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>AI-PET-WORLD DEBUG</div>
        <h1 className={styles.title}>ProceduralRenderer v0 JSON 调试</h1>
        <p className={styles.description}>
          这个页面只展示 VisualState 与 DrawCommand JSON，不绘制画面，不进入正式 /world。
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
            <option value="tired_hungry">tired_hungry</option>
            <option value="stable">stable</option>
            <option value="resting">resting</option>
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
            <option value="balanced">balanced</option>
            <option value="protective">protective</option>
            <option value="aesthetic">aesthetic</option>
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
          title="Initial VisualState Summary"
          value={mapVisualStateSummary(initialVisualState)}
        />
        <DebugCard title="Initial VisualState" value={initialVisualState} />
        <DebugCard
          title="Initial DrawCommand Summary"
          value={mapDrawCommandSummary(
            initialRenderableWorldSnapshot?.drawCommands ?? []
          )}
        />
        <DebugCard
          title="Initial DrawCommands Sample"
          value={
            initialRenderableWorldSnapshot?.drawCommands.slice(0, 80) ?? []
          }
        />
        <DebugCard
          title="Initial RenderableWorldSnapshot Summary"
          value={
            initialRenderableWorldSnapshot
              ? mapRenderableWorldSnapshotSummary(initialRenderableWorldSnapshot)
              : null
          }
        />
        <DebugCard
          title="Next VisualState Summary"
          value={mapVisualStateSummary(nextVisualState)}
        />
        <DebugCard title="Next VisualState" value={nextVisualState} />
        <DebugCard
          title="Next DrawCommand Summary"
          value={mapDrawCommandSummary(
            nextRenderableWorldSnapshot?.drawCommands ?? []
          )}
        />
        <DebugCard
          title="Next DrawCommands Sample"
          value={nextRenderableWorldSnapshot?.drawCommands.slice(0, 80) ?? []}
        />
        <DebugCard
          title="Next RenderableWorldSnapshot Summary"
          value={
            nextRenderableWorldSnapshot
              ? mapRenderableWorldSnapshotSummary(nextRenderableWorldSnapshot)
              : null
          }
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

function mapVisualStateSummary(visualState: VisualState) {
  return {
    worldId: visualState.worldId,
    mapSize: visualState.mapSize,
    zoneCount: visualState.zones.length,
    placementCount: visualState.placements.length,
    terrainCellCount: visualState.terrainCells.length,
    overlayCount: visualState.overlays.length,
    enabledOverlays: visualState.overlays
      .filter((overlay) => overlay.enabled)
      .map((overlay) => overlay.type),
    generatedAt: visualState.generatedAt,
    sources: visualState.sources,
    tags: visualState.tags,
    placementRuleSummary: buildPlacementRuleSummary(visualState),
  }
}

function buildPlacementRuleSummary(
  visualState: VisualState
): PlacementRuleSummary {
  return visualState.placements.reduce<PlacementRuleSummary>(
    (summary, placement) => ({
      ...summary,
      [placement.ruleStatus]: summary[placement.ruleStatus] + 1,
    }),
    {
      accepted: 0,
      rejected: 0,
      unmapped: 0,
      unknown: 0,
    }
  )
}

function mapDrawCommandSummary(drawCommands: DrawCommand[]) {
  return {
    total: drawCommands.length,
    byKind: countBy(drawCommands.map((command) => command.kind)),
    byLayer: countBy(drawCommands.map((command) => command.layer)),
    bySource: countBy(drawCommands.map((command) => command.source)),
    sampleIds: drawCommands.slice(0, 20).map((command) => command.id),
  }
}

function mapRenderableWorldSnapshotSummary(snapshot: RenderableWorldSnapshot) {
  return {
    worldId: snapshot.visualState.worldId,
    visualPlacementCount: snapshot.visualState.placements.length,
    visualTerrainCellCount: snapshot.visualState.terrainCells.length,
    drawCommandCount: snapshot.drawCommands.length,
    tags: snapshot.tags,
  }
}

function countBy<TValue extends string>(values: TValue[]): CountMap {
  return values.reduce<CountMap>(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1,
    }),
    {}
  )
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
