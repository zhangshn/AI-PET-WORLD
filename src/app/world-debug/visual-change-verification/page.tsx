/**
 * 当前文件职责：验证 P8.2 几何 / 程序化视觉预览能否显示 P7.23 世界变化结果。
 */

import { ProceduralRendererView } from "@/app/world/components/procedural-renderer/procedural-renderer-view"
import type {
  ButlerIntentType,
  IntentDecision,
} from "@/world/intent-system/intent-gateway"
import type {
  HomeMapState,
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import { validateMapDiffs } from "@/world/map-state/map-diff-validator"
import type { RenderableWorldSnapshot } from "@/world/rendering/renderer-gateway"
import {
  buildSafeApplyDecision,
  buildWorldLoopRenderableState,
} from "@/world/world-loop/world-loop-gateway"
import { buildWorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import { buildWorldEvolutionExecution } from "@/world/world-evolution-executor/world-evolution-executor-gateway"
import {
  buildWorldDiffProposal,
  type WorldChangePlan,
  type WorldChangePlanType,
} from "@/world/world-evolution/world-evolution-gateway"

type VisualChangeScenarioName =
  | "plant_nature"
  | "build_path"
  | "clean_area"
  | "repair_facility"

type VisualChangeScenario = {
  name: VisualChangeScenarioName
  planType: WorldChangePlanType
  sourceIntentType: ButlerIntentType
  now: number
}

type VisualChangeScenarioResult = {
  name: VisualChangeScenarioName
  planType: WorldChangePlanType
  beforeSnapshot: RenderableWorldSnapshot
  afterSnapshot: RenderableWorldSnapshot
  proposalMapDiffCount: number
  acceptedDiffCount: number
  rejectedDiffCount: number
  auditRisk: string
  canApplySafely: boolean
  executionStatus: string
  safeApplyStatus: string
  appliedMapDiffCount: number
  beforePlacementCount: number
  afterPlacementCount: number
  placementDelta: number
  beforeMapDiffCount: number
  afterMapDiffCount: number
  mapDiffDelta: number
  visualExpectedChange: string
  blockers: string[]
  warnings: string[]
  notes: string[]
  mapDiffSummaries: Array<{
    id: string
    operation: string
    placementId: string
    reason: string
    tags: string[]
  }>
}

type VisualChangeVerificationReport = {
  scenarios: VisualChangeScenarioResult[]
  summary: {
    scenarioCount: number
    canApplyCount: number
    totalAppliedMapDiffCount: number
    totalPlacementDelta: number
    totalMapDiffDelta: number
  }
}

export default function VisualChangeVerificationPage() {
  const report = buildVisualChangeVerificationReport()

  return (
    <main
      style={{
        display: "grid",
        gap: 24,
        margin: "0 auto",
        maxWidth: 1480,
        padding: 24,
      }}
    >
      <section
        style={{
          border: "1px solid currentColor",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <p>AI-PET-WORLD / DEBUG</p>
        <h1>P8.3 Visual Change Verification</h1>
        <p>
          本页面用于验证 P7.23 的世界变化，在 SafeApply 之后是否能通过
          P8.2 几何 / 程序化视觉预览显示。
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <MetricCard
          label="Scenario Count"
          value={String(report.summary.scenarioCount)}
        />
        <MetricCard
          label="Can Apply Count"
          value={String(report.summary.canApplyCount)}
        />
        <MetricCard
          label="Applied MapDiff Count"
          value={String(report.summary.totalAppliedMapDiffCount)}
        />
        <MetricCard
          label="Placement Delta"
          value={String(report.summary.totalPlacementDelta)}
        />
        <MetricCard
          label="MapDiff Delta"
          value={String(report.summary.totalMapDiffDelta)}
        />
      </section>

      <section style={{ display: "grid", gap: 24 }}>
        {report.scenarios.map((scenario) => (
          <ScenarioCard key={scenario.name} scenario={scenario} />
        ))}
      </section>
    </main>
  )
}

function MetricCard(input: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid currentColor",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <p style={{ margin: "0 0 8px" }}>{input.label}</p>
      <strong style={{ fontSize: 24 }}>{input.value}</strong>
    </div>
  )
}

function TextList(input: { title: string; items: string[] }) {
  return (
    <section
      style={{
        border: "1px solid currentColor",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <h4 style={{ margin: "0 0 8px" }}>
        {input.title} ({input.items.length})
      </h4>
      {input.items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {input.items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0 }}>无</p>
      )}
    </section>
  )
}

function MapDiffSummaryList(input: {
  items: VisualChangeScenarioResult["mapDiffSummaries"]
}) {
  return (
    <section
      style={{
        border: "1px solid currentColor",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <h4 style={{ margin: "0 0 8px" }}>
        MapDiff Summaries ({input.items.length})
      </h4>
      {input.items.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {input.items.map((item) => (
            <article
              key={item.id}
              style={{
                border: "1px dashed currentColor",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <p style={{ margin: "0 0 4px" }}>
                <strong>{item.operation}</strong> / {item.placementId}
              </p>
              <p style={{ margin: "0 0 4px" }}>{item.reason}</p>
              <p style={{ margin: 0 }}>{item.tags.join(" / ")}</p>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0 }}>没有 MapDiff。</p>
      )}
    </section>
  )
}

function ScenarioCard(input: { scenario: VisualChangeScenarioResult }) {
  const { scenario } = input

  return (
    <article
      style={{
        border: "2px solid currentColor",
        borderRadius: 16,
        display: "grid",
        gap: 16,
        padding: 20,
      }}
    >
      <header>
        <p style={{ margin: "0 0 6px" }}>Scenario</p>
        <h2 style={{ margin: 0 }}>{scenario.name}</h2>
        <p>{scenario.visualExpectedChange}</p>
      </header>

      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <MetricCard label="Plan Type" value={scenario.planType} />
        <MetricCard
          label="Proposal MapDiff"
          value={String(scenario.proposalMapDiffCount)}
        />
        <MetricCard
          label="Accepted / Rejected"
          value={`${scenario.acceptedDiffCount} / ${scenario.rejectedDiffCount}`}
        />
        <MetricCard label="Audit Risk" value={scenario.auditRisk} />
        <MetricCard
          label="Can Apply Safely"
          value={String(scenario.canApplySafely)}
        />
        <MetricCard
          label="Execution Status"
          value={scenario.executionStatus}
        />
        <MetricCard
          label="SafeApply Status"
          value={scenario.safeApplyStatus}
        />
        <MetricCard
          label="Applied MapDiff"
          value={String(scenario.appliedMapDiffCount)}
        />
        <MetricCard
          label="Before / After Placement"
          value={`${scenario.beforePlacementCount} / ${scenario.afterPlacementCount}`}
        />
        <MetricCard
          label="Before / After MapDiff"
          value={`${scenario.beforeMapDiffCount} / ${scenario.afterMapDiffCount}`}
        />
        <MetricCard
          label="Placement Delta"
          value={String(scenario.placementDelta)}
        />
        <MetricCard
          label="MapDiff Delta"
          value={String(scenario.mapDiffDelta)}
        />
      </section>

      <section
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <TextList title="Blockers" items={scenario.blockers} />
        <TextList title="Warnings" items={scenario.warnings} />
        <TextList title="Notes" items={scenario.notes} />
      </section>

      <MapDiffSummaryList items={scenario.mapDiffSummaries} />

      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        }}
      >
        <section>
          <h3>Before</h3>
          <ProceduralRendererView snapshot={scenario.beforeSnapshot} />
        </section>
        <section>
          <h3>After SafeApply</h3>
          <ProceduralRendererView snapshot={scenario.afterSnapshot} />
        </section>
      </section>
    </article>
  )
}

function buildVisualChangeVerificationReport(): VisualChangeVerificationReport {
  const scenarios: VisualChangeScenario[] = [
    {
      name: "plant_nature",
      planType: "plant_nature",
      sourceIntentType: "plant",
      now: 1700000001010,
    },
    {
      name: "build_path",
      planType: "build_path",
      sourceIntentType: "build",
      now: 1700000001020,
    },
    {
      name: "clean_area",
      planType: "clean_area",
      sourceIntentType: "maintain",
      now: 1700000001030,
    },
    {
      name: "repair_facility",
      planType: "repair_facility",
      sourceIntentType: "maintain",
      now: 1700000001040,
    },
  ]

  const scenarioResults = scenarios.map((scenario) =>
    buildVisualChangeScenarioResult({
      scenario,
      homeMapState: buildDebugHomeMapState({
        scenarioName: scenario.name,
      }),
    })
  )

  return {
    scenarios: scenarioResults,
    summary: {
      scenarioCount: scenarioResults.length,
      canApplyCount: scenarioResults.filter((item) => item.canApplySafely)
        .length,
      totalAppliedMapDiffCount: scenarioResults.reduce(
        (sum, item) => sum + item.appliedMapDiffCount,
        0
      ),
      totalPlacementDelta: scenarioResults.reduce(
        (sum, item) => sum + item.placementDelta,
        0
      ),
      totalMapDiffDelta: scenarioResults.reduce(
        (sum, item) => sum + item.mapDiffDelta,
        0
      ),
    },
  }
}

function buildVisualChangeScenarioResult(input: {
  scenario: VisualChangeScenario
  homeMapState: HomeMapState
}): VisualChangeScenarioResult {
  const decision = buildDebugIntentDecision({
    intentType: input.scenario.sourceIntentType,
    score: 88,
  })
  const plan = buildDebugWorldChangePlan({
    scenario: input.scenario,
    decision,
  })
  const proposal = buildWorldDiffProposal({
    homeMapState: input.homeMapState,
    plan,
    now: input.scenario.now,
  })
  const validation = validateMapDiffs({
    homeMapState: input.homeMapState,
    mapDiffs: proposal.mapDiffs,
  })
  const audit = buildWorldEvolutionAuditReport({
    checkedAt: input.scenario.now,
    decision,
    plan,
    proposal,
    validation,
  })
  const execution = buildWorldEvolutionExecution({
    homeMapState: input.homeMapState,
    proposal,
    audit,
    now: input.scenario.now,
  })
  const safeApply = buildSafeApplyDecision({
    previousHomeMapState: input.homeMapState,
    proposal,
    validation,
    audit,
    execution,
  })
  const afterHomeMapState = safeApply.canUseNextHomeMapState
    ? safeApply.nextHomeMapState
    : input.homeMapState
  const beforeRenderableState = buildWorldLoopRenderableState({
    homeMapState: input.homeMapState,
    now: input.scenario.now - 1,
  })
  const afterRenderableState = buildWorldLoopRenderableState({
    homeMapState: afterHomeMapState,
    now: input.scenario.now,
  })

  return {
    name: input.scenario.name,
    planType: input.scenario.planType,
    beforeSnapshot: beforeRenderableState.renderableWorldSnapshot,
    afterSnapshot: afterRenderableState.renderableWorldSnapshot,
    proposalMapDiffCount: proposal.mapDiffs.length,
    acceptedDiffCount: validation.acceptedDiffs.length,
    rejectedDiffCount: validation.rejectedDiffs.length,
    auditRisk: audit.summary.riskLevel,
    canApplySafely: audit.summary.canApplySafely,
    executionStatus: execution.status,
    safeApplyStatus: safeApply.status,
    appliedMapDiffCount: safeApply.appliedMapDiffCount,
    beforePlacementCount: input.homeMapState.placements.length,
    afterPlacementCount: afterHomeMapState.placements.length,
    placementDelta:
      afterHomeMapState.placements.length - input.homeMapState.placements.length,
    beforeMapDiffCount: input.homeMapState.mapDiffs.length,
    afterMapDiffCount: afterHomeMapState.mapDiffs.length,
    mapDiffDelta:
      afterHomeMapState.mapDiffs.length - input.homeMapState.mapDiffs.length,
    visualExpectedChange: buildVisualExpectedChange(input.scenario.name),
    blockers: [...plan.blockers, ...audit.blockers, ...safeApply.blockers],
    warnings: [
      ...proposal.warnings,
      ...validation.warnings,
      ...audit.warnings,
      ...safeApply.warnings,
    ],
    notes: [...audit.notes, ...safeApply.reasons],
    mapDiffSummaries: proposal.mapDiffs.map((diff) => ({
      id: diff.id,
      operation: diff.operation,
      placementId: diff.placementId,
      reason: diff.reason,
      tags: diff.tags,
    })),
  }
}

function buildVisualExpectedChange(
  scenarioName: VisualChangeScenarioName
): string {
  if (scenarioName === "plant_nature") {
    return "After 画面应新增小花 / 自然细节。"
  }

  if (scenarioName === "build_path") {
    return "After 画面应新增泥土路径。"
  }

  if (scenarioName === "clean_area") {
    return "After 画面中的可清理落叶 / surface-decoration 应消失。"
  }

  return "After 画面中的照护设施应被维护，至少 label / alpha / tags 发生变化。"
}

function buildDebugIntentDecision(input: {
  intentType: ButlerIntentType
  score: number
}): IntentDecision {
  return {
    selectedIntent: {
      type: input.intentType,
      score: input.score,
      urgency: "high",
      reason: `P8.3 visual verification forces ${input.intentType}.`,
      drivers: ["P8.3 visual change verification scenario"],
      blockers: [],
      tags: ["visual_change_debug_intent", `intent:${input.intentType}`],
    },
    candidates: [],
    shouldAct: input.intentType !== "do_nothing",
    decisionReason: `P8.3 visual verification selected ${input.intentType}.`,
    tags: ["visual_change_debug_decision", `selected:${input.intentType}`],
  }
}

function buildDebugWorldChangePlan(input: {
  scenario: VisualChangeScenario
  decision: IntentDecision
}): WorldChangePlan {
  return {
    id: `visual-change-plan-${input.scenario.name}`,
    type: input.scenario.planType,
    status: "proposed",
    sourceIntentType: input.scenario.sourceIntentType,
    sourceIntentScore: input.decision.selectedIntent.score,
    priority: "high",
    scope: buildDebugPlanScope(input.scenario.planType),
    riskHints: ["low_risk"],
    shouldGenerateDiff: true,
    target: buildDebugTarget(input.scenario.planType),
    reason: `P8.3 visual verification for ${input.scenario.planType}.`,
    blockers: [],
    tags: [
      "visual_change_debug_plan",
      `plan_type:${input.scenario.planType}`,
      `scenario:${input.scenario.name}`,
    ],
  }
}

function buildDebugPlanScope(
  planType: WorldChangePlanType
): WorldChangePlan["scope"] {
  if (planType === "build_path") return "single_zone"
  if (planType === "clean_area") return "single_zone"
  if (planType === "repair_facility") return "single_placement"
  if (planType === "plant_nature") return "single_placement"

  return "observation_only"
}

function buildDebugTarget(
  planType: WorldChangePlanType
): WorldChangePlan["target"] {
  if (planType === "plant_nature") {
    return {
      zoneType: "natural_boundary",
      placementLayer: "nature",
      preferredAssetTags: ["nature", "plant"],
      tags: ["debug_target", "target:natural_boundary"],
    }
  }

  if (planType === "build_path") {
    return {
      zoneType: "visual_center",
      placementLayer: "path",
      preferredAssetTags: ["path", "walkable"],
      tags: ["debug_target", "target:visual_center"],
    }
  }

  if (planType === "clean_area") {
    return {
      zoneType: "visual_center",
      placementLayer: "surface-decoration",
      preferredAssetTags: ["cleanup"],
      tags: ["debug_target", "target:visual_center"],
    }
  }

  if (planType === "repair_facility") {
    return {
      zoneType: "initial_care",
      placementLayer: "facility",
      preferredAssetTags: ["care", "repairable"],
      tags: ["debug_target", "target:initial_care"],
    }
  }

  return {
    tags: ["debug_target", "no_target"],
  }
}

function buildDebugHomeMapState(input: {
  scenarioName: VisualChangeScenarioName
}): HomeMapState {
  return {
    worldId: `debug-world-visual-change-${input.scenarioName}`,
    ownerId: "debug-owner-visual-change",
    seed: `visual-change-seed-${input.scenarioName}`,
    mapSize: { columns: 18, rows: 12, tileSize: 32 },
    zones: buildDebugZones(),
    placements: [
      ...buildGroundPlacements(),
      {
        id: "debug-cleanable-leaf-01",
        assetId: "surfaceFallenLeaf01",
        x: 7,
        y: 6,
        layer: "surface-decoration",
        scale: 1,
        alpha: 1,
        label: "Debug 可清理落叶",
        source: "construction_plan",
        tags: ["clutter", "fallen_leaf", "cleanup", "natural_detail"],
      },
      {
        id: "debug-care-facility-01",
        assetId: "facilityLampOn01",
        x: 6,
        y: 10,
        layer: "facility",
        scale: 1,
        alpha: 0.9,
        label: "Debug 照护设施",
        source: "construction_plan",
        tags: ["care", "maintenance", "repairable"],
      },
      {
        id: "debug-existing-path-01",
        assetId: "pathDirtHorizontal01",
        x: 5,
        y: 5,
        layer: "path",
        scale: 1,
        alpha: 1,
        label: "Debug 已有路径",
        source: "construction_plan",
        tags: ["path", "existing_path"],
      },
      {
        id: "debug-tree-01",
        assetId: "natureTreeSmall01",
        x: 14,
        y: 7,
        layer: "nature",
        scale: 1,
        alpha: 1,
        label: "Debug 小树",
        source: "construction_plan",
        tags: ["nature", "tree"],
      },
      {
        id: "debug-shelter-01",
        assetId: "buildingTempShelter01",
        x: 13,
        y: 11,
        layer: "structure",
        scale: 1,
        alpha: 1,
        label: "Debug 临时住所",
        source: "construction_plan",
        tags: ["temporary_shelter"],
      },
    ],
    resources: {
      groundHealth: 80,
      naturalGrowth: 75,
      materialReadiness: 80,
      careReadiness: 70,
      spacePressure: 35,
      tags: ["debug_resources"],
    },
    constructionPlans: [
      {
        id: "debug-plan-01",
        title: "Debug visual change verification plan",
        targetZoneType: "visual_center",
        status: "active",
        progress: 40,
        reason: "用于 P8.3 visual change verification。",
        tags: ["debug_plan", "visual_change_verification"],
      },
    ],
    mapDiffs: [],
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
    tags: ["visual_change_home_map_state", `scenario:${input.scenarioName}`],
  }
}

function buildDebugZones(): HomeZone[] {
  return [
    {
      id: "debug-zone-visual-center",
      type: "visual_center",
      name: "Debug 视觉中心",
      purpose: "提供路径与清理验证区域。",
      bounds: { x: 4, y: 4, width: 8, height: 4 },
      tags: ["debug_zone", "visual_center"],
    },
    {
      id: "debug-zone-natural-boundary",
      type: "natural_boundary",
      name: "Debug 自然边界",
      purpose: "提供自然物变化验证区域。",
      bounds: { x: 13, y: 3, width: 4, height: 5 },
      tags: ["debug_zone", "natural_boundary"],
    },
    {
      id: "debug-zone-initial-care",
      type: "initial_care",
      name: "Debug 初始照护",
      purpose: "提供设施修复验证区域。",
      bounds: { x: 4, y: 9, width: 6, height: 3 },
      tags: ["debug_zone", "initial_care"],
    },
    {
      id: "debug-zone-temporary-shelter",
      type: "temporary_shelter",
      name: "Debug 临时住所",
      purpose: "提供结构参照区域。",
      bounds: { x: 11, y: 9, width: 5, height: 3 },
      tags: ["debug_zone", "temporary_shelter"],
    },
  ]
}

function buildGroundPlacements(): MapPlacement[] {
  const placements: MapPlacement[] = []

  for (let y = 1; y <= 12; y += 1) {
    for (let x = 1; x <= 18; x += 1) {
      placements.push({
        id: `debug-ground-${x}-${y}`,
        assetId:
          (x + y) % 5 === 0 ? "groundGrassBase02" : "groundGrassBase01",
        x,
        y,
        layer: "ground",
        scale: 1,
        alpha: 1,
        label: "Debug 草地",
        source: "scene_recipe",
        tags: ["debug_ground", "visual_change_ground"],
      })
    }
  }

  return placements
}
