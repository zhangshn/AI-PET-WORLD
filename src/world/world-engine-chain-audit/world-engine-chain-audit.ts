/**
 * 当前文件职责：生成世界引擎链路总审计报告。
 */

import type {
  BuildWorldEngineChainAuditReportInput,
  WorldEngineChainAuditReport,
  WorldEngineChainBlockedAt,
  WorldEngineChainStageStatus,
  WorldEngineChainSummary,
} from "./world-engine-chain-audit-schema"

export function buildWorldEngineChainAuditReport(
  input: BuildWorldEngineChainAuditReportInput
): WorldEngineChainAuditReport {
  const blockedAt = buildBlockedAt(input)
  const overallStatus = buildOverallStatus(input, blockedAt)
  const summary: WorldEngineChainSummary = {
    selectedIntentType: input.decision.selectedIntent.type,
    selectedIntentScore: input.decision.selectedIntent.score,
    shouldAct: input.decision.shouldAct,
    planType: input.plan.type,
    planStatus: input.plan.status,
    shouldGenerateDiff: input.plan.shouldGenerateDiff,
    proposalType: input.proposal.type,
    proposalAcceptedForPlanning: input.proposal.acceptedForPlanning,
    proposalMapDiffCount: input.proposal.mapDiffs.length,
    validationAcceptedCount: input.validation.acceptedDiffs.length,
    validationRejectedCount: input.validation.rejectedDiffs.length,
    auditRiskLevel: input.audit.summary.riskLevel,
    auditCanApplySafely: input.audit.summary.canApplySafely,
    executionStatus: input.execution.status,
    executionAppliedMapDiffCount: input.execution.appliedMapDiffCount,
    blockedAt,
    overallStatus,
  }

  return {
    id: `world-engine-chain-audit-${input.checkedAt}-${input.plan.id}`,
    checkedAt: input.checkedAt,
    summary,
    timeline: buildTimeline(input),
    keyReasons: uniqueStrings([
      input.decision.decisionReason,
      input.decision.selectedIntent.reason,
      input.plan.reason,
      input.proposal.reason,
      ...input.execution.messages,
    ]),
    blockers: uniqueStrings([
      ...input.decision.selectedIntent.blockers,
      ...input.plan.blockers,
      ...input.audit.blockers,
      ...input.execution.blockedReasons,
    ]),
    warnings: uniqueStrings([
      ...input.proposal.warnings,
      ...input.validation.warnings,
      ...input.audit.warnings,
    ]),
    notes: buildNotes(input, blockedAt, overallStatus),
    tags: [
      "world_engine_chain_audit_v0",
      `overall:${overallStatus}`,
      `blocked_at:${blockedAt}`,
      `intent:${input.decision.selectedIntent.type}`,
      `plan:${input.plan.type}`,
      `execution:${input.execution.status}`,
    ],
  }
}

function buildBlockedAt(
  input: BuildWorldEngineChainAuditReportInput
): WorldEngineChainBlockedAt {
  if (input.decision.shouldAct === false) {
    return "intent"
  }

  if (input.plan.status === "blocked") {
    return "plan"
  }

  if (input.plan.status === "skipped") {
    return "plan"
  }

  if (
    input.proposal.acceptedForPlanning === false &&
    input.plan.shouldGenerateDiff === true
  ) {
    return "proposal"
  }

  if (input.validation.rejectedDiffs.length > 0) {
    return "validation"
  }

  if (
    input.audit.summary.canApplySafely === false &&
    input.proposal.mapDiffs.length > 0
  ) {
    return "audit"
  }

  if (input.execution.status === "blocked") {
    return "execution"
  }

  return "none"
}

function buildOverallStatus(
  input: BuildWorldEngineChainAuditReportInput,
  blockedAt: WorldEngineChainBlockedAt
): WorldEngineChainStageStatus {
  if (input.execution.status === "applied") {
    return "applied"
  }

  if (input.execution.status === "skipped") {
    return "skipped"
  }

  if (blockedAt !== "none") {
    return "blocked"
  }

  if (input.decision.shouldAct === false) {
    return "wait"
  }

  return "pass"
}

function buildTimeline(input: BuildWorldEngineChainAuditReportInput) {
  return [
    {
      stage: "Environment",
      status: "pass" as const,
      message: `环境已生成：生态标签 ${input.environment.ecology.tags.join(
        ","
      )}，材料标签 ${input.environment.materials.tags.join(",")}`,
    },
    {
      stage: "Intent",
      status: input.decision.shouldAct ? "pass" as const : "wait" as const,
      message: `选择意图 ${input.decision.selectedIntent.type}，评分 ${input.decision.selectedIntent.score}。${input.decision.decisionReason}`,
    },
    {
      stage: "Plan",
      status: buildPlanTimelineStatus(input),
      message: `计划类型 ${input.plan.type}，状态 ${input.plan.status}。${input.plan.reason}`,
    },
    {
      stage: "Proposal",
      status: buildProposalTimelineStatus(input),
      message: `提案类型 ${input.proposal.type}，MapDiff 数量 ${input.proposal.mapDiffs.length}。${input.proposal.reason}`,
    },
    {
      stage: "Validation",
      status:
        input.validation.rejectedDiffs.length > 0
          ? "blocked" as const
          : "pass" as const,
      message: `校验通过 ${input.validation.acceptedDiffs.length} 个，拒绝 ${input.validation.rejectedDiffs.length} 个。`,
    },
    {
      stage: "Audit",
      status: buildAuditTimelineStatus(input),
      message: `审计风险 ${input.audit.summary.riskLevel}，canApplySafely=${input.audit.summary.canApplySafely}。`,
    },
    {
      stage: "Execution",
      status: buildExecutionTimelineStatus(input),
      message: `执行状态 ${input.execution.status}，应用 MapDiff 数量 ${input.execution.appliedMapDiffCount}。`,
    },
  ]
}

function buildPlanTimelineStatus(
  input: BuildWorldEngineChainAuditReportInput
): WorldEngineChainStageStatus {
  if (input.plan.status === "proposed") {
    return "pass"
  }

  if (input.plan.status === "blocked") {
    return "blocked"
  }

  return "skipped"
}

function buildProposalTimelineStatus(
  input: BuildWorldEngineChainAuditReportInput
): WorldEngineChainStageStatus {
  if (input.proposal.mapDiffs.length > 0) {
    return "pass"
  }

  if (input.proposal.type === "no_diff") {
    return "skipped"
  }

  return "wait"
}

function buildAuditTimelineStatus(
  input: BuildWorldEngineChainAuditReportInput
): WorldEngineChainStageStatus {
  if (input.audit.summary.canApplySafely) {
    return "pass"
  }

  if (input.audit.summary.riskLevel === "high") {
    return "blocked"
  }

  return "wait"
}

function buildExecutionTimelineStatus(
  input: BuildWorldEngineChainAuditReportInput
): WorldEngineChainStageStatus {
  if (input.execution.status === "applied") {
    return "applied"
  }

  if (input.execution.status === "skipped") {
    return "skipped"
  }

  return "blocked"
}

function buildNotes(
  input: BuildWorldEngineChainAuditReportInput,
  blockedAt: WorldEngineChainBlockedAt,
  overallStatus: WorldEngineChainStageStatus
): string[] {
  const notes = [...input.audit.notes, ...input.execution.messages]

  if (blockedAt !== "none") {
    notes.push(`当前链路阻塞在 ${blockedAt} 阶段。`)
  }

  if (overallStatus === "applied") {
    notes.push("当前链路已生成 debug 执行结果，但仍未接入正式世界。")
  }

  return uniqueStrings(notes)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)))
}
