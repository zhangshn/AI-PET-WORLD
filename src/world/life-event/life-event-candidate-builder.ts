/**
 * 当前文件职责：从世界与建设状态生成生命事件后置候选。
 */

import { buildCompanionDecisionCandidates } from "./companion-decision-candidate"
import { auditLifeEventCandidates } from "./life-event-audit"
import { buildLifeEventReport } from "./life-event-report"
import type {
  LifeEventCandidate,
  LifeEventCandidateBuilderInput,
  LifeEventCandidateBuilderResult,
} from "./life-event-schema"

export function buildLifeEventCandidateBuilderResult(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidateBuilderResult {
  const lifeEventCandidates = buildLifeEventCandidates(input)
  const companionDecisionCandidates = buildCompanionDecisionCandidates({
    lifeEventCandidates,
  })
  const audit = auditLifeEventCandidates({
    builderInput: input,
    lifeEventCandidates,
    companionDecisionCandidates,
  })
  const report = buildLifeEventReport({
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

function buildLifeEventCandidates(
  input: LifeEventCandidateBuilderInput
): LifeEventCandidate[] {
  const acceptedDiffCount =
    input.constructionBridgeResult.verticalSliceResult.fullPipelineAudit
      .acceptedDiffIds.length
  const hasWarnings =
    input.constructionBridgeResult.audit.warnings.length > 0 ||
    input.constructionBridgeResult.verticalSliceResult.fullPipelineAudit
      .warnings.length > 0

  if (hasWarnings) {
    return [
      buildCandidate({
        input,
        suffix: "construction-not-ready",
        kind: "construction_dependency_not_ready",
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
        kind: "observe_world_ready",
        readyForCompanionDecision: false,
        reason: "家园建设链路已有可观察变化，允许记录世界可观察候选。",
      }),
      buildCandidate({
        input,
        suffix: "companion-later",
        kind: "companion_opportunity_later",
        readyForCompanionDecision: true,
        reason: "后续可以评估伙伴机会，但本阶段不让伙伴进入世界。",
      }),
    ]
  }

  return [
    buildCandidate({
      input,
      suffix: "no-event",
      kind: "no_event",
      readyForCompanionDecision: false,
      reason: "当前没有足够建设变化触发生命事件候选。",
    }),
  ]
}

function buildCandidate(input: {
  input: LifeEventCandidateBuilderInput
  suffix: string
  kind: LifeEventCandidate["kind"]
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
    kind: input.kind,
    worldId: input.input.homeMapState.worldId,
    ownerId: input.input.homeMapState.ownerId,
    readyForCompanionDecision: input.readyForCompanionDecision,
    reason: input.reason,
    tags: [
      "life_event_candidate",
      "delayed_entry_only",
      "no_actor_creation",
      "no_home_map_state_mutation",
      `candidate_kind:${input.kind}`,
    ],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
