/**
 * 当前文件职责：根据审计结果安全生成世界变化执行结果。
 */

import { applyMapDiffs } from "@/world/map-state/map-diff-engine"

import type {
  BuildWorldEvolutionExecutionInput,
  WorldEvolutionExecutionResult,
} from "./world-evolution-executor-schema"

export function buildWorldEvolutionExecution(
  input: BuildWorldEvolutionExecutionInput
): WorldEvolutionExecutionResult {
  if (input.proposal.mapDiffs.length === 0) {
    return {
      id: buildExecutionId(input),
      status: "skipped",
      appliedMapDiffCount: 0,
      nextHomeMapState: input.homeMapState,
      messages: ["世界变化未执行：没有可应用的 MapDiff。"],
      blockedReasons: ["proposal.mapDiffs 为空"],
      tags: ["world_evolution_execution_v0", "execution_skipped"],
    }
  }

  if (input.audit.summary.canApplySafely !== true) {
    return {
      id: buildExecutionId(input),
      status: "blocked",
      appliedMapDiffCount: 0,
      nextHomeMapState: input.homeMapState,
      messages: ["世界变化未执行：审计未通过。"],
      blockedReasons: [
        ...input.audit.blockers,
        ...input.audit.warnings,
        ...input.audit.rejectedReasons,
        ...input.audit.notes,
      ],
      tags: ["world_evolution_execution_v0", "execution_blocked"],
    }
  }

  return {
    id: buildExecutionId(input),
    status: "applied",
    appliedMapDiffCount: input.proposal.mapDiffs.length,
    nextHomeMapState: applyMapDiffs(input.homeMapState, input.proposal.mapDiffs),
    messages: [
      "世界变化已通过安全审计并生成执行结果。",
      "当前结果仅用于 debug，不代表正式世界已自动写入。",
    ],
    blockedReasons: [],
    tags: ["world_evolution_execution_v0", "execution_applied", "debug_only"],
  }
}

function buildExecutionId(input: BuildWorldEvolutionExecutionInput): string {
  return `world-evolution-execution-${input.now}-${input.proposal.id}`
}
