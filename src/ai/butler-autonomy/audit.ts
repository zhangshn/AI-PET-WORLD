/**
 * 当前文件职责：审计管家自主意识输出是否越过世界事实边界。
 */

import type {
  ButlerAutonomousIntent,
  ButlerAutonomyAudit,
  ButlerAutonomyAuditWarning,
} from "./schema"

const WORLD_FACT_BOUNDARY_TAG_TOKENS = [
  "direct_home_map_write",
  "ui_generates_fact",
]

export function auditButlerAutonomousIntent(input: {
  intent: ButlerAutonomousIntent
  worldId: string
  ownerId: string
}): ButlerAutonomyAudit {
  const warnings = buildWarnings(input.intent)

  return {
    stableAutonomyFingerprint: buildAutonomyFingerprint({
      intent: input.intent,
      worldId: input.worldId,
      ownerId: input.ownerId,
    }),
    checkedIntentId: input.intent.intentId,
    warnings,
    tags: [
      "butler_autonomy_audit",
      warnings.length === 0 ? "audit_passed" : "audit_has_warnings",
      input.intent.kind,
    ],
  }
}

function buildWarnings(
  intent: ButlerAutonomousIntent
): ButlerAutonomyAuditWarning[] {
  const warnings: ButlerAutonomyAuditWarning[] = []
  const normalizedTokens = [
    intent.intentId,
    intent.kind,
    intent.reason,
    intent.nextExpectedConsumer,
    ...intent.tags,
    ...intent.perceivedWorldFacts,
    ...intent.memoryReferences,
  ].map((token) => token.toLowerCase())
  const boundaryHits = WORLD_FACT_BOUNDARY_TAG_TOKENS.filter((token) =>
    normalizedTokens.some((item) => item.includes(token))
  )

  if (boundaryHits.length > 0) {
    warnings.push({
      id: "world-fact-boundary-token",
      severity: "blocking",
      message: `管家意图包含越界世界事实 token：${boundaryHits.join("、")}。`,
      tags: ["world_fact_boundary", "autonomy_guardrail", ...boundaryHits],
    })
  }

  if (
    intent.nextExpectedConsumer === "construction_planner" &&
    !intent.constructionAllowed
  ) {
    warnings.push({
      id: "construction-consumer-without-permission",
      severity: "blocking",
      message: "意图指向建设规划层，但 constructionAllowed 为 false。",
      tags: ["construction_boundary", "intent_consumer_mismatch"],
    })
  }

  if (intent.priority < 0 || intent.priority > 100) {
    warnings.push({
      id: "priority-out-of-range",
      severity: "warning",
      message: "管家意图 priority 必须在 0 到 100 之间。",
      tags: ["score_range", "priority"],
    })
  }

  if (intent.confidence < 0 || intent.confidence > 100) {
    warnings.push({
      id: "confidence-out-of-range",
      severity: "warning",
      message: "管家意图 confidence 必须在 0 到 100 之间。",
      tags: ["score_range", "confidence"],
    })
  }

  return warnings
}

function buildAutonomyFingerprint(input: {
  intent: ButlerAutonomousIntent
  worldId: string
  ownerId: string
}): string {
  return stableTextHash(
    [
      input.worldId,
      input.ownerId,
      input.intent.intentId,
      input.intent.kind,
      String(input.intent.priority),
      String(input.intent.confidence),
      input.intent.nextExpectedConsumer,
      input.intent.tags.join("|"),
    ].join("::")
  )
}

function stableTextHash(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16).padStart(8, "0")
}
