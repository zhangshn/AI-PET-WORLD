/**

 */

import { auditConstructionFullPipeline } from "./construction-full-pipeline-audit"
import { buildConstructionMemoryPersistenceMockResult } from "./construction-memory-persistence-mock"
import { buildConstructionPipelineReport } from "./construction-pipeline-report"
import { buildConstructionRuntimeCycleResult } from "./construction-runtime-cycle"
import { buildConstructionPainterRefreshBridgeResult } from "./construction-painter-refresh-bridge"
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
  const painterRefreshBridgeResult = buildConstructionPainterRefreshBridgeResult({
    signal: runtimeCycleResult.painterRefreshSignal,
  })
  const fullPipelineAudit = auditConstructionFullPipeline({
    adapterInput: input,
    runtimeCycleResult,
    memoryPersistenceMockResult,
    painterRefreshBridgeResult,
  })
  const pipelineReport = buildConstructionPipelineReport({
    runtimeCycleResult,
    memoryPersistenceMockResult,
    painterRefreshBridgeResult,
    fullPipelineAudit,
  })

  return {
    nextHomeMapState: runtimeCycleResult.nextHomeMapState,
    runtimeCycleResult,
    memoryPersistenceMockResult,
    painterRefreshBridgeResult,
    fullPipelineAudit,
    pipelineReport,
    messages: [
      ...runtimeCycleResult.messages,
      memoryPersistenceMockResult.reason,
      painterRefreshBridgeResult.reason,
      ...pipelineReport.messages,
    ],
    tags: [
      "construction_runtime_adapter_result",
      "usable_runtime_vertical_slice",
      "memory_persistence_mock_only",
      "painter_refresh_bridge_only",
      "no_external_runtime_loop_registration",
      "no_ui_render",
      "no_unplanned_life_entry",
    ],
  }
}
