import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { inspectAndAdjudicate, REPAIR_CONTRACT_ID } from "./lib/ai-painter-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return result }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (target, content) => { const temp = `${target}.${process.pid}.${Date.now()}.tmp`; const fd = fs.openSync(temp, "wx"); try { fs.writeFileSync(fd, content, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; fs.renameSync(temp, target) }

const authorizationPath = file(arg("--authorization"))
const expectedSha = arg("--authorization-sha256")
const consumptionPath = file(arg("--consumption"))
assert.equal(sha(authorizationPath), expectedSha, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-reference-feature-scan-rerun-identity-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_scan_vs_differentiable_rerun_execution_identity_causal_adjudication")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.optimizerCreationAuthorized, false)
assert.equal(authorization.backwardAuthorized, false)
assert.equal(authorization.modelWeightModificationAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(authorization.automaticRetryAuthorized, false)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
const output = file(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
for (const [name, item] of Object.entries(authorization.sourceEvidence)) { const target = file(item.path); assert.equal(fs.existsSync(target) && fs.statSync(target).isFile(), true, `${name}_missing`); assert.equal(sha(target), item.sha256, `${name}_sha256_mismatch`) }
const programs = {
  runner: file("scripts/run-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"),
  checker: file("scripts/check-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-reference-feature-scan-rerun-identity-adjudication.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = { schemaVersion: "stage4-reference-feature-scan-rerun-identity-adjudication-consumption-v1", status: "cpu_readonly_adjudication_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorization: bind(authorizationPath), oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const runnerPath = file(authorization.sourceEvidence.gpuRunner.path)
const basePath = file("ml/ai-painter/scripts/run_stage4_epoch_complete_per_class_worst_luminance_gpu_qualification.py")
const { facts, decision } = inspectAndAdjudicate(runnerPath, basePath)
assert.equal(decision.selectedCause, "C", "bound_evidence_must_resolve_C")
const now = new Date().toISOString()
const files = Object.fromEntries(Object.entries({ cpu: "cpu-report.json", report: "analysis-report.json", decision: "decision.json", contract: "inactive-execution-identity-unification-contract.json", owner: "owner-action-request.json", terminal: "phase-terminal.json", capsule: "local-task-capsule.json", planSync: "plan-sync-record.json" }).map(([name, leaf]) => [name, path.join(output, leaf)]))
writeJsonAtomic(files.cpu, { ...cpuReport, sourceBindings: authorization.sourceEvidence, safety: { checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-reference-feature-scan-rerun-identity-decision-v1", status: decision.status, selectedCause: "C", finding: "The failed comparison changed two execution identities at once: the detach scan used batchSize=4 and a 50-step all-no-grad rollout, while the selected-sample recomputation used batchSize=1 and a 45-no-grad plus 5-autograd-step rollout. Sample, source-index mapping, seed, per-sample latent generator, model eval state, deterministic settings, timesteps, decode, reference-feature extraction and class weighting match. The immutable evidence cannot attribute the observed magnitude to only A or only B; C is the unique bounded adjudication.", alternatives: { A: "not_selected_alone_because_graph_identity_also_differs", B: "not_selected_alone_because_batch_identity_also_differs", D: "rejected_all_seed_sample_model_and_path_wiring_identities_match", E: "rejected_structural_evidence_is_complete" }, facts, toleranceRelaxed: false, gpuRerunStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.contract, { schemaVersion: "stage4-reference-feature-scan-rerun-execution-identity-unification-contract-v1", status: "cpu_adjudicated_inactive_not_authorized_for_gpu_or_training", contractId: REPAIR_CONTRACT_ID, allowedImplementation: { scanBatchSize: 1, scanOrder: "one_sample_at_a_time_in_formal_source_index_order", seed: "same_20263722_plus_source_index_as_selected_gradient_rerun", rolloutSteps: 50, noGradSteps: 45, autogradTailSteps: 5, scoreHandling: "form_score_then_detach_score_and_release_graph", selectedGradientRerun: "reuse_same_sample_identity_and_execution_path", validationIdentity: "apply_same_execution_identity_before_detach" }, mustRemainUnchanged: ["dtype_derived_tolerance", "model", "loss_values", "loss_weights", "dataset", "split", "checkpoint_format", "machine_review_thresholds", "training_step_count"], forbidden: ["free_tolerance", "extra_training_steps", "extra_loss_weight", "checkpoint_read", "optimizer", "backward", "weight_modification", "gpu", "training", "automatic_gpu_retry"], activationAuthorized: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, { schemaVersion: "stage4-reference-feature-scan-rerun-identity-analysis-report-v1", status: "scan_rerun_execution_identity_causal_adjudication_succeeded", sourceEvidence: authorization.sourceEvidence, observedFailure: read(file(authorization.sourceEvidence.failureAnalysis.path)).scoreEvidence, structuralComparison: facts, selectedCause: "C", decision: bind(files.decision), inactiveContract: bind(files.contract), safety: { sourceOnlyCpuAnalysis: true, checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, weightsModified: false, trainingStarted: false, automaticGpuRetryStarted: false }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-v1", status: "not_authorized_not_consumed", requestedAction: `implement_${REPAIR_CONTRACT_ID}_cpu_support_and_positive_negative_regression_only`, businessReason: "Unify the scan and differentiable recomputation execution identity before any new GPU qualification. This is an execution-evidence correction, not a model, Loss, data, threshold or training change.", boundDecision: bind(files.decision), boundInactiveContract: bind(files.contract), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-reference-feature-scan-rerun-identity-adjudication-terminal-v1", status: "stage4_reference_feature_scan_rerun_execution_identity_causal_adjudication_succeeded_closed", selectedCause: "C", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, report: bind(files.report), decision: bind(files.decision), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner), nextLegalAction: `owner_authorize_cpu_implementation_of_${REPAIR_CONTRACT_ID}`, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, automaticGpuRetryStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 reference-feature shared replay scan/rerun execution identity adjudicated", latestTerminal: bind(files.terminal), latestDecision: bind(files.decision), nextLegalAction: `owner_authorize_cpu_implementation_of_${REPAIR_CONTRACT_ID}`, evidence: { cpuReport: bind(files.cpu), analysisReport: bind(files.report), inactiveContract: bind(files.contract), authorization: bind(authorizationPath), consumption: bind(consumptionPath) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；参考特征共享回放只读GPU资格的扫描—可微重算分数差已完成CPU只读因果裁决：样本、种子、latent、模型状态、50步时序、解码和特征路径一致，但batch=4/1与全no-grad/5步autograd两项执行身份同时不同，唯一裁决C；未启动GPU或训练")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = "- 参考特征共享回放只读GPU资格的扫描—可微重算执行身份CPU裁决已完成：48条detach扫描使用batchSize=4和50步全no-grad，选中样本梯度重算使用batchSize=1和末5步autograd；样本、source-index、种子、初始latent、模型eval、确定性、50步时序、Autoencoder解码、参考特征提取和类别加权均一致。唯一裁决C，已形成未激活执行身份统一合同；不得放宽dtype边界或自动重跑GPU。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_reference_feature_scan_rerun_identity_adjudication", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) }) }
appendAiPainterProgramEvent({ id: `stage4-reference-feature-scan-rerun-identity-adjudication-${authorization.runId}`, timestamp: now, action: "stage4_reference_feature_scan_rerun_execution_identity_causal_adjudication", runId: authorization.runId, kind: "cpu_readonly_adjudication", status: "success", title: "Stage4 scan/rerun execution identity adjudicated", titleZh: "Stage4扫描—可微重算执行身份已裁决", detailZh: "唯一裁决C：batch=4/1与50步全no-grad/末5步autograd同时不同；其余样本、种子、latent、模型、时序、解码、特征及权重身份一致。", evidencePath: relative(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(files.terminal).status, selectedCause: "C", terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner), cpuReport: bind(files.cpu), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
