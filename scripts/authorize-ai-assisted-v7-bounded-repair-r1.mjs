import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const EXPECTED_COMMAND = "允许闭环D+E有界修复与一次Smoke"
const CONTRACT_POINTER = ".runtime/ai-painter/v7-validation-failure-repair-contracts/latest.json"
const REQUEST_POINTER = ".runtime/ai-painter/owner-action-requests/latest.json"
const args = parseArgs(process.argv.slice(2))

assert(args.ownerCommand === EXPECTED_COMMAND, "owner command does not exactly authorize bounded V7 repair R1")
const contractPointer = readJson(path.resolve(ROOT, CONTRACT_POINTER))
const contract = readJson(path.resolve(ROOT, contractPointer.runPath))
assert(contract.status === "repair_contract_ready_waiting_owner_authorization", "repair contract is not awaiting authorization")
const requestPointer = readJson(path.resolve(ROOT, REQUEST_POINTER))
const pendingRequest = readJson(path.resolve(ROOT, requestPointer.runPath))
assert(pendingRequest.requestId === requestPointer.requestId, "latest owner request identity mismatch")
assert(pendingRequest.subsystem === "ai_painter_v7_bounded_validation_failure_repair_r1", "latest owner request is not the bounded V7 repair request")
assert(pendingRequest.status === "waiting_owner_authorization", "bounded V7 repair request is not waiting for authorization")
assert(pendingRequest.taskIdentity?.repairContractId === contract.contractId, "repair contract and owner request identity mismatch")

const commandRef = "owner-authorized-v7-bounded-repair-r1-diagnostics-implementation-single-stage0-smoke-20260802"
const resolutionId = "owner-action-request-v7-bounded-repair-r1-resolution-20260802"
const recorded = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: resolutionId,
  subsystem: "ai_painter_v7_bounded_validation_failure_repair_r1",
  status: "resolved_owner_authorized",
  taskIdentity: {
    ...pendingRequest.taskIdentity,
    parentRequestId: pendingRequest.requestId,
    repairContractPath: contractPointer.runPath,
    repairContractSha256: contractPointer.sourceRootCauseAnalysisSha256 ? sha256File(path.resolve(ROOT, contractPointer.runPath)) : null,
  },
  ownerVisibleConclusionZh: "项目所有者已明确授权闭环D+E：有界诊断、V7修复实现、静态与数据回归，以及一次新的Stage 0 Smoke。",
  localSystemFindingZh: "授权不包含完整Stage 0→1→2训练、严格重新验证、正式模型晋升、RuntimeFrame或进入世界。",
  blockingReasonCode: "resolved_owner_authorized_v7_bounded_repair_r1_single_stage0_smoke",
  whyCannotProceedZh: "本记录解除闭环D+E的有界执行阻断；所有后续阶段仍保持独立阻断。",
  minimumRequestedActionZh: "本地程序执行合同内诊断与修复，完成一次Stage 0 Smoke后自动写入结果并停止。",
  invariants: pendingRequest.invariants,
  forbiddenActions: pendingRequest.forbiddenActions,
  ownerFacingMessageZh: "闭环D+E已获授权，本地程序将执行有界诊断、修复和一次Stage 0 Smoke，随后自动停止等待下一步决策。",
  nextActionAfterAuthorization: pendingRequest.nextActionAfterAuthorization,
  evidencePaths: [
    ...(pendingRequest.evidence ?? []).map((entry) => entry.path),
    contractPointer.runPath,
    requestPointer.runPath,
  ],
  ownerDecision: {
    decision: "authorized",
    commandRef,
    commandZh: `**${args.ownerCommand}**。`,
  },
  resolution: {
    boundedDiagnosticsAuthorized: true,
    repairImplementationAuthorized: true,
    singleStage0SmokeAuthorized: true,
    fullTrainingAuthorized: false,
    revalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
    executionCompleted: false,
  },
}, {
  root: ROOT,
  sourceEvidencePath: contractPointer.runPath,
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1.mjs",
})
appendAiPainterProgramEvent({
  action: "authorize_ai_assisted_v7_bounded_repair_r1",
  runId: resolutionId,
  kind: "owner_authorization_recorded",
  status: "success",
  title: "Owner authorized bounded V7 repair R1 and one Stage 0 smoke",
  titleZh: "项目所有者已授权V7有界修复R1及一次Stage 0 Smoke",
  detail: commandRef,
  detailZh: "完整训练、重新验证、正式推理、RuntimeFrame和世界运行仍未授权。",
  script: "scripts/authorize-ai-assisted-v7-bounded-repair-r1.mjs",
  currentStep: "bounded_repair_r1_authorized_pending_execution",
  evidencePath: recorded.requestPath,
  nextAction: "run_bounded_diagnostics_and_repair",
  nextActionZh: "执行有界诊断、修复和一次Stage 0 Smoke后自动停止。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})
console.log(JSON.stringify({ ok: true, commandRef, resolution: recorded, authorizationScope: {
  boundedDiagnosticsAuthorized: true,
  repairImplementationAuthorized: true,
  singleStage0SmokeAuthorized: true,
  fullTrainingAuthorized: false,
  revalidationAuthorized: false,
  formalInferenceAuthorized: false,
} }, null, 2))

function parseArgs(values) {
  const index = values.indexOf("--owner-command")
  return { ownerCommand: index >= 0 ? values[index + 1] : null }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
