/**
 * 当前文件职责：从世界、资源与建设状态生成生命事件后置候选。
 */

import { buildCompanionDecisionCandidates as buildCompanionDecisionCandidateList } from "./companion-decision-candidate"
import { auditLifeEventCandidates as auditLifeEventCandidateList } from "./life-event-audit"
import { buildLifeEventReport as buildLifeEventReportModel } from "./life-event-report"
import type {
  CompanionDecisionCandidate,
  LifeEventAudit,
  LifeEventBlocker,
  LifeEventCandidate,
  LifeEventCandidateBuilderInput,
  LifeEventCandidateBuilderResult,
  LifeEventReadinessSnapshot,
  LifeEventReport,
  LifeEventResourceReadiness,
  LifeEventWorldReadiness,
} from "./life-event-schema"

export function buildLifeEventCandidateBuilderResult(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidateBuilderResult {
  const readiness = buildLifeEventReadinessSnapshot(input)
  const lifeEventCandidates = buildLifeEventCandidateList({
    input,
    readiness,
  })
  const companionDecisionCandidates = buildCompanionDecisionCandidateList({
    lifeEventCandidates,
  })
  const audit = auditLifeEventCandidateList({
    builderInput: input,
    lifeEventCandidates,
    companionDecisionCandidates,
  })
  const report = buildLifeEventReportModel({
    lifeEventCandidates,
    companionDecisionCandidates,
    audit,
  })

  return {
    lifeEventCandidates,
    companionDecisionCandidates,
    audit,
    report,
    messages: report.messages,
    tags: [
      "life_event_candidate_builder_result",
      "life_event_01",
      "town_adoption_deferred_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
      "resource_space_construction_readiness",
    ],
  }
}

export function buildLifeEventCandidates(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidate[] {
  const readiness = buildLifeEventReadinessSnapshot(input)

  return buildLifeEventCandidateList({
    input,
    readiness,
  })
}

export function buildCompanionDecisionCandidates(input: {
  lifeEventCandidates: LifeEventCandidate[]
  tags?: string[]
}): CompanionDecisionCandidate[] {
  return buildCompanionDecisionCandidateList({
    lifeEventCandidates: input.lifeEventCandidates,
  })
}

export function auditLifeEventCandidates(input: {
  lifeEventCandidates: LifeEventCandidate[]
  warnings: string[]
}): LifeEventAudit {
  const companionDecisionCandidates = buildCompanionDecisionCandidateList({
    lifeEventCandidates: input.lifeEventCandidates,
  })
  const worldId = input.lifeEventCandidates[0]?.worldId ?? "unknown-world"
  const ownerId = input.lifeEventCandidates[0]?.ownerId ?? "unknown-owner"
  const readinessScore = input.lifeEventCandidates[0]?.readiness.score ?? 0
  const blockers = input.lifeEventCandidates.flatMap(
    (candidate) => candidate.blockers
  )
  const warnings = [
    ...input.warnings,
    ...auditForbiddenTokens({
      lifeEventCandidates: input.lifeEventCandidates,
      companionDecisionCandidates,
    }),
  ]

  return {
    stableLifeEventFingerprint: [
      worldId,
      ownerId,
      String(readinessScore),
      input.lifeEventCandidates
        .map((candidate) => `${candidate.candidateId}:${candidate.type}`)
        .sort()
        .join("+"),
      companionDecisionCandidates
        .map((candidate) => `${candidate.candidateId}:${candidate.type}`)
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
    lifeEventCandidateIds: input.lifeEventCandidates.map(
      (candidate) => candidate.candidateId
    ),
    companionDecisionCandidateIds: companionDecisionCandidates.map(
      (candidate) => candidate.candidateId
    ),
    readinessScore,
    blockerCount: blockers.length,
    warnings,
    tags: [
      "life_event_candidate_audit",
      "compat_export_from_candidate_builder",
      "town_adoption_deferred_only",
      warnings.length === 0
        ? "life_event_candidates_valid"
        : "life_event_candidates_warning",
    ],
  }
}

export function buildLifeEventReport(input: {
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
  audit: LifeEventAudit
}): LifeEventReport {
  return buildLifeEventReportModel(input)
}

function buildLifeEventCandidateList(input: {
  input: LifeEventCandidateBuilderInput
  readiness: LifeEventReadinessSnapshot
}): LifeEventCandidate[] {
  const blockingCount = input.readiness.blockers.filter(
    (blocker) => blocker.severity === "blocking"
  ).length
  const warningCount = input.readiness.blockers.filter(
    (blocker) => blocker.severity === "warning"
  ).length

  if (blockingCount > 0) {
    return [
      buildCandidate({
        input: input.input,
        readiness: input.readiness,
        suffix: "dependency-not-ready",
        type: "construction_dependency_not_ready",
        readyForCompanionDecision: false,
        reason:
          "家园仍存在关键准备项，小镇领养机会保持后置，不进入世界事实。",
        tags: [
          "construction_dependency_not_ready",
          "resource_or_space_blocked",
          "prepare_world_first",
        ],
      }),
    ]
  }

  if (input.readiness.status === "eligible_later") {
    return [
      buildCandidate({
        input: input.input,
        readiness: input.readiness,
        suffix: "world-observable",
        type: "observe_world_ready",
        readyForCompanionDecision: false,
        reason:
          "家园已经形成可观察的稳定结构，可以记录世界成熟度，但仍不生成伴生生命。",
        tags: ["observe_world_ready", "world_ready_observation"],
      }),
      buildCandidate({
        input: input.input,
        readiness: input.readiness,
        suffix: "future-opportunity",
        type: "adoption_candidate_later",
        readyForCompanionDecision: true,
        reason:
          "世界资源、空间与建设状态已接近可接纳阶段，记录为未来伴生生命机会。",
        tags: [
          "adoption_candidate_later",
          "future_opportunity_only",
          "no_actor_creation",
        ],
      }),
    ]
  }

  if (input.readiness.status === "observable") {
    return [
      buildCandidate({
        input: input.input,
        readiness: input.readiness,
        suffix: "observe-and-wait",
        type: "observe_world_ready",
        readyForCompanionDecision: false,
        reason:
          warningCount > 0
            ? "世界已经可以观察，但仍有资源或空间提醒，需要继续等待。"
            : "世界已经可以观察，小镇领养机会继续保持后置观察。",
        tags: ["observe_world_ready", "wait_and_observe"],
      }),
    ]
  }

  if (input.readiness.status === "preparing") {
    return [
      buildCandidate({
        input: input.input,
        readiness: input.readiness,
        suffix: "preparing",
        type: "adoption_candidate_later",
        readyForCompanionDecision: false,
        reason:
          "家园正在准备中，未来可能出现伴生生命机会，但当前不能进入伙伴流程。",
        tags: [
          "adoption_candidate_later",
          "prepare_world_first",
          "not_ready_yet",
        ],
      }),
    ]
  }

  return [
    buildCandidate({
      input: input.input,
      readiness: input.readiness,
      suffix: "no-event",
      type: "no_event",
      readyForCompanionDecision: false,
      reason: "当前世界尚未达到生命事件候选门槛。",
      tags: ["no_event", "life_event_waiting"],
    }),
  ]
}

function buildLifeEventReadinessSnapshot(
  input: LifeEventCandidateBuilderInput
): LifeEventReadinessSnapshot {
  const resourceReadiness = buildResourceReadiness(input)
  const worldReadiness = buildWorldReadiness(input)
  const blockers = buildLifeEventBlockers({
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
      "life-event-readiness",
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
      "life_event_readiness_snapshot",
      `life_event_status:${status}`,
      `life_event_score:${score}`,
      "no_world_fact_generation",
      "no_actor_creation",
    ],
  }
}

function buildResourceReadiness(
  input: LifeEventCandidateBuilderInput
): LifeEventResourceReadiness {
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
  input: LifeEventCandidateBuilderInput
): LifeEventWorldReadiness {
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

function buildLifeEventBlockers(input: {
  resourceReadiness: LifeEventResourceReadiness
  worldReadiness: LifeEventWorldReadiness
  input: LifeEventCandidateBuilderInput
}): LifeEventBlocker[] {
  const blockers: LifeEventBlocker[] = []

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
        reason: `建设审计仍有 ${constructionWarnings.length} 条警告，生命事件保持后置。`,
        key: "construction_audit_warning",
      })
    )
  }

  return blockers
}

