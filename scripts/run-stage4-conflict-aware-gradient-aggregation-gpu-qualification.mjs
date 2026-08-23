import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return result }
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const authorizationPath = projectFile(arg("--authorization"))
const authorizationSha = arg("--authorization-sha256")
assert.equal(sha(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-conflict-aware-existing-gradient-aggregation-readonly-gpu-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_readonly_gpu_stage4_conflict_aware_existing_gradient_aggregation_qualification")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.gpuAuthorized, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, true)
for (const name of ["denoiserCheckpointReadAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized"]) assert.equal(authorization[name], false)
for (const [name, evidence] of Object.entries(authorization.bindings)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-conflict-aware-gradient-aggregation-gpu-qualification.mjs"),
  checker: projectFile("ml/ai-painter/scripts/check_stage4_conflict_aware_existing_gradient_aggregation_gpu_entry_cpu.py"),
  gpuRunner: projectFile("ml/ai-painter/scripts/run_stage4_conflict_aware_existing_gradient_aggregation_gpu_qualification.py"),
  trainer: projectFile("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])), "program_lineage_mismatch")
const output = projectFile(authorization.execution.outputDirectory)
const consumption = projectFile(authorization.execution.consumptionPath)
assert.equal(fs.existsSync(output), false)
assert.equal(fs.existsSync(consumption), false)
const python = projectFile("ml/ai-painter/.venv/Scripts/python.exe")
const env = { ...process.env, PYTHONPATH: `${projectFile("ml/ai-painter/src")}${path.delimiter}${projectFile("ml/ai-painter/scripts")}` }
for (const source of [programs.checker, programs.gpuRunner, programs.trainer]) {
  const syntax = spawnSync(python, ["-m", "py_compile", source], { cwd: ROOT, env, encoding: "utf8" })
  assert.equal(syntax.status, 0, `python_syntax_failed:${relative(source)}:${syntax.stderr}`)
}
const cpu = spawnSync(python, [programs.checker, "--config", authorization.bindings.inactiveConfig.path, "--runner", relative(programs.gpuRunner)], { cwd: ROOT, env, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
const pythonArgs = [programs.gpuRunner, "--authorization", relative(authorizationPath), "--authorization-sha256", authorizationSha, "--consumption", relative(consumption), "--output-dir", authorization.execution.outputDirectory]
const preflight = spawnSync(python, [...pythonArgs, "--preflight-only"], { cwd: ROOT, env, encoding: "utf8" })
assert.equal(preflight.status, 0, `preflight_failed:${preflight.stderr}`)
const preflightReport = JSON.parse(preflight.stdout)
assert.equal(preflightReport.status, "passed_gpu_not_started_not_consumed_checkpoint_not_read")
assert.equal(fs.existsSync(consumption), false)
assert.equal(fs.existsSync(output), false)
writeJsonAtomic(path.join(path.dirname(authorizationPath), "cpu-report.json"), { ...cpuReport, authorization: bind(authorizationPath) })
writeJsonAtomic(path.join(path.dirname(authorizationPath), "preflight-report.json"), { ...preflightReport, authorization: bind(authorizationPath) })
console.log(JSON.stringify({ status: "cpu_and_resource_preflight_passed", runId: authorization.runId, next: "readonly_gpu_56_record_conflict_projection_qualification" }))
const gpu = spawnSync(python, pythonArgs, { cwd: ROOT, env, stdio: "inherit" })
if (gpu.status !== 0) {
  const failure = path.join(path.dirname(authorizationPath), "gpu-failure-terminal.json")
  const now = new Date().toISOString()
  writeJsonAtomic(failure, { schemaVersion: "stage4-conflict-aware-gradient-aggregation-gpu-failure-terminal-v1", status: "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_failed_closed", runId: authorization.runId, authorization: bind(authorizationPath), consumption: fs.existsSync(consumption) ? bind(consumption) : null, exitCode: gpu.status, partialOutputDirectory: authorization.execution.outputDirectory, trainingStarted: false, modelWeightsModified: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
  appendAiPainterProgramEvent({ id: `stage4-conflict-aware-gradient-aggregation-gpu-failure-${authorization.runId}`, timestamp: now, action: "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_qualification", runId: authorization.runId, kind: "readonly_gpu_qualification_failure", status: "failed", title: "Conflict-aware gradient aggregation GPU qualification failed", titleZh: "冲突感知梯度聚合只读GPU资格失败关闭", detailZh: "GPU资格执行失败；未训练、未修改权重，授权不可复用。", evidencePath: relative(failure), evidenceSha256: sha(failure), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
  throw new Error(`gpu_qualification_failed:${gpu.status}:${relative(failure)}`)
}
const files = {
  gpu: path.join(output, "gpu-report.json"),
  telemetry: path.join(output, "cuda-telemetry.json"),
  states: path.join(output, "model-state-hashes.json"),
  cpu: path.join(output, "cpu-report.json"),
  preflight: path.join(output, "preflight-report.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumption) })
writeJsonAtomic(files.preflight, { ...preflightReport, authorization: bind(authorizationPath), authorizationUnconsumedAtPreflight: true })
const report = read(files.gpu)
assert.equal(report.status, "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_qualification_passed")
assert.deepEqual(report.population, { train: 48, validation: 8 })
assert.equal(report.totalNegativeProjectionCount > 0, true)
assert.equal(report.totalNonNegativeUnchangedCount > 0, true)
assert.equal(report.stateHashes.denoiserUnchanged, true)
assert.equal(report.stateHashes.autoencoderUnchanged, true)
assert.deepEqual(report.safety, { optimizerCreated: false, backwardExecuted: false, modelWeightsModified: false, trainingStarted: false, denoiserCheckpointRead: false, failedCheckpointRead: false, checkpointWritten: false })
const now = new Date().toISOString()
writeJsonAtomic(files.owner, { schemaVersion: "stage4-conflict-aware-gradient-aggregation-smoke-owner-action-request-v1", status: "owner_action_requested", requestedAction: "compile_and_execute_one_new_30_epoch_model_smoke_with_conflict_aware_existing_gradient_aggregation", gpuReport: bind(files.gpu), cudaTelemetry: bind(files.telemetry), inactiveConfig: authorization.bindings.inactiveConfig, supportContract: authorization.bindings.supportContract, smokeAuthorized: false, trainingAuthorized: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-conflict-aware-gradient-aggregation-gpu-terminal-v1", status: "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_succeeded_closed", contractId: report.contractId, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, gpuReport: bind(files.gpu), cudaTelemetry: bind(files.telemetry), stateHashes: bind(files.states), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), checkpointWritten: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 conflict-aware existing-gradient aggregation readonly GPU qualification passed", latestTerminal: bind(files.terminal), latestFinding: "real_cuda_projection_and_nonconflicting_identity_verified_across_48_train_and_8_validation", nextLegalAction: "owner_authorize_one_new_30_epoch_model_smoke", evidence: { gpuReport: bind(files.gpu), cpuReport: bind(files.cpu), cudaTelemetry: bind(files.telemetry), stateHashes: bind(files.states) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const before = sha(planPath)
let text = fs.readFileSync(planPath, "utf8")
text = text.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
text = text.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4冲突感知现有梯度聚合已完成48条train与8条validation的只读GPU资格，下一业务门为一次全新30 Epoch模型Smoke")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(text.includes(anchor), true)
const bullet = `- Stage4冲突感知现有梯度聚合只读GPU资格已覆盖48条train与8条validation；严格负点积投影、非负梯度保持及模型状态冻结均通过。证据：\`${relative(files.terminal)}\`。\n`
if (!text.includes(bullet.trim())) text = text.replace(anchor, `${bullet}\n${anchor}`)
const temp = `${planPath}.${process.pid}.${Date.now()}.tmp`
fs.writeFileSync(temp, text)
fs.renameSync(temp, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), planSha256Before: before, terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const target of [authorizationPath, consumption, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_conflict_aware_gradient_aggregation_readonly_gpu_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) })
}
appendAiPainterProgramEvent({ id: `stage4-conflict-aware-gradient-aggregation-gpu-${authorization.runId}`, timestamp: now, action: "stage4_conflict_aware_existing_gradient_aggregation_readonly_gpu_qualification", runId: authorization.runId, kind: "readonly_gpu_qualification", status: "success", title: "Conflict-aware existing-gradient aggregation GPU qualification passed", titleZh: "冲突感知现有梯度聚合只读GPU资格通过", detailZh: "48条训练与8条验证记录完成真实CUDA梯度投影资格；未训练、未修改权重。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, terminal: bind(files.terminal), gpuReport: bind(files.gpu), cudaTelemetry: bind(files.telemetry), stateHashes: bind(files.states), cpuReport: bind(files.cpu), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
