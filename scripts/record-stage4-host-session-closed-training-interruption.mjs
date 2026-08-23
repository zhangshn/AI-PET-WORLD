import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const OLD_PACKAGE_ID = "owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823004026023"
const OLD_STAGE0_RUN_ID = "20260823-083751371-capacity-stage0"
const BINDINGS = Object.freeze({
  package: [`.runtime/ai-painter/owner-action-requests/${OLD_PACKAGE_ID}/package.json`, "de2c561a4a29a6b55d3c1dc10658a23daf1b1e9c0f7a52bcb46eb4a0676b9a97"],
  executionState: [`.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${OLD_PACKAGE_ID}/execution-state.json`, "4d3b0c357457c041487bc7a5a9b554b1238f559f2f7b0b1f279093421ea26f92"],
  progress: [`.runtime/ai-painter/stage4-semantic-mixture-formal-training/${OLD_STAGE0_RUN_ID}/training-output/progress.json`, "0e4d71c17a9ed8d2fee3cb002aff50a6fdb06c22a9987559a788c4eb27a065ae"],
  backgroundCpuReport: [".runtime/ai-painter/stage4-background-continuation-cpu-regressions/20260823-102000000/cpu-report.json", null],
})
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const output = resolveProject(`.runtime/ai-painter/stage4-host-session-training-interruptions/${runId}`)
assert.equal(fs.existsSync(output), false, "output_namespace_exists")
for (const [name, [relative, expected]] of Object.entries(BINDINGS)) {
  const target = resolveProject(relative)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (expected) assert.equal(sha(target), expected, `${name}_sha256_mismatch`)
}
const executionState = read(resolveProject(BINDINGS.executionState[0]))
const progress = read(resolveProject(BINDINGS.progress[0]))
assert.equal(executionState.status, "running", "stale_execution_state_expected")
assert.equal(executionState.activeRole, "stage0", "stale_active_role_expected")
assert.equal(progress.status, "running", "stale_progress_status_expected")
const live = progress.liveProgress ?? progress
assert.equal(live.optimizerStep, 2736, "interrupted_optimizer_step_mismatch")
assert.equal(live.optimizerStepTarget, 5760, "optimizer_target_mismatch")
assert.equal(live.epoch, 19, "interrupted_epoch_mismatch")

const processQuery = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$items = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${OLD_PACKAGE_ID}*' -or $_.CommandLine -like '*${OLD_STAGE0_RUN_ID}*' } | Select-Object ProcessId,ParentProcessId,Name,CommandLine); $items | ConvertTo-Json -Depth 4 -Compress`], { cwd: ROOT, encoding: "utf8", windowsHide: true })
assert.equal(processQuery.status, 0, `process_query_failed:${processQuery.stderr}`)
const processText = processQuery.stdout.trim()
const processes = processText ? (Array.isArray(JSON.parse(processText)) ? JSON.parse(processText) : [JSON.parse(processText)]) : []
const unrelatedShells = processes.filter((item) => /powershell|pwsh/iu.test(item.Name ?? "") && String(item.CommandLine ?? "").includes("Get-CimInstance Win32_Process"))
const matchingProcesses = processes.filter((item) => !unrelatedShells.includes(item))
assert.equal(matchingProcesses.length, 0, "old_training_process_still_alive")

fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const problemPath = path.join(output, "problem-report.json")
const analysisPath = path.join(output, "causal-analysis.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
const processPath = path.join(output, "process-snapshot.json")
writeJsonAtomic(processPath, {
  schemaVersion: "stage4-host-session-interruption-process-snapshot-v1",
  status: "no_old_training_process_found",
  oldPackageId: OLD_PACKAGE_ID,
  oldStage0RunId: OLD_STAGE0_RUN_ID,
  matchingProcesses,
  recordedAtUtc: now,
})
writeJsonAtomic(problemPath, {
  schemaVersion: "stage4-host-session-closed-training-interruption-problem-v1",
  status: "host_session_closed_training_interruption_confirmed",
  classification: "execution_host_topology_defect_not_model_or_visual_failure",
  ownerAction: "Codex desktop task was closed",
  observedEffect: "foreground process tree ended and the formal coordinator/trainer stopped without a formal phase terminal",
  staleEvidence: { executionState: binding(BINDINGS.executionState[0]), progress: binding(BINDINGS.progress[0]) },
  lastDurableProgress: { stage: 0, epoch: 19, epochs: 40, optimizerStep: 2736, optimizerStepTarget: 5760, stagePercent: 47.5, updatedAtUtc: progress.updatedAtUtc ?? live.updatedAtUtc ?? null },
  failedCheckpointClassification: "partial_weights_never_eligible_for_reuse",
  recordedAtUtc: now,
})
writeJsonAtomic(analysisPath, {
  schemaVersion: "stage4-host-session-closed-training-interruption-analysis-v1",
  status: "host_process_tree_coupling_root_cause_confirmed",
  cause: "The continuation coordinator was launched inside the Codex foreground terminal process tree. Closing Codex terminated that host tree and therefore the child trainer.",
  excludedCauses: ["model_training_failure", "machine_visual_failure", "cuda_failure", "resource_gate_failure", "dataset_failure"],
  correction: "Launch the unchanged signed coordinator through a Windows WMI-brokered process whose parent is outside the Codex process tree; persist a 10-second heartbeat and terminal locally.",
  backgroundDisconnectRegression: binding(BINDINGS.backgroundCpuReport[0]),
  oldProcessSnapshot: binding(processPath),
  recordedAtUtc: now,
})
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-host-session-closed-training-interruption-terminal-v1",
  status: "host_session_closed_training_interrupted_closed",
  oldPackage: binding(BINDINGS.package[0]),
  oldExecutionState: binding(BINDINGS.executionState[0]),
  oldProgress: binding(BINDINGS.progress[0]),
  problemReport: binding(problemPath),
  causalAnalysis: binding(analysisPath),
  processSnapshot: binding(processPath),
  formalTrainingFailure: false,
  visualFailure: false,
  automaticRetry: false,
  oldPackageReusable: false,
  oldRunIdReusable: false,
  oldOutputReusable: false,
  partialWeightsReusable: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "compile_and_owner_sign_one_fresh_capacity_stage0_to_stage2_package_then_launch_via_wmi_background_host",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter Stage4",
  currentStage: "Host-session interruption fixed; fresh capacity Stage 0 to Stage 2 package required",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  candidateTerminal: binding(terminalPath),
  latestBlocker: "old signed package and Stage0 authorization were consumed before host interruption",
  nextLegalAction: "one_new_owner_offline_signature_then_background_launch",
  recordedAtUtc: now,
})
appendAiPainterProgramEvent({
  id: `stage4-host-session-interruption-${runId}`,
  timestamp: now,
  action: "stage4_host_session_training_interruption",
  runId,
  kind: "execution_host_topology_correction",
  status: "failed",
  title: "Stage4 host session interruption recorded",
  titleZh: "Stage4训练因宿主会话关闭而中断",
  detailZh: "该事件不是模型、视觉或CUDA失败；旧运行停在Epoch 19、2736/5760。旧包和部分权重不可复用，后台隔离回归已通过。",
  evidencePath: project(terminalPath),
  evidenceSha256: sha(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "host_session_closed_training_interrupted_closed", terminal: binding(terminalPath), lastDurableProgress: { epoch: 19, optimizerStep: 2736, optimizerStepTarget: 5760, stagePercent: 47.5 }, nextLegalAction: "fresh_signed_package_and_wmi_background_launch" }, null, 2))

function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function resolveProject(value) { assert.equal(path.isAbsolute(value), false, "project_relative_path_required"); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_path_boundary_required"); return target }
function project(value) { return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function binding(value) { const target = path.isAbsolute(value) ? path.resolve(value) : resolveProject(value); assert.equal(target === ROOT || target.startsWith(`${ROOT}${path.sep}`), true, "project_path_boundary_required"); return { path: project(target), sha256: sha(target) } }
