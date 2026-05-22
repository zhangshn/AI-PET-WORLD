/**
 * 当前文件职责：提供建设系统 runtime 调用边界协议。
 */

import { buildConstructionPersistenceProposal } from "./construction-persistence-proposal"
import { auditConstructionRuntimeCycle } from "./construction-runtime-cycle-audit"
import { buildConstructionVisualRefreshSignal } from "./construction-visual-refresh-signal"
import { buildConstructionWorldLoopProtocolResult } from "./construction-world-loop-protocol"
import type {
  ConstructionRuntimeCycleInput,
  ConstructionRuntimeCycleResult,
} from "./construction-schema"

export function buildConstructionRuntimeCycleResult(
  input: ConstructionRuntimeCycleInput
): ConstructionRuntimeCycleResult {
  const worldLoopProtocolResult = buildConstructionWorldLoopProtocolResult({
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
    worldLoopProtocolResult,
  })
  const visualRefreshSignal = buildConstructionVisualRefreshSignal({
    runtimeInput: input,
    worldLoopProtocolResult,
  })
  const resultWithoutAudit: Omit<ConstructionRuntimeCycleResult, "audit"> = {
    nextHomeMapState: worldLoopProtocolResult.nextHomeMapState,
    worldLoopProtocolResult,
    persistenceProposal,
    visualRefreshSignal,
    messages: [
      ...worldLoopProtocolResult.messages,
      ...(persistenceProposal ? [persistenceProposal.reason] : []),
      ...(visualRefreshSignal ? [visualRefreshSignal.reason] : []),
    ],
    tags: [
      "construction_runtime_cycle_result",
      "runtime_boundary_only",
      "no_direct_persistence",
      "no_ui_integration",
      "no_default_companion_entry",
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
