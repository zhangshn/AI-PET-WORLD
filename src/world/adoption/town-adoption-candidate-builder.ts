/**
 * 当前文件职责：从世界、资源与建设状态生成小镇领养机会观察。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import { buildButlerAdoptionIntents as buildButlerAdoptionIntentList } from "./butler-adoption-intent-candidate"
import { auditAdoptionOpportunityObservations as auditAdoptionOpportunityObservationList } from "./town-adoption-precheck-audit"
import { buildTownAdoptionPrecheckReport as buildTownAdoptionPrecheckReportModel } from "./town-adoption-precheck-report"
import type {
  ButlerAdoptionIntent,
  TownAdoptionPrecheckAudit,
  TownAdoptionBlocker,
  AdoptionOpportunityObservation,
  TownAdoptionPrecheckBuilderInput,
  TownAdoptionPrecheckBuilderResult,
  TownAdoptionReadinessSnapshot,
  TownAdoptionPrecheckReport,
  TownAdoptionResourceReadiness,
  TownAdoptionWorldReadiness,
} from "./town-adoption-precheck-schema"

export function buildTownAdoptionPrecheckBuilderResult(
  input: TownAdoptionPrecheckBuilderInput
): TownAdoptionPrecheckBuilderResult {
  const readiness = buildTownAdoptionReadinessSnapshot(input)
  const adoptionOpportunityObservations = buildAdoptionOpportunityObservationList({
    input,
    readiness,
  })
  const butlerAdoptionIntents = buildButlerAdoptionIntentList({
    adoptionOpportunityObservations,
  })
  const audit = auditAdoptionOpportunityObservationList({
    builderInput: input,
    adoptionOpportunityObservations,
    butlerAdoptionIntents,
  })
  const report = buildTownAdoptionPrecheckReportModel({
    adoptionOpportunityObservations,
    butlerAdoptionIntents,
    audit,
  })

  return {
    adoptionOpportunityObservations,
    butlerAdoptionIntents,
    audit,
    report,
    messages: report.messages,
    tags: [
      "town_adoption_precheck_opportunity_observation_builder_result",
      "town_adoption_precheck_01",
      "town_adoption_deferred_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
      "resource_space_construction_readiness",
    ],
  }
}

export function buildAdoptionOpportunityObservations(
  input: TownAdoptionPrecheckBuilderInput
): AdoptionOpportunityObservation[] {
  const readiness = buildTownAdoptionReadinessSnapshot(input)

  return buildAdoptionOpportunityObservationList({
    input,
    readiness,
  })
}

export function buildButlerAdoptionIntents(input: {
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  tags?: string[]
}): ButlerAdoptionIntent[] {
  return buildButlerAdoptionIntentList({
    adoptionOpportunityObservations: input.adoptionOpportunityObservations,
  })
}

export function auditAdoptionOpportunityObservations(input: {
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  warnings: string[]
}): TownAdoptionPrecheckAudit {
  const butlerAdoptionIntents = buildButlerAdoptionIntentList({
    adoptionOpportunityObservations: input.adoptionOpportunityObservations,
  })
  const worldId = input.adoptionOpportunityObservations[0]?.worldId ?? "unknown-world"
  const ownerId = input.adoptionOpportunityObservations[0]?.ownerId ?? "unknown-owner"
  const readinessScore = input.adoptionOpportunityObservations[0]?.readiness.score ?? 0
  const blockers = input.adoptionOpportunityObservations.flatMap(
    (observation) => observation.blockers
  )
  const warnings = [
    ...input.warnings,
    ...auditForbiddenTokens({
      adoptionOpportunityObservations: input.adoptionOpportunityObservations,
      butlerAdoptionIntents,
    }),
  ]

  return {
    stableTownAdoptionFingerprint: [
      worldId,
      ownerId,
      String(readinessScore),
      input.adoptionOpportunityObservations
        .map((observation) => `${observation.observationId}:${observation.type}`)
        .sort()
        .join("+"),
      butlerAdoptionIntents
        .map((intent) => `${intent.intentId}:${intent.type}`)
        .sort()
        .join("+"),
      blockers
        .map((blocker) => `${blocker.blockerId}:${blocker.severity}`)
        .sort()
        .join("+"),
      warnings.sort().join("+"),
    ].join("::"),
    worldId,
    ownerId,
    adoptionOpportunityObservationIds: input.adoptionOpportunityObservations.map(
      (observation) => observation.observationId
    ),
    butlerAdoptionIntentIds: butlerAdoptionIntents.map(
      (intent) => intent.intentId
    ),
    readinessScore,
    blockerCount: blockers.length,
    warnings,
    tags: [
      "town_adoption_precheck_opportunity_observation_audit",
      "compat_export_from_opportunity_observation_builder",
      "town_adoption_deferred_only",
      warnings.length === 0
        ? "town_adoption_precheck_opportunities_valid"
        : "town_adoption_precheck_opportunities_warning",
    ],
  }
}

export function buildTownAdoptionPrecheckReport(input: {
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  butlerAdoptionIntents: ButlerAdoptionIntent[]
  audit: TownAdoptionPrecheckAudit
}): TownAdoptionPrecheckReport {
  return buildTownAdoptionPrecheckReportModel(input)
}

function buildAdoptionOpportunityObservationList(input: {
  input: TownAdoptionPrecheckBuilderInput
  readiness: TownAdoptionReadinessSnapshot
}): AdoptionOpportunityObservation[] {
  const blockingCount = input.readiness.blockers.filter(
    (blocker) => blocker.severity === "blocking"
  ).length
  const warningCount = input.readiness.blockers.filter(
    (blocker) => blocker.severity === "warning"
  ).length

  if (blockingCount > 0) {
    return [
      buildObservation({
        input: input.input,
        readiness: input.readiness,
        suffix: "dependency-not-ready",
        type: "construction_dependency_not_ready",
        readyForButlerAdoptionIntent: false,
        reason:
          "家园仍存在关键准备项，小镇领养机会保持后置，不进入世界事实。",
        tags: [
          "construction_dependency_not_ready",
          "resource_or_space_blocked",
          "consider",
        ],
      }),
    ]
  }

  if (input.readiness.status === "visit") {
    return [
      buildObservation({
        input: input.input,
        readiness: input.readiness,
        suffix: "world-observable",
        type: "observe_world_ready",
        readyForButlerAdoptionIntent: false,
        reason:
          "家园已经形成可观察的稳定结构，可以记录世界成熟度，但仍不生成领养机会观察。",
        tags: ["observe_world_ready", "world_ready_observation"],
      }),
      buildObservation({
        input: input.input,
        readiness: input.readiness,
        suffix: "future-opportunity",
        type: "adoption_opportunity_later",
        readyForButlerAdoptionIntent: true,
        reason:
          "世界资源、空间与建设状态已接近可接纳阶段，管家未来可能主动前往小镇了解领养信息。",
        tags: [
          "adoption_opportunity_later",
          "future_opportunity_only",
          "no_actor_creation",
        ],
      }),
    ]
  }

  if (input.readiness.status === "observable") {
    return [
      buildObservation({
        input: input.input,
        readiness: input.readiness,
        suffix: "observe-and-wait",
        type: "observe_world_ready",
        readyForButlerAdoptionIntent: false,
        reason:
          warningCount > 0
            ? "管家正在评估资源、空间和照护能力，因此选择继续等待。"
            : "世界已经可以观察，小镇领养机会继续保持后置观察。",
        tags: ["observe_world_ready", "wait"],
      }),
    ]
  }

  if (input.readiness.status === "preparing") {
    return [
      buildObservation({
        input: input.input,
        readiness: input.readiness,
        suffix: "preparing",
        type: "adoption_opportunity_later",
        readyForButlerAdoptionIntent: false,
        reason:
          "家园正在准备中，管家暂未产生领养意愿，当前不能进入领养审查流程。",
        tags: [
          "adoption_opportunity_later",
          "consider",
          "not_ready_yet",
        ],
      }),
    ]
  }

  return [
    buildObservation({
      input: input.input,
      readiness: input.readiness,
      suffix: "no-event",
      type: "no_event",
      readyForButlerAdoptionIntent: false,
      reason: "管家暂未产生领养意愿，当前世界尚未达到领养机会观察门槛。",
      tags: ["no_event", "town_adoption_precheck_waiting"],
    }),
  ]
}

function buildTownAdoptionReadinessSnapshot(
  input: TownAdoptionPrecheckBuilderInput
): TownAdoptionReadinessSnapshot {
  const resourceReadiness = buildResourceReadiness(input)
  const worldReadiness = buildWorldReadiness(input)
  const blockers = buildTownAdoptionBlockers({
    resourceReadiness,
    worldReadiness,
    input,
  })
  const score = clampScore(
    Math.round(resourceReadiness.score * 0.52 + worldReadiness.score * 0.48)
  )
  const status = selectReadinessStatus({
    score,
    blockers,
  })

  return {
    readinessId: [
      "town-adoption-readiness",
      normalizeIdToken(input.homeMapState.worldId),
      String(input.now),
    ].join("-"),
    worldId: input.homeMapState.worldId,
    ownerId: input.homeMapState.ownerId,
    score,
    status,
    resourceReadiness,
    worldReadiness,
    blockers,
    recommendedNextStep: selectRecommendedNextStep({
      status,
      blockers,
      resourceReadiness,
      worldReadiness,
    }),
    tags: [
      "town_adoption_precheck_readiness_snapshot",
      `town_adoption_precheck_status:${status}`,
      `town_adoption_precheck_score:${score}`,
      "no_world_fact_generation",
      "no_actor_creation",
    ],
  }
}

function buildResourceReadiness(
  input: TownAdoptionPrecheckBuilderInput
): TownAdoptionResourceReadiness {
  const resources = input.homeMapState.resources
  const materialReadiness = normalizeResourceValue(resources.materialReadiness)
  const careReadiness = normalizeResourceValue(resources.careReadiness)
  const groundHealth = normalizeResourceValue(resources.groundHealth)
  const naturalGrowth = normalizeResourceValue(resources.naturalGrowth)
  const spacePressure = normalizeResourceValue(resources.spacePressure)
  const invertedSpacePressure = 100 - spacePressure
  const score = clampScore(
    Math.round(
      materialReadiness * 0.24 +
        careReadiness * 0.28 +
        groundHealth * 0.18 +
        naturalGrowth * 0.16 +
        invertedSpacePressure * 0.14
    )
  )
  const status =
    score >= 74
      ? "ready"
      : score >= 56
        ? "stable"
        : score >= 38
          ? "limited"
          : "scarce"

  return {
    materialReadiness,
    careReadiness,
    groundHealth,
    naturalGrowth,
    spacePressure,
    score,
    status,
    reasons: [
      `材料准备度 ${materialReadiness}`,
      `照护准备度 ${careReadiness}`,
      `土地状态 ${groundHealth}`,
      `自然生长 ${naturalGrowth}`,
      `空间压力 ${spacePressure}`,
    ],
  }
}

function buildWorldReadiness(
  input: TownAdoptionPrecheckBuilderInput
): TownAdoptionWorldReadiness {
  const acceptedDiffCount =
    input.constructionBridgeResult?.verticalSliceResult.fullPipelineAudit
      .acceptedDiffIds.length ?? 0
  const mapDiffCount = input.homeMapState.mapDiffs.length
  const constructionPlanCount = input.homeMapState.constructionPlans.length
  const hasHouseStyle = Boolean(input.homeMapState.houseStyle)
  const hasStableShelterSignal = hasZoneOrPlanSignal({
    input,
    keywords: ["shelter", "temporary_shelter", "house", "home"],
  })
  const hasCareSignal = hasZoneOrPlanSignal({
    input,
    keywords: ["care", "initial_care"],
  })
  const hasQuietZoneSignal = hasZoneOrPlanSignal({
    input,
    keywords: ["quiet", "quiet_living"],
  })
  const score = clampScore(
    Math.round(
      Math.min(24, acceptedDiffCount * 12) +
        Math.min(18, mapDiffCount * 6) +
        Math.min(16, constructionPlanCount * 4) +
        (hasHouseStyle ? 18 : 0) +
        (hasStableShelterSignal ? 10 : 0) +
        (hasCareSignal ? 8 : 0) +
        (hasQuietZoneSignal ? 6 : 0)
    )
  )
  const status =
    score >= 72
      ? "ready"
      : score >= 50
        ? "stable"
        : score >= 26
          ? "forming"
          : "empty"

  return {
    acceptedDiffCount,
    mapDiffCount,
    constructionPlanCount,
    hasHouseStyle,
    hasStableShelterSignal,
    hasCareSignal,
    hasQuietZoneSignal,
    score,
    status,
    reasons: [
      `已应用变化 ${acceptedDiffCount}`,
      `地图变化记录 ${mapDiffCount}`,
      `建设计划 ${constructionPlanCount}`,
      hasHouseStyle ? "已有房屋偏好" : "尚未形成房屋偏好",
      hasStableShelterSignal ? "已有住所/遮蔽信号" : "住所信号不足",
      hasCareSignal ? "已有照护点信号" : "照护点信号不足",
      hasQuietZoneSignal ? "已有安静区域信号" : "安静区域信号不足",
    ],
  }
}

function buildTownAdoptionBlockers(input: {
  resourceReadiness: TownAdoptionResourceReadiness
  worldReadiness: TownAdoptionWorldReadiness
  input: TownAdoptionPrecheckBuilderInput
}): TownAdoptionBlocker[] {
  const blockers: TownAdoptionBlocker[] = []

  if (input.resourceReadiness.materialReadiness < 34) {
    blockers.push(
      buildBlocker({
        source: "resource",
        severity: "blocking",
        reason: "材料准备度过低，不能让小镇领养机会进入世界事实。",
        key: "material_low",
      })
    )
  }

  if (input.resourceReadiness.careReadiness < 40) {
    blockers.push(
      buildBlocker({
        source: "resource",
        severity: "blocking",
        reason: "照护准备度不足，世界还没有稳定接纳基础。",
        key: "care_low",
      })
    )
  }

  if (input.resourceReadiness.spacePressure >= 76) {
    blockers.push(
      buildBlocker({
        source: "space",
        severity: "blocking",
        reason: "空间压力过高，需要先整理家园空间。",
        key: "space_pressure_high",
      })
    )
  }

  if (input.worldReadiness.acceptedDiffCount === 0) {
    blockers.push(
      buildBlocker({
        source: "construction",
        severity: "warning",
        reason: "建设链路还没有产生可确认变化，需要继续观察。",
        key: "no_accepted_diff",
      })
    )
  }

  if (!input.worldReadiness.hasHouseStyle) {
    blockers.push(
      buildBlocker({
        source: "world_stability",
        severity: "warning",
        reason: "房屋偏好尚未稳定进入世界状态。",
        key: "house_style_missing",
      })
    )
  }

  if (!input.worldReadiness.hasStableShelterSignal) {
    blockers.push(
      buildBlocker({
        source: "safety_boundary",
        severity: "warning",
        reason: "住所或遮蔽信号不足，需要先让管家继续建设。",
        key: "shelter_signal_missing",
      })
    )
  }

  const constructionWarnings = [
    ...(input.input.constructionBridgeResult?.audit.warnings ?? []),
    ...(input.input.constructionBridgeResult?.verticalSliceResult
      .fullPipelineAudit.warnings ?? []),
  ]

  if (constructionWarnings.length > 0) {
    blockers.push(
      buildBlocker({
        source: "audit",
        severity: "blocking",
        reason: `建设审计仍有 ${constructionWarnings.length} 条警告，小镇领养观察保持后置。`,
        key: "construction_audit_warning",
      })
    )
  }

  return blockers
}

function buildObservation(input: {
  input: TownAdoptionPrecheckBuilderInput
  readiness: TownAdoptionReadinessSnapshot
  suffix: string
  type: AdoptionOpportunityObservation["type"]
  readyForButlerAdoptionIntent: boolean
  reason: string
  tags: string[]
}): AdoptionOpportunityObservation {
  return {
    observationId: [
      "town-adoption",
      normalizeIdToken(input.input.homeMapState.worldId),
      String(input.input.now),
      input.suffix,
    ].join("-"),
    type: input.type,
    kind: input.type,
    worldId: input.input.homeMapState.worldId,
    ownerId: input.input.homeMapState.ownerId,
    readyForButlerAdoptionIntent: input.readyForButlerAdoptionIntent,
    readiness: input.readiness,
    reason: input.reason,
    resourceReasons: input.readiness.resourceReadiness.reasons,
    worldReasons: input.readiness.worldReadiness.reasons,
    blockers: input.readiness.blockers,
    tags: [
      "town_adoption_precheck_observation",
      "town_adoption_precheck_01",
      "delayed_entry_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
      `observation_type:${input.type}`,
      ...input.tags,
    ],
  }
}

function buildBlocker(input: {
  key: string
  severity: TownAdoptionBlocker["severity"]
  reason: string
  source: TownAdoptionBlocker["source"]
}): TownAdoptionBlocker {
  return {
    blockerId: `town-adoption-blocker:${input.key}`,
    severity: input.severity,
    reason: input.reason,
    source: input.source,
    tags: [
      "town_adoption_precheck_blocker",
      `blocker_source:${input.source}`,
      `blocker_severity:${input.severity}`,
      `blocker_key:${input.key}`,
    ],
  }
}

function selectReadinessStatus(input: {
  score: number
  blockers: TownAdoptionBlocker[]
}): TownAdoptionReadinessSnapshot["status"] {
  const hasBlocking = input.blockers.some(
    (blocker) => blocker.severity === "blocking"
  )

  if (hasBlocking || input.score < 38) return "not_ready"
  if (input.score < 56) return "preparing"
  if (input.score < 74) return "observable"

  return "visit"
}

function selectRecommendedNextStep(input: {
  status: TownAdoptionReadinessSnapshot["status"]
  blockers: TownAdoptionBlocker[]
  resourceReadiness: TownAdoptionResourceReadiness
  worldReadiness: TownAdoptionWorldReadiness
}): TownAdoptionReadinessSnapshot["recommendedNextStep"] {
  if (
    input.blockers.some(
      (blocker) =>
        blocker.source === "resource" || blocker.source === "space"
    )
  ) {
    return "prepare_resources"
  }

  if (
    input.blockers.some(
      (blocker) =>
        blocker.source === "construction" ||
        blocker.source === "world_stability" ||
        blocker.source === "safety_boundary"
    )
  ) {
    return "continue_construction"
  }

  if (input.status === "visit") return "record_future_opportunity"
  if (input.status === "observable") return "observe_world"

  return "wait"
}

function hasZoneOrPlanSignal(input: {
  input: TownAdoptionPrecheckBuilderInput
  keywords: string[]
}): boolean {
  const zoneTokens = input.input.homeMapState.zones.flatMap((zone) => [
    zone.id,
    zone.type,
    ...zone.tags,
  ])
  const planTokens = input.input.homeMapState.constructionPlans.flatMap(
    (plan) => [plan.id, plan.title, plan.reason, ...plan.tags]
  )
  const tokens = [...zoneTokens, ...planTokens].map((token) =>
    token.toLowerCase()
  )

  return input.keywords.some((keyword) =>
    tokens.some((token) => token.includes(keyword.toLowerCase()))
  )
}

function auditForbiddenTokens(input: {
  adoptionOpportunityObservations: AdoptionOpportunityObservation[]
  butlerAdoptionIntents: ButlerAdoptionIntent[]
}): string[] {
  // These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.
  const forbiddenTokens = [
    "pet_arrival",
    "pet_rest",
    "pet-near-arrival-point",
    "pet-bed",
    "pet_actor",
    "incubator",
    "embryo",
    "hatching",
    "incubating",
  ]
  const tokens = [
    ...input.adoptionOpportunityObservations.flatMap((observation) => [
      observation.observationId,
      observation.type,
      observation.kind,
      observation.reason,
      ...observation.tags,
    ]),
    ...input.butlerAdoptionIntents.flatMap((intent) => [
      intent.intentId,
      intent.type,
      intent.kind,
      intent.reason,
      ...intent.tags,
    ]),
  ].map((token) => token.toLowerCase())

  return forbiddenTokens.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`Adoption opportunity observation contains forbidden token: ${token}`]
      : []
  )
}

function normalizeResourceValue(value: number): number {
  return clampScore(Math.round(value))
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
