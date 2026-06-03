/**
 * 当前文件负责：串联建设输入、候选计划、执行候选与 SafeApply 协议。
 */

import { buildConstructionPlanCandidates } from "./construction-planner"
import { buildConstructionPlannerInput } from "./construction-planner-input-builder"
import { buildConstructionExecutionResult } from "./construction-executor"
import { buildConstructionSafeApplyResult } from "./construction-safe-apply"
import { auditConstructionRuntimeCommit } from "./construction-runtime-commit-audit"
import type {
  ConstructionPlan,
  ConstructionRuntimeCommitInput,
  ConstructionRuntimeCommitResult,
} from "./construction-schema"

export function buildConstructionRuntimeCommitResult(
  input: ConstructionRuntimeCommitInput
): ConstructionRuntimeCommitResult {
  const plannerInputResult = buildConstructionPlannerInput({
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    worldDay: input.worldDay,
  })
  const candidateResult = buildConstructionPlanCandidates(plannerInputResult.input)
  const selectedPlan = selectConstructionPlan({
    plans: candidateResult.plans,
    preferredPlanId: input.preferredPlanId,
  })
  const executionResult = selectedPlan
      ? buildConstructionExecutionResult({
          homeMapState: input.homeMapState,
          plan: selectedPlan,
          now: input.now,
          worldDay: input.worldDay,
        })
      : null
  const safeApplyResult = executionResult
    ? buildConstructionSafeApplyResult({
        homeMapState: input.homeMapState,
        executionResult,
        now: input.now,
      })
    : null
  const resultWithoutAudit: Omit<ConstructionRuntimeCommitResult, "audit"> = {
    nextHomeMapState: safeApplyResult?.nextHomeMapState ?? input.homeMapState,
    plannerInputResult,
    candidateResult,
    selectedPlan,
    executionResult,
    safeApplyResult,
    messages: buildProtocolMessages({
      selectedPlan,
      executionResult,
      safeApplyResult,
    }),
    tags: [
      "construction_runtime_commit_result",
      "runtime_tick_integrated",
      "planner_candidate_executor_safe_apply_chain",
      "no_ui_integration",
      "no_unplanned_life_entry",
    ],
  }
  const audit = auditConstructionRuntimeCommit({
    protocolInput: input,
    resultWithoutAudit,
  })

  return {
    ...resultWithoutAudit,
    audit,
  }
}

function selectConstructionPlan(input: {
  plans: ConstructionPlan[]
  preferredPlanId?: string
}): ConstructionPlan | null {
  if (input.plans.length === 0) return null

  const preferredPlan = input.preferredPlanId
    ? input.plans.find((plan) => plan.id === input.preferredPlanId)
    : undefined

  return preferredPlan ?? [...input.plans].sort(sortPlansByPriority)[0]
}

function sortPlansByPriority(left: ConstructionPlan, right: ConstructionPlan): number {
  if (right.priority !== left.priority) return right.priority - left.priority

  return left.id.localeCompare(right.id)
}

function buildProtocolMessages(input: {
  selectedPlan: ConstructionPlan | null
  executionResult: ReturnType<typeof buildConstructionExecutionResult> | null
  safeApplyResult: ReturnType<typeof buildConstructionSafeApplyResult> | null
}): string[] {
  if (!input.selectedPlan) {
    return ["建设循环协议未选中候选计划，本轮不执行建设链路。"]
  }

  return [
    `建设循环协议选中计划：${input.selectedPlan.title}。`,
    ...(input.executionResult?.messages ?? []),
    ...(input.safeApplyResult?.messages ?? []),
  ]
}