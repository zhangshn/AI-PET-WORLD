/**
 * 褰撳墠鏂囦欢鑱岃矗锛氭妸寤鸿绾靛悜闂幆鍖呰涓虹湡瀹炶繍琛屾椂鎺ュ叆鍓嶆ˉ鎺ョ粨鏋溿€?
 */

import { auditConstructionRuntimeBridge } from "./construction-runtime-bridge-audit"
import { runConstructionRuntimeVerticalSlice } from "./construction-runtime-vertical-slice"
import type {
  ConstructionPipelineReportSection,
  ConstructionRuntimeBridgeInput,
  ConstructionRuntimeBridgeReport,
  ConstructionRuntimeBridgeResult,
} from "./construction-schema"

export function buildConstructionRuntimeBridgeResult(
  input: ConstructionRuntimeBridgeInput
): ConstructionRuntimeBridgeResult {
  const verticalSliceResult = runConstructionRuntimeVerticalSlice(input)
  const audit = auditConstructionRuntimeBridge({
    bridgeInput: input,
    verticalSliceResult,
  })
  const shouldEnterRuntime = audit.warnings.length === 0
  const shouldPersist =
    shouldEnterRuntime &&
    verticalSliceResult.memoryPersistenceMockResult.didStore
  const shouldRefresh =
    shouldEnterRuntime &&
    verticalSliceResult.visualRefreshBridgeResult.shouldRequestRefresh
  const report = buildRuntimeBridgeReport({
    input,
    shouldEnterRuntime,
    shouldPersist,
    shouldRefresh,
    sections: verticalSliceResult.pipelineReport.sections,
    warnings: audit.warnings,
  })

  return {
    bridgeId: input.bridgeId,
    verticalSliceResult,
    shouldEnterRuntime,
    shouldPersist,
    shouldRefresh,
    audit,
    report,
    messages: [
      ...verticalSliceResult.messages,
      ...report.messages,
    ],
    tags: [
      "construction_runtime_bridge_result",
      "runtime_bridge_pre_integration",
      "no_external_runtime_loop_registration",
      "no_real_persistence",
      "no_ui_render",
      "no_unplanned_life_entry",
    ],
  }
}

function buildRuntimeBridgeReport(input: {
  input: ConstructionRuntimeBridgeInput
  shouldEnterRuntime: boolean
  shouldPersist: boolean
  shouldRefresh: boolean
  sections: ConstructionPipelineReportSection[]
  warnings: string[]
}): ConstructionRuntimeBridgeReport {
  const bridgeSection: ConstructionPipelineReportSection = {
    title: "Runtime Bridge",
    status: input.warnings.length === 0 ? "ok" : "warning",
    lines: [
      `Bridge id: ${input.input.bridgeId}`,
      `Should enter runtime: ${String(input.shouldEnterRuntime)}`,
      `Should persist: ${String(input.shouldPersist)}`,
      `Should refresh: ${String(input.shouldRefresh)}`,
    ],
    tags: ["section:runtime_bridge"],
  }

  return {
    reportId: [
      "construction-runtime-bridge-report",
      normalizeIdToken(input.input.bridgeId),
    ].join("-"),
    bridgeId: input.input.bridgeId,
    shouldEnterRuntime: input.shouldEnterRuntime,
    shouldPersist: input.shouldPersist,
    shouldRefresh: input.shouldRefresh,
    hasAuditWarning: input.warnings.length > 0,
    sections: [
      bridgeSection,
      ...input.sections,
    ],
    messages: input.warnings.length === 0
      ? ["Runtime bridge precheck passed."]
      : input.warnings.map((warning) => `Runtime bridge warning: ${warning}`),
    tags: [
      "construction_runtime_bridge_report",
      "not_external_runtime_loop_registration",
      input.warnings.length === 0
        ? "runtime_bridge_valid"
        : "runtime_bridge_warning",
    ],
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
