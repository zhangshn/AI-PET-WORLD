/**
 * 当前文件职责：从世界与建设状态生成生命事件后置候选。
 */

import {
  buildCompanionDecisionCandidates as buildCompanionDecisionCandidateList,
} from "./companion-decision-candidate"
import {
  auditLifeEventCandidates as auditLifeEventCandidateList,
} from "./life-event-audit"
import {
  buildLifeEventReport as buildLifeEventReportModel,
} from "./life-event-report"
import type {
  CompanionDecisionCandidate,
  LifeEventAudit,
  LifeEventCandidate,
  LifeEventCandidateBuilderInput,
  LifeEventCandidateBuilderResult,
  LifeEventReport,
} from "./life-event-schema"

export function buildLifeEventCandidateBuilderResult(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidateBuilderResult {
  const lifeEventCandidates = buildLifeEventCandidateList(input)
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
      "delayed_companion_entry_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
    ],
  }
}

export function buildLifeEventCandidates(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidate[] {
  return buildLifeEventCandidateList(input)
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
      input.lifeEventCandidates
        .map((candidate) => `${candidate.candidateId}:${candidate.type}`)
        .sort()
        .join("+"),
      companionDecisionCandidates
        .map((candidate) => `${candidate.candidateId}:${candidate.type}`)
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
    warnings,
    tags: [
      "life_event_candidate_audit",
      "compat_export_from_candidate_builder",
      "delayed_companion_entry_only",
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

function buildLifeEventCandidateList(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidate[] {
  const acceptedDiffCount =
    input.constructionBridgeResult?.verticalSliceResult.fullPipelineAudit
      .acceptedDiffIds.length ?? 0
  const hasWarnings =
    (input.constructionBridgeResult?.audit.warnings.length ?? 0) > 0 ||
    (input.constructionBridgeResult?.verticalSliceResult.fullPipelineAudit
      .warnings.length ?? 0) > 0

  if (hasWarnings) {
    return [
      buildCandidate({
        input,
        suffix: "construction-not-ready",
        type: "construction_dependency_not_ready",
        readyForCompanionDecision: false,
        reason: "建设链路仍有 audit warning，生命事件候选保持后置等待。",
      }),
    ]
  }

  if (acceptedDiffCount > 0) {
    return [
      buildCandidate({
        input,
        suffix: "world-ready",
        type: "observe_world_ready",
        readyForCompanionDecision: false,
        reason: "家园建设链路已有可观察变化，允许记录世界可观察候选。",
      }),
      buildCandidate({
        input,
        suffix: "companion-later",
        type: "companion_opportunity_later",
        readyForCompanionDecision: true,
        reason: "后续可以评估伙伴机会，但本阶段不让伙伴进入世界。",
      }),
    ]
  }

  return [
    buildCandidate({
      input,
      suffix: "no-event",
      type: "no_event",
      readyForCompanionDecision: false,
      reason: "当前没有足够建设变化触发生命事件候选。",
    }),
  ]
}

function buildCandidate(input: {
  input: LifeEventCandidateBuilderInput
  suffix: string
  type: LifeEventCandidate["type"]
  readyForCompanionDecision: boolean
  reason: string
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
    reason: input.reason,
    tags: [
      "life_event_candidate",
      "delayed_entry_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
      `candidate_type:${input.type}`,
    ],
  }
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

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
