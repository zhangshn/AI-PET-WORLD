import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const PYTHON = path.resolve(ROOT, "ml/ai-painter/.venv/Scripts/python.exe")
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const writeTextAtomic = (target, content) => { const temp = `${target}.${process.pid}.${Date.now()}.tmp`; const fd = fs.openSync(temp, "wx"); try { fs.writeFileSync(fd, content, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; fs.renameSync(temp, target) }

const authorizationPath = file(arg("--authorization"))
const expectedSha = arg("--authorization-sha256")
const consumptionPath = file(arg("--consumption"))
assert.equal(sha(authorizationPath), expectedSha, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-reference-feature-scan-rerun-identity-unification-cpu-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_only_reference_feature_scan_rerun_execution_identity_unification_implementation_and_regression")
assert.equal(authorization.contractId, "stage4_reference_feature_scan_rerun_execution_identity_unification_v1")
for (const flag of ["checkpointReadAuthorized", "gpuAuthorized", "optimizerCreationAuthorized", "backwardAuthorized", "modelWeightModificationAuthorized", "trainingAuthorized", "automaticRetryAuthorized"]) assert.equal(authorization[flag], false, `${flag}_must_be_false`)
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
for (const [name, item] of Object.entries(authorization.sourceEvidence)) { const target = file(item.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), item.sha256, `${name}_sha256_mismatch`) }
const programs = {
  implementationRunner: file("scripts/run-stage4-reference-feature-scan-rerun-identity-unification-cpu-implementation.mjs"),
  gpuRunner: file("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_qualification.py"),
  cpuChecker: file("ml/ai-painter/scripts/check_stage4_epoch_complete_per_class_worst_reference_feature_shared_replay_gpu_entry_cpu.py"),
  trainer: file("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"),
  rolloutBase: file("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification.py"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
assert.equal(fs.existsSync(PYTHON), true, "project_python_missing")
const syntax = spawnSync(PYTHON, ["-c", "import ast,pathlib; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8')) for p in __import__('sys').argv[1:]]", programs.gpuRunner, programs.cpuChecker], { cwd: ROOT, encoding: "utf8" })
assert.equal(syntax.status, 0, `python_syntax_failed:${syntax.stderr}`)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = { schemaVersion: "stage4-reference-feature-scan-rerun-identity-unification-cpu-consumption-v1", status: "cpu_implementation_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorization: bind(authorizationPath), oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const cpuPath = path.join(output, "cpu-report.json")
const cpu = spawnSync(PYTHON, [programs.cpuChecker, "--contract-regression-only", "--output", relative(cpuPath)], { cwd: ROOT, encoding: "utf8", timeout: 120000 })
if (cpu.status !== 0) throw new Error(`cpu_regression_failed:${cpu.stdout}:${cpu.stderr}`)
const cpuReport = read(cpuPath)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)
const now = new Date().toISOString()
const files = Object.fromEntries(Object.entries({ contract: "cpu-support-contract.json", owner: "owner-action-request.json", terminal: "phase-terminal.json", capsule: "local-task-capsule.json", planSync: "plan-sync-record.json" }).map(([name, leaf]) => [name, path.join(output, leaf)]))
writeJsonAtomic(files.contract, { schemaVersion: "stage4-reference-feature-scan-rerun-execution-identity-unification-support-v1", status: "cpu_support_verified_inactive", contractId: authorization.contractId, implementation: { trainScanBatchSize: 1, validationScanBatchSize: 1, selectedRerunBatchSize: 1, rolloutSteps: 50, noGradSteps: 45, autogradTailSteps: 5, scanOrder: "formal_source_index_one_sample_at_a_time", scoreHandling: "detach_immediately_then_release_graph", sampleSeedLatentModelTimestepDecodeFeatureAndWeightingIdentityUnified: true }, unchanged: { dtypeDerivedTolerance: true, trainingSteps: true, lossWeights: true, model: true, data: true, checkpoint: true, reviewThresholds: true }, activationAuthorized: false, cpuReport: bind(cpuPath), programLineage: authorization.programLineage, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-v1", status: "not_authorized_not_consumed", requestedAction: "execute_new_independent_readonly_gpu_qualification_for_reference_feature_shared_replay_after_execution_identity_unification", businessReason: "CPU regression proves scan and selected differentiable recomputation now use one execution identity. A new one-time read-only GPU qualification is required to test the real CUDA path; no training is requested.", boundSupportContract: bind(files.contract), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-reference-feature-scan-rerun-execution-identity-unification-terminal-v1", status: "stage4_reference_feature_scan_rerun_execution_identity_unification_cpu_succeeded_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, cpuReport: bind(cpuPath), supportContract: bind(files.contract), ownerActionRequest: bind(files.owner), nextLegalAction: "owner_authorize_new_independent_readonly_gpu_qualification_after_execution_identity_unification", checkpointRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 reference-feature shared replay scan/rerun execution identity CPU support complete", latestTerminal: bind(files.terminal), evidence: { cpuReport: bind(cpuPath), supportContract: bind(files.contract), authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, nextLegalAction: "owner_authorize_new_independent_readonly_gpu_qualification_after_execution_identity_unification", recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；参考特征共享回放扫描—可微重算执行身份已完成CPU统一：train与validation均逐样本batch=1，并与选中重算共用45步no-grad＋5步autograd尾段，分数形成后detach释放图；CPU正反回归通过，GPU与训练未启动")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = "- `stage4_reference_feature_scan_rerun_execution_identity_unification_v1`的CPU支持已完成：48条train扫描、全部validation轨迹和选中样本梯度重算统一为batchSize=1、同种子、同50步路径及末5步autograd，分数形成后立即detach并释放图；未放宽dtype边界、增加训练步骤或修改模型/Loss/数据/阈值。下一步仅可使用全新授权执行独立只读GPU资格。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
for (const target of [authorizationPath, consumptionPath, cpuPath, ...Object.values(files)]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_reference_feature_scan_rerun_identity_unification_cpu_support", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) }) }
appendAiPainterProgramEvent({ id: `stage4-reference-feature-scan-rerun-identity-unification-cpu-${authorization.runId}`, timestamp: now, action: "stage4_reference_feature_scan_rerun_execution_identity_unification_cpu_support", runId: authorization.runId, kind: "cpu_implementation_and_regression", status: "success", title: "Stage4 scan/rerun execution identity unified", titleZh: "Stage4扫描—可微重算执行身份CPU统一完成", detailZh: `train/validation/重算统一为batch=1和45+5路径；CPU正向${cpuReport.positivePassed}/${cpuReport.positiveTotal}、反向${cpuReport.negativePassed}/${cpuReport.negativeTotal}通过，GPU和训练未启动。`, evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, terminal: bind(files.terminal), cpuReport: bind(cpuPath), supportContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync), updatedProgramLineage: { gpuRunner: bind(programs.gpuRunner), cpuChecker: bind(programs.cpuChecker) } }, null, 2))
