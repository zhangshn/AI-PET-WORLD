/**
 * 当前文件职责：根据世界变化上下文生成审计报告。
 */

import type {
  BuildWorldEvolutionAuditReportInput,
  WorldEvolutionAuditReport,
  WorldEvolutionAuditRiskLevel,
  WorldEvolutionAuditSummary,
} from "./world-evolution-audit-schema"

export function buildWorldEvolutionAuditReport(
  input: BuildWorldEvolutionAuditReportInput
): WorldEvolutionAuditReport {
  const warningCount =
    input.proposal.warnings.length + input.validation.warnings.length
  const canApplySafely = buildCanApplySafely(input)
  const riskLevel = buildRiskLevel({
    input,
    warningCount,
    canApplySafely,
  })
  const summary: WorldEvolutionAuditSummary = {
    planStatus: input.plan.status,
    planType: input.plan.type,
    sourceIntentType: input.plan.sourceIntentType,
    sourceIntentScore: input.plan.sourceIntentScore,
    proposalType: input.proposal.type,
    shouldGenerateDiff: input.plan.shouldGenerateDiff,
    acceptedForPlanning: input.proposal.acceptedForPlanning,
    mapDiffCount: input.proposal.mapDiffs.length,
    acceptedDiffCount: input.validation.acceptedDiffs.length,
    rejectedDiffCount: input.validation.rejectedDiffs.length,
    warningCount,
    blockerCount: input.plan.blockers.length,
    canApplySafely,
    riskLevel,
  }

  return {
    id: `world-evolution-audit-${input.checkedAt}-${input.plan.id}`,
    checkedAt: input.checkedAt,
    summary,
    blockers: [...input.plan.blockers],
    warnings: [...input.proposal.warnings, ...input.validation.warnings],
    rejectedReasons: input.validation.rejectedDiffs.map((item) => item.reason),
    decisionTags: [...input.decision.tags],
    planTags: [...input.plan.tags],
    proposalTags: [...input.proposal.tags],
    validationTags: buildValidationTags(input),
    notes: buildAuditNotes({
      input,
      canApplySafely,
    }),
    tags: [
      "world_evolution_audit_v0",
      `risk:${riskLevel}`,
      canApplySafely ? "can_apply_safely" : "cannot_apply_safely",
      `plan_status:${input.plan.status}`,
      `proposal_type:${input.proposal.type}`,
    ],
  }
}

function buildCanApplySafely(
  input: BuildWorldEvolutionAuditReportInput
): boolean {
  return (
    input.plan.status === "proposed" &&
    input.proposal.acceptedForPlanning === true &&
    input.proposal.mapDiffs.length > 0 &&
    input.validation.rejectedDiffs.length === 0 &&
    input.validation.acceptedDiffs.length === input.proposal.mapDiffs.length
  )
}

function buildRiskLevel(input: {
  input: BuildWorldEvolutionAuditReportInput
  warningCount: number
  canApplySafely: boolean
}): WorldEvolutionAuditRiskLevel {
  if (input.input.validation.rejectedDiffs.length > 0) {
    return "high"
  }

  if (input.input.plan.status === "blocked") {
    return "high"
  }

  if (input.canApplySafely) {
    return "none"
  }

  if (
    input.input.plan.blockers.length > 0 ||
    input.warningCount > 0 ||
    (input.input.proposal.mapDiffs.length === 0 &&
      input.input.plan.shouldGenerateDiff)
  ) {
    return "medium"
  }

  if (
    input.input.plan.status === "skipped" ||
    input.input.proposal.type === "no_diff"
  ) {
    return "low"
  }

  return "low"
}

function buildValidationTags(
  input: BuildWorldEvolutionAuditReportInput
): string[] {
  if (input.validation.rejectedDiffs.length === 0) {
    return ["validation_clean"]
  }

  return Array.from(
    new Set(input.validation.rejectedDiffs.flatMap((item) => item.tags))
  )
}

function buildAuditNotes(input: {
  input: BuildWorldEvolutionAuditReportInput
  canApplySafely: boolean
}): string[] {
  const notes: string[] = []

  if (input.canApplySafely) {
    notes.push("该世界变化提案已通过校验，但当前阶段不会自动写入世界。")
  }

  if (input.input.plan.status === "skipped") {
    notes.push("当前意图未触发世界变化计划。")
  }

  if (input.input.plan.status === "blocked") {
    notes.push("世界变化计划被阻塞，需要先解决阻塞原因。")
  }

  if (input.input.proposal.mapDiffs.length === 0) {
    notes.push("当前计划没有生成 MapDiff。")
  }

  if (input.input.validation.rejectedDiffs.length > 0) {
    notes.push("存在被 Validator 拒绝的 MapDiff。")
  }

  return notes
}
