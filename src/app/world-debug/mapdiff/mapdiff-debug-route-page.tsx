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
import {
  buildWorldEngineDebugScenario,
} from "@/world/debug-scenarios/world-debug-scenario-gateway"
import type { EnvironmentState } from "@/world/environment/environment-gateway"
import type { PlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import type { IntentDecision } from "@/world/intent-system/intent-gateway"
import type { MapDiffValidationResult } from "@/world/map-state/map-diff-validator"
import type {
  WorldChangePlan,
  WorldDiffProposal,
} from "@/world/world-evolution/world-evolution-gateway"
import type { WorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import type { WorldEvolutionExecutionResult } from "@/world/world-evolution-executor/world-evolution-executor-gateway"

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

  const worldEngineDebugScenario = useMemo(() => {
    if (!debugResult) return null

    return buildWorldEngineDebugScenario({
      debugResult,
      petPreset,
    })
  }, [debugResult, petPreset])

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
          value={mapEnvironmentSummary(
            worldEngineDebugScenario?.initial.environmentState ?? null
          )}
        />
        <DebugCard
          title="Initial Butler Intent Decision Summary"
          value={mapIntentDecisionSummary(
            worldEngineDebugScenario?.initial.butlerIntentDecision ?? null
          )}
        />
        <DebugCard
          title="Initial Butler Intent Candidates"
          value={mapIntentCandidateTable(
            worldEngineDebugScenario?.initial.butlerIntentDecision ?? null
          )}
        />
        <DebugCard
          title="Initial World Change Plan"
          value={mapWorldChangePlan(
            worldEngineDebugScenario?.initial.worldChangePlan ?? null
          )}
        />
        <DebugCard
          title="Initial World Diff Proposal"
          value={mapWorldDiffProposal(
            worldEngineDebugScenario?.initial.worldDiffProposal ?? null
          )}
        />
        <DebugCard
          title="Initial World Diff Proposal Validation"
          value={mapMapDiffValidationResult(
            worldEngineDebugScenario?.initial.worldDiffProposalValidation ??
              null
          )}
        />
        <DebugCard
          title="Initial World Evolution Audit"
          value={mapWorldEvolutionAudit(
            worldEngineDebugScenario?.initial.worldEvolutionAudit ?? null
          )}
        />
        <DebugCard
          title="Initial World Evolution Execution"
          value={mapWorldEvolutionExecution(
            worldEngineDebugScenario?.initial.worldEvolutionExecution ?? null
          )}
        />
        <DebugCard
          title="Initial Terrain Cell Sample"
          value={mapTerrainCellSample(
            worldEngineDebugScenario?.initial.environmentState ?? null
          )}
        />
        <DebugCard
          title="Initial Placement Geometry Audit Summary"
          value={
            worldEngineDebugScenario?.initial.placementGeometryAudit.summary
          }
        />
        <DebugCard
          title="Initial Placement Geometry Audit Rejected Items"
          value={mapRejectedPlacementGeometryAuditItems(
            worldEngineDebugScenario?.initial.placementGeometryAudit.items ?? []
          )}
        />
        <DebugCard
          title="Initial Placement Geometry Audit Unmapped Sample"
          value={mapUnmappedPlacementGeometryAuditItems(
            worldEngineDebugScenario?.initial.placementGeometryAudit.items ?? []
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
          value={mapEnvironmentSummary(
            worldEngineDebugScenario?.next.environmentState ?? null
          )}
        />
        <DebugCard
          title="Next Butler Intent Decision Summary"
          value={mapIntentDecisionSummary(
            worldEngineDebugScenario?.next.butlerIntentDecision ?? null
          )}
        />
        <DebugCard
          title="Next Butler Intent Candidates"
          value={mapIntentCandidateTable(
            worldEngineDebugScenario?.next.butlerIntentDecision ?? null
          )}
        />
        <DebugCard
          title="Next World Change Plan"
          value={mapWorldChangePlan(
            worldEngineDebugScenario?.next.worldChangePlan ?? null
          )}
        />
        <DebugCard
          title="Next World Diff Proposal"
          value={mapWorldDiffProposal(
            worldEngineDebugScenario?.next.worldDiffProposal ?? null
          )}
        />
        <DebugCard
          title="Next World Diff Proposal Validation"
          value={mapMapDiffValidationResult(
            worldEngineDebugScenario?.next.worldDiffProposalValidation ?? null
          )}
        />
        <DebugCard
          title="Next World Evolution Audit"
          value={mapWorldEvolutionAudit(
            worldEngineDebugScenario?.next.worldEvolutionAudit ?? null
          )}
        />
        <DebugCard
          title="Next World Evolution Execution"
          value={mapWorldEvolutionExecution(
            worldEngineDebugScenario?.next.worldEvolutionExecution ?? null
          )}
        />
        <DebugCard
          title="Next Terrain Cell Sample"
          value={mapTerrainCellSample(
            worldEngineDebugScenario?.next.environmentState ?? null
          )}
        />
        <DebugCard
          title="Next Placement Geometry Audit Summary"
          value={worldEngineDebugScenario?.next.placementGeometryAudit.summary}
        />
        <DebugCard
          title="Next Placement Geometry Audit Rejected Items"
          value={mapRejectedPlacementGeometryAuditItems(
            worldEngineDebugScenario?.next.placementGeometryAudit.items ?? []
          )}
        />
        <DebugCard
          title="Next Placement Geometry Audit Unmapped Sample"
          value={mapUnmappedPlacementGeometryAuditItems(
            worldEngineDebugScenario?.next.placementGeometryAudit.items ?? []
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
  environment: EnvironmentState | null
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

function mapTerrainCellSample(environment: EnvironmentState | null) {
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

function mapIntentDecisionSummary(decision: IntentDecision | null) {
  if (!decision) return null

  return {
    shouldAct: decision.shouldAct,
    decisionReason: decision.decisionReason,
    selectedIntent: {
      type: decision.selectedIntent.type,
      score: decision.selectedIntent.score,
      urgency: decision.selectedIntent.urgency,
      reason: decision.selectedIntent.reason,
      drivers: decision.selectedIntent.drivers,
      blockers: decision.selectedIntent.blockers,
      tags: decision.selectedIntent.tags,
    },
    tags: decision.tags,
  }
}

function mapIntentCandidateTable(decision: IntentDecision | null) {
  if (!decision) return []

  return decision.candidates.map((candidate) => ({
    type: candidate.type,
    score: candidate.score,
    urgency: candidate.urgency,
    drivers: candidate.drivers,
    blockers: candidate.blockers,
    reason: candidate.reason,
  }))
}

function mapWorldChangePlan(plan: WorldChangePlan | null) {
  if (!plan) return null

  return {
    id: plan.id,
    type: plan.type,
    status: plan.status,
    sourceIntentType: plan.sourceIntentType,
    sourceIntentScore: plan.sourceIntentScore,
    shouldGenerateDiff: plan.shouldGenerateDiff,
    target: plan.target,
    reason: plan.reason,
    blockers: plan.blockers,
    tags: plan.tags,
  }
}

function mapWorldDiffProposal(proposal: WorldDiffProposal | null) {
  if (!proposal) return null

  return {
    id: proposal.id,
    type: proposal.type,
    planId: proposal.planId,
    acceptedForPlanning: proposal.acceptedForPlanning,
    mapDiffCount: proposal.mapDiffs.length,
    reason: proposal.reason,
    warnings: proposal.warnings,
    tags: proposal.tags,
    mapDiffs: proposal.mapDiffs.map(mapMapDiffForDebug),
  }
}

function mapMapDiffValidationResult(
  validation: MapDiffValidationResult | null
) {
  if (!validation) return null

  return {
    acceptedCount: validation.acceptedDiffs.length,
    rejectedCount: validation.rejectedDiffs.length,
    warnings: validation.warnings,
    acceptedDiffs: validation.acceptedDiffs.map(mapMapDiffForDebug),
    rejectedDiffs: validation.rejectedDiffs.map((item) => ({
      reason: item.reason,
      diffId: item.diff.id,
      placementId: item.diff.placementId,
      operation: item.diff.operation,
      tags: item.tags,
    })),
  }
}

function mapWorldEvolutionAudit(report: WorldEvolutionAuditReport | null) {
  if (!report) return null

  return {
    id: report.id,
    checkedAt: report.checkedAt,
    summary: report.summary,
    blockers: report.blockers,
    warnings: report.warnings,
    rejectedReasons: report.rejectedReasons,
    notes: report.notes,
    tags: report.tags,
  }
}

function mapWorldEvolutionExecution(
  result: WorldEvolutionExecutionResult | null
) {
  if (!result) return null

  return {
    id: result.id,
    status: result.status,
    appliedMapDiffCount: result.appliedMapDiffCount,
    messages: result.messages,
    blockedReasons: result.blockedReasons,
    tags: result.tags,
    nextHomeMapStateSummary: {
      placementCount: result.nextHomeMapState.placements.length,
      mapDiffCount: result.nextHomeMapState.mapDiffs.length,
      updatedAt: result.nextHomeMapState.updatedAt,
    },
  }
}

function mapMapDiffForDebug(
  diff: MapDiffValidationResult["acceptedDiffs"][number]
) {
  return {
    id: diff.id,
    operation: diff.operation,
    placementId: diff.placementId,
    reason: diff.reason,
    tags: diff.tags,
    placement: diff.placement
      ? {
          id: diff.placement.id,
          assetId: diff.placement.assetId,
          x: diff.placement.x,
          y: diff.placement.y,
          layer: diff.placement.layer,
          label: diff.placement.label,
          tags: diff.placement.tags,
        }
      : null,
  }
}

function mapRejectedPlacementGeometryAuditItems(
  items: PlacementGeometryAuditReport["items"]
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
  items: PlacementGeometryAuditReport["items"]
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
