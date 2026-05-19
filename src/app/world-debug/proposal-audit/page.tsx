/**
 * 当前文件职责：调试 P7.23 WorldDiffProposal 扩展后的 proposal / validation / audit / SafeApply 链路。
 */

import { validateMapDiffs } from "@/world/map-state/map-diff-validator"
import { buildSafeApplyDecision } from "@/world/world-loop/world-loop-gateway"
import { buildWorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import { buildWorldEvolutionExecution } from "@/world/world-evolution-executor/world-evolution-executor-gateway"
import {
  buildWorldDiffProposal,
  type WorldChangePlan,
  type WorldChangePlanType,
} from "@/world/world-evolution/world-evolution-gateway"

import type {
  HomeMapState,
  HomeZone,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import type {
  ButlerIntentType,
  IntentDecision,
} from "@/world/intent-system/intent-gateway"

type ProposalAuditScenarioName =
  | "plant_nature"
  | "build_path"
  | "clean_area"
  | "repair_facility"

type ProposalAuditScenario = {
  name: ProposalAuditScenarioName
  planType: WorldChangePlanType
  sourceIntentType: ButlerIntentType
  now: number
}

type ProposalAuditScenarioResult = {
  name: ProposalAuditScenarioName
  plan: WorldChangePlan
  proposalType: string
  mapDiffCount: number
  acceptedDiffCount: number
  rejectedDiffCount: number
  auditRisk: string
  canApplySafely: boolean
  executionStatus: string
  safeApplyStatus: string
  appliedMapDiffCount: number
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

type ProposalAuditReport = {
  scenarios: ProposalAuditScenarioResult[]
  summary: {
    scenarioCount: number
    canApplyCount: number
    rejectedCount: number
    noDiffCount: number
  }
}

export default function ProposalAuditPage() {
  const report = buildProposalAuditReport()

  return (
    <main
      style={{
        display: "grid",
        gap: 24,
        maxWidth: 1180,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section>
        <p style={{ margin: 0, opacity: 0.72 }}>AI-PET-WORLD / DEBUG</p>
        <h1>P7.24 Proposal Audit</h1>
        <p>
          本页面只用于调试 proposal / validation / audit / SafeApply
          链路，不代表正式 /world 页面。
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
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
          label="Rejected Count"
          value={String(report.summary.rejectedCount)}
        />
        <MetricCard
          label="No Diff Count"
          value={String(report.summary.noDiffCount)}
        />
      </section>

      <section style={{ display: "grid", gap: 16 }}>
        {report.scenarios.map((scenario) => (
          <ScenarioCard key={scenario.name} scenario={scenario} />
        ))}
      </section>
    </main>
  )
}

function MetricCard(input: { label: string; value: string }) {
  return (
    <article
      style={{
        border: "1px solid currentColor",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <strong>{input.label}</strong>
      <p style={{ margin: "8px 0 0", fontSize: 24 }}>{input.value}</p>
    </article>
  )
}

function ScenarioCard(input: { scenario: ProposalAuditScenarioResult }) {
  const { scenario } = input

  return (
    <article
      style={{
        border: "1px solid currentColor",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h2>{scenario.name}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <MetricCard label="Plan Type" value={scenario.plan.type} />
        <MetricCard label="Plan Priority" value={scenario.plan.priority} />
        <MetricCard label="Plan Scope" value={scenario.plan.scope} />
        <MetricCard label="Proposal Type" value={scenario.proposalType} />
        <MetricCard label="MapDiff Count" value={String(scenario.mapDiffCount)} />
        <MetricCard
          label="Accepted / Rejected"
          value={`${scenario.acceptedDiffCount} / ${scenario.rejectedDiffCount}`}
        />
        <MetricCard label="Audit Risk" value={scenario.auditRisk} />
        <MetricCard
          label="Can Apply Safely"
          value={String(scenario.canApplySafely)}
        />
        <MetricCard label="Execution Status" value={scenario.executionStatus} />
        <MetricCard label="SafeApply Status" value={scenario.safeApplyStatus} />
        <MetricCard
          label="Applied MapDiff"
          value={String(scenario.appliedMapDiffCount)}
        />
      </div>

      <TextList title="Blockers" items={scenario.blockers} />
      <TextList title="Warnings" items={scenario.warnings} />
      <TextList title="Notes" items={scenario.notes} />

      <section>
        <h3>MapDiff summaries</h3>
        {scenario.mapDiffSummaries.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {scenario.mapDiffSummaries.map((diff) => (
              <article
                key={diff.id}
                style={{
                  border: "1px solid currentColor",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <p>
                  <strong>{diff.operation}</strong> / {diff.placementId}
                </p>
                <p>{diff.reason}</p>
                <p>{diff.tags.join(" / ")}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>没有 MapDiff。</p>
        )}
      </section>
    </article>
  )
}

function TextList(input: { title: string; items: string[] }) {
  return (
    <section>
      <h3>{input.title}</h3>
      {input.items.length > 0 ? (
        <ul>
          {input.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>无。</p>
      )}
    </section>
  )
}

function buildProposalAuditReport(): ProposalAuditReport {
  const homeMapState = buildDebugHomeMapState()
  const scenarios: ProposalAuditScenario[] = [
    {
      name: "plant_nature",
      planType: "plant_nature",
      sourceIntentType: "plant",
      now: 1700000000010,
    },
    {
      name: "build_path",
      planType: "build_path",
      sourceIntentType: "build",
      now: 1700000000020,
    },
    {
      name: "clean_area",
      planType: "clean_area",
      sourceIntentType: "maintain",
      now: 1700000000030,
    },
    {
      name: "repair_facility",
      planType: "repair_facility",
      sourceIntentType: "maintain",
      now: 1700000000040,
    },
  ]
  const scenarioResults = scenarios.map((scenario) =>
    buildProposalAuditScenarioResult({
      homeMapState,
      scenario,
    })
  )

  return {
    scenarios: scenarioResults,
    summary: {
      scenarioCount: scenarioResults.length,
      canApplyCount: scenarioResults.filter((item) => item.canApplySafely)
        .length,
      rejectedCount: scenarioResults.reduce(
        (sum, item) => sum + item.rejectedDiffCount,
        0
      ),
      noDiffCount: scenarioResults.filter((item) => item.mapDiffCount === 0)
        .length,
    },
  }
}

function buildProposalAuditScenarioResult(input: {
  homeMapState: HomeMapState
  scenario: ProposalAuditScenario
}): ProposalAuditScenarioResult {
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

  return {
    name: input.scenario.name,
    plan,
    proposalType: proposal.type,
    mapDiffCount: proposal.mapDiffs.length,
    acceptedDiffCount: validation.acceptedDiffs.length,
    rejectedDiffCount: validation.rejectedDiffs.length,
    auditRisk: audit.summary.riskLevel,
    canApplySafely: audit.summary.canApplySafely,
    executionStatus: execution.status,
    safeApplyStatus: safeApply.status,
    appliedMapDiffCount: safeApply.appliedMapDiffCount,
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

function buildDebugIntentDecision(input: {
  intentType: ButlerIntentType
  score: number
}): IntentDecision {
  return {
    selectedIntent: {
      type: input.intentType,
      score: input.score,
      urgency: "high",
      reason: `P7.24 debug scenario forces ${input.intentType}.`,
      drivers: ["P7.24 proposal audit scenario"],
      blockers: [],
      tags: ["proposal_audit_debug_intent", `intent:${input.intentType}`],
    },
    candidates: [],
    shouldAct: input.intentType !== "do_nothing",
    decisionReason: `P7.24 debug scenario selected ${input.intentType}.`,
    tags: ["proposal_audit_debug_decision", `selected:${input.intentType}`],
  }
}

function buildDebugWorldChangePlan(input: {
  scenario: ProposalAuditScenario
  decision: IntentDecision
}): WorldChangePlan {
  return {
    id: `proposal-audit-plan-${input.scenario.name}`,
    type: input.scenario.planType,
    status: "proposed",
    sourceIntentType: input.scenario.sourceIntentType,
    sourceIntentScore: input.decision.selectedIntent.score,
    priority: "high",
    scope: buildDebugPlanScope(input.scenario.planType),
    riskHints: ["low_risk"],
    shouldGenerateDiff: true,
    target: buildDebugTarget(input.scenario.planType),
    reason: `P7.24 debug scenario for ${input.scenario.planType}.`,
    blockers: [],
    tags: [
      "proposal_audit_debug_plan",
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

function buildDebugHomeMapState(): HomeMapState {
  const zones: HomeZone[] = [
    {
      id: "debug-zone-visual-center",
      type: "visual_center",
      name: "Debug Visual Center",
      purpose: "P7.24 proposal audit visual center.",
      bounds: { x: 4, y: 4, width: 10, height: 6 },
      tags: ["proposal_audit_zone", "visual_center"],
    },
    {
      id: "debug-zone-natural-boundary",
      type: "natural_boundary",
      name: "Debug Natural Boundary",
      purpose: "P7.24 proposal audit natural boundary.",
      bounds: { x: 16, y: 4, width: 6, height: 6 },
      tags: ["proposal_audit_zone", "natural_boundary"],
    },
    {
      id: "debug-zone-initial-care",
      type: "initial_care",
      name: "Debug Initial Care",
      purpose: "P7.24 proposal audit care area.",
      bounds: { x: 4, y: 11, width: 8, height: 4 },
      tags: ["proposal_audit_zone", "initial_care"],
    },
    {
      id: "debug-zone-temporary-shelter",
      type: "temporary_shelter",
      name: "Debug Temporary Shelter",
      purpose: "P7.24 proposal audit shelter area.",
      bounds: { x: 14, y: 11, width: 6, height: 4 },
      tags: ["proposal_audit_zone", "temporary_shelter"],
    },
  ]
  const placements: MapPlacement[] = [
    {
      id: "debug-care-facility-01",
      assetId: "facilityLampOn01",
      x: 6,
      y: 12,
      layer: "facility",
      scale: 1,
      alpha: 0.92,
      label: "Debug 照护设施",
      source: "construction_plan",
      tags: ["care", "maintenance", "repairable"],
    },
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
      id: "debug-shelter-01",
      assetId: "buildingTempShelter01",
      x: 15,
      y: 12,
      layer: "structure",
      scale: 1,
      alpha: 1,
      label: "Debug 临时住所",
      source: "construction_plan",
      tags: ["temporary_shelter"],
    },
  ]

  return {
    worldId: "debug-world-proposal-audit",
    ownerId: "debug-owner-proposal-audit",
    seed: "proposal-audit-seed",
    mapSize: { columns: 24, rows: 16, tileSize: 32 },
    zones,
    placements,
    resources: {
      groundHealth: 80,
      naturalGrowth: 75,
      materialReadiness: 80,
      careReadiness: 70,
      spacePressure: 45,
      tags: ["debug_resources"],
    },
    constructionPlans: [
      {
        id: "debug-plan-01",
        title: "Debug proposal audit plan",
        targetZoneType: "visual_center",
        status: "active",
        progress: 30,
        reason: "用于 P7.24 proposal audit。",
        tags: ["debug_plan"],
      },
    ],
    mapDiffs: [],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    tags: ["proposal_audit_home_map_state"],
  }
}
