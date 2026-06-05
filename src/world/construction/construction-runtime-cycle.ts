/**

 */

import { buildConstructionPersistenceProposal } from "./construction-persistence-proposal"
import { auditConstructionRuntimeCycle } from "./construction-runtime-cycle-audit"
import { buildConstructionPainterRefreshSignal } from "./construction-painter-refresh-signal"
import { buildConstructionRuntimeCommitResult } from "./construction-runtime-commit-protocol"
import type {
  ConstructionRuntimeCycleInput,
  ConstructionRuntimeCycleResult,
} from "./construction-schema"

export function buildConstructionRuntimeCycleResult(
  input: ConstructionRuntimeCycleInput
): ConstructionRuntimeCycleResult {
  const runtimeCommitResult = buildConstructionRuntimeCommitResult({
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    worldDay: input.worldDay,
    now: input.now,
    preferredPlanId: input.preferredPlanId,
    tags: [
      ...input.tags,
      "construction_runtime_cycle_input",
      `run_reason:${input.runReason}`,
    ],
  })
  const persistenceProposal = buildConstructionPersistenceProposal({
    runtimeInput: input,
    runtimeCommitResult,
  })
  const painterRefreshSignal = buildConstructionPainterRefreshSignal({
    runtimeInput: input,
    runtimeCommitResult,
  })
  const resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit"> = {
    nextHomeMapState: runtimeCommitResult.nextHomeMapState,
    runtimeCommitResult,
    persistenceProposal,
    painterRefreshSignal,
    messages: [
      ...runtimeCommitResult.messages,
      ...(persistenceProposal ? [persistenceProposal.reason] : []),
      ...(painterRefreshSignal ? [painterRefreshSignal.reason] : []),
    ],
    tags: [
      "construction_runtime_cycle_result",
      "runtime_tick_integrated",
      "autonomous_construction_runtime",
      "no_direct_persistence",
      "no_ui_integration",
      "no_unplanned_life_entry",
      `run_reason:${input.runReason}`,
    ],
  }
  const audit = auditConstructionRuntimeCycle({
    runtimeInput: input,
    resultWithoutAudit,
  })

  return {
    ...resultWithoutAudit,
    audit,
  }
}