function buildCandidate(input: {
  input: LifeEventCandidateBuilderInput
  readiness: LifeEventReadinessSnapshot
  suffix: string
  type: LifeEventCandidate["type"]
  readyForCompanionDecision: boolean
  reason: string
  tags: string[]
}): LifeEventCandidate {
  return {
    candidateId: [
      "life-event",
      normalizeIdToken(input.input.homeMapState.worldId),
      String(input.input.now),
      input.suffix,
    ].join("-"),
    type: input.type,
    kind: input.type,
    worldId: input.input.homeMapState.worldId,
    ownerId: input.input.homeMapState.ownerId,
    readyForCompanionDecision: input.readyForCompanionDecision,
    readiness: input.readiness,
    reason: input.reason,
    resourceReasons: input.readiness.resourceReadiness.reasons,
    worldReasons: input.readiness.worldReadiness.reasons,
    blockers: input.readiness.blockers,
    tags: [
      "life_event_candidate",
      "life_event_01",
      "delayed_entry_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
      `candidate_type:${input.type}`,
      ...input.tags,
    ],
  }
}

function buildBlocker(input: {
  key: string
  severity: LifeEventBlocker["severity"]
  reason: string
  source: LifeEventBlocker["source"]
}): LifeEventBlocker {
  return {
    blockerId: `life-event-blocker:${input.key}`,
    severity: input.severity,
    reason: input.reason,
    source: input.source,
    tags: [
      "life_event_blocker",
      `blocker_source:${input.source}`,
      `blocker_severity:${input.severity}`,
      `blocker_key:${input.key}`,
    ],
  }
}

