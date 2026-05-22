/**
 * 当前文件职责：提供建设系统可运行纵向闭环适配入口。
 */

import { auditConstructionFullPipeline } from "./construction-full-pipeline-audit"
import { buildConstructionMemoryPersistenceMockResult } from "./construction-memory-persistence-mock"
import { buildConstructionPipelineReport } from "./construction-pipeline-report"
import { buildConstructionRuntimeCycleResult } from "./construction-runtime-cycle"
import { buildConstructionVisualRefreshBridgeResult } from "./construction-visual-refresh-bridge"
import type {
  ConstructionRuntimeAdapterInput,
  ConstructionRuntimeAdapterResult,
} from "./construction-schema"

export function buildConstructionRuntimeAdapterResult(
  input: ConstructionRuntimeAdapterInput
): ConstructionRuntimeAdapterResult {
  const runtimeCycleResult = buildConstructionRuntimeCycleResult(input)
  const memoryPersistenceMockResult =
    buildConstructionMemoryPersistenceMockResult({
      proposal: runtimeCycleResult.persistenceProposal,
      nextHomeMapState: runtimeCycleResult.nextHomeMapState,
      mode: input.memoryPersistenceMode,
    })
  const visualRefreshBridgeResult = buildConstructionVisualRefreshBridgeResult({
    signal: runtimeCycleResult.visualRefreshSignal,
  })
  const fullPipelineAudit = auditConstructionFullPipeline({
    adapterInput: input,
    runtimeCycleResult,
    memoryPersistenceMockResult,
    visualRefreshBridgeResult,
  })
  const pipelineReport = buildConstructionPipelineReport({
    runtimeCycleResult,
    memoryPersistenceMockResult,
    visualRefreshBridgeResult,
    fullPipelineAudit,
  })

  return {
    nextHomeMapState: runtimeCycleResult.nextHomeMapState,
    runtimeCycleResult,
    memoryPersistenceMockResult,
    visualRefreshBridgeResult,
    fullPipelineAudit,
    pipelineReport,
    messages: [
      ...runtimeCycleResult.messages,
      memoryPersistenceMockResult.reason,
      visualRefreshBridgeResult.reason,
      ...pipelineReport.messages,
    ],
    tags: [
      "construction_runtime_adapter_result",
      "usable_runtime_vertical_slice",
      "memory_persistence_mock_only",
      "visual_refresh_bridge_only",
      "no_real_world_loop_registration",
      "no_ui_render",
      "no_default_companion_entry",
    ],
  }
}
