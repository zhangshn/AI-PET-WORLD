/**
 * 当前文件职责：提供建设系统纵向闭环的调试运行入口。
 */

import { buildConstructionRuntimeAdapterResult } from "./construction-runtime-adapter"
import type {
  ConstructionDebugHarnessInput,
  ConstructionDebugHarnessResult,
} from "./construction-schema"

export function buildConstructionDebugHarnessResult(
  input: ConstructionDebugHarnessInput
): ConstructionDebugHarnessResult {
  const adapterResult = buildConstructionRuntimeAdapterResult({
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    worldDay: input.worldDay,
    now: input.now,
    preferredPlanId: input.preferredPlanId,
    runReason: input.runReason,
    persistenceMode: input.persistenceMode,
    visualRefreshMode: input.visualRefreshMode,
    tags: [
      ...input.tags,
      "construction_debug_harness",
      "debug_only",
      "not_runtime_registration",
    ],
  })

  return {
    harnessId: input.harnessId,
    adapterResult,
    report: adapterResult.pipelineReport,
    audit: adapterResult.fullPipelineAudit,
    messages: [
      `Construction debug harness ${input.harnessId} 已完成一次纵向闭环运行。`,
      ...adapterResult.messages,
    ],
    tags: [
      "construction_debug_harness_result",
      "debug_only",
      "usable_runtime_vertical_slice",
      "not_world_loop_registration",
      "not_ui_model",
    ],
  }
}
