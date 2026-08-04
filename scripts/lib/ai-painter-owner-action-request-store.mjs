import path from "node:path"
import {
  appendAiPainterProgramEvent,
  writeImmutableProgramRun,
} from "./ai-painter-program-event-store.mjs"
import {
  normalizeOwnerActionRequest,
  sha256File,
} from "./ai-painter-local-governance.mjs"

const OUTPUT_ROOT = ".runtime/ai-painter/owner-action-requests"

export function recordAiPainterOwnerActionRequest(input, {
  root = process.cwd(),
  sourceEvidencePath = null,
  script = "scripts/lib/ai-painter-owner-action-request-store.mjs",
} = {}) {
  const record = normalizeOwnerActionRequest(input, { root })
  const runId = record.requestId
  appendAiPainterProgramEvent({
    action: "record_ai_painter_owner_action_request",
    runId,
    kind: "owner_action_request_recording_started",
    status: "running",
    title: "Local AI Painter owner action request recording started",
    titleZh: "本地AI Painter项目所有者动作请求开始自动记录",
    detail: `requestId=${record.requestId}; status=${record.status}; blocker=${record.blockingReasonCode}`,
    detailZh: `请求ID=${record.requestId}；状态=${record.status}；阻断=${record.blockingReasonCode}`,
    script,
    currentStep: "persist_local_owner_action_request",
    evidencePath: sourceEvidencePath,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId,
    fileName: "request.json",
    record,
    latest: {
      requestId: record.requestId,
      subsystem: record.subsystem,
      blockingReasonCode: record.blockingReasonCode,
      ownerFacingMessageZh: record.ownerFacingMessageZh,
      generatedBy: record.generatedBy,
      externalEmployeeDecisionAuthority: false,
    },
  })
  const requestSha256 = sha256File(path.resolve(root, stored.runPath))
  appendAiPainterProgramEvent({
    action: "record_ai_painter_owner_action_request",
    runId,
    kind: "owner_action_request_recorded",
    status: "success",
    title: "Local AI Painter owner action request recorded automatically",
    titleZh: "本地AI Painter项目所有者动作请求已由程序自动记录",
    detail: `requestId=${record.requestId}; status=${record.status}; localSystemOfRecord=true`,
    detailZh: record.ownerFacingMessageZh,
    script,
    currentStep: record.status,
    evidencePath: stored.runPath,
    nextAction: record.nextActionAfterAuthorization.join(","),
    nextActionZh: record.minimumRequestedActionZh,
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
  return {
    status: record.status,
    requestId: record.requestId,
    requestPath: stored.runPath,
    requestSha256,
    localSystemOfRecord: true,
    externalEmployeeDecisionAuthority: false,
  }
}