function selectReadinessStatus(input: {
  score: number
  blockers: LifeEventBlocker[]
}): LifeEventReadinessSnapshot["status"] {
  const hasBlocking = input.blockers.some(
    (blocker) => blocker.severity === "blocking"
  )

  if (hasBlocking || input.score < 38) return "not_ready"
  if (input.score < 56) return "preparing"
  if (input.score < 74) return "observable"

  return "eligible_later"
}

function selectRecommendedNextStep(input: {
  status: LifeEventReadinessSnapshot["status"]
  blockers: LifeEventBlocker[]
  resourceReadiness: LifeEventResourceReadiness
  worldReadiness: LifeEventWorldReadiness
}): LifeEventReadinessSnapshot["recommendedNextStep"] {
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

  if (input.status === "eligible_later") return "record_future_opportunity"
  if (input.status === "observable") return "observe_world"

  return "wait"
}

function hasZoneOrPlanSignal(input: {
  input: LifeEventCandidateBuilderInput
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
  lifeEventCandidates: LifeEventCandidate[]
  companionDecisionCandidates: CompanionDecisionCandidate[]
}): string[] {
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
    ...input.lifeEventCandidates.flatMap((candidate) => [
      candidate.candidateId,
      candidate.type,
      candidate.kind,
      candidate.reason,
      ...candidate.tags,
    ]),
    ...input.companionDecisionCandidates.flatMap((candidate) => [
      candidate.candidateId,
      candidate.type,
      candidate.kind,
      candidate.reason,
      ...candidate.tags,
    ]),
  ].map((token) => token.toLowerCase())

  return forbiddenTokens.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`LifeEvent candidate contains forbidden token: ${token}`]
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
