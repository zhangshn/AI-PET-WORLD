import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const RUN_ID = "20260824-043107160"
const requestRoot = path.resolve(ROOT, `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-three-component-smoke-failure-boundary-adjudication-${RUN_ID}`)
const authorizationPath = path.join(requestRoot, "authorization.json")
const consumptionPath = path.join(requestRoot, "consumption.json")
const outputRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudication-failures/${RUN_ID}`)
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })

assert.equal(fs.existsSync(authorizationPath), true, "authorization_missing")
assert.equal(fs.existsSync(consumptionPath), true, "consumption_missing")
assert.equal(fs.existsSync(outputRoot), false, "failure_output_reuse_rejected")
fs.mkdirSync(outputRoot, { recursive: true })
const reportPath = path.join(outputRoot, "failure-report.json")
writeJsonAtomic(reportPath, {
  schemaVersion: "stage4-three-component-smoke-failure-boundary-execution-failure-v1",
  status: "failed_closed_before_adjudication",
  error: "ENOENT_fixed_parent_namespace_missing",
  failedOperation: "create_new_run_directory_beneath_missing_fixed_parent_namespace",
  authorization: bind(authorizationPath), consumption: bind(consumptionPath),
  evidenceAdjudicated: false, uniqueDecisionProduced: false,
  checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false,
  authorizationReusable: false, runIdReusable: false, outputReusable: false,
  correctedRunnerRequiresNewAuthorization: true,
  recordedAtUtc: new Date().toISOString(),
})
const terminalPath = path.join(outputRoot, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-three-component-smoke-failure-boundary-execution-failure-terminal-v1",
  status: "cpu_readonly_adjudication_execution_failed_closed",
  failureReport: bind(reportPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_new_run_after_fixed_parent_namespace_contract_correction",
  recordedAtUtc: new Date().toISOString(),
})
const capsulePath = path.join(outputRoot, "local-task-capsule.json")
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", status: "cpu_readonly_adjudication_execution_failed_closed", latestTerminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, nextLegalAction: "new_owner_authorization_for_corrected_cpu_readonly_adjudication", recordedAtUtc: new Date().toISOString() })
appendAiPainterProgramEvent({ id: `stage4-three-component-smoke-failure-boundary-execution-failure-${RUN_ID}`, timestamp: new Date().toISOString(), action: "stage4_three_component_smoke_failure_boundary_execution_failure", runId: RUN_ID, kind: "cpu_readonly_causal_adjudication", status: "failed", title: "Stage4 three-component adjudication execution failed before decision", titleZh: "Stage4三组件因果裁决在形成结论前执行失败", detailZh: "一次性CPU授权已消费；固定父命名空间缺失导致run目录创建失败。未形成裁决、未读取Checkpoint、未启动GPU或训练。", evidencePath: rel(terminalPath), evidenceSha256: sha(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
process.stdout.write(`${JSON.stringify({ status: "cpu_readonly_adjudication_execution_failed_closed", failureReport: bind(reportPath), terminal: bind(terminalPath), authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, null, 2)}\n`)
