import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { ALL_CLASSES, SOURCE_RUN_ID, adjudicateEpochCompleteStage0Failure } from "./lib/ai-painter-stage4-epoch-complete-stage0-causal-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze(["verify_current_stage0_epoch_complete_failure_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_adjudication_authorization", "write_analysis_decision_inactive_contract_or_owner_request_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const DENIALS = Object.freeze(["read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss", "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target", "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint", "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return result }
const shaFile = (value) => { const hash = crypto.createHash("sha256"); const fd = fs.openSync(value, "r"); const buffer = Buffer.allocUnsafe(1024 * 1024); try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count)) } finally { fs.closeSync(fd) } return hash.digest("hex") }
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (target, content) => { const temp = `${target}.${process.pid}.${Date.now()}.tmp`; const fd = fs.openSync(temp, "wx"); try { fs.writeFileSync(fd, content, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; fs.renameSync(temp, target) }

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-epoch-complete-stage0-causal-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.sourceRunId, SOURCE_RUN_ID)
assert.equal(authorization.scope, "one_cpu_readonly_current_stage0_footprints_tree_vegetation_reference_semantic_causal_adjudication")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(DENIALS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
const sourceRoot = `.runtime/ai-painter/stage4-semantic-mixture-formal-training/${SOURCE_RUN_ID}/`
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  if (name !== "sourceIndex") assert.equal(evidence.path.startsWith(sourceRoot), true, `${name}_historical_run_rejected`)
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  if (name !== "failedCheckpointIdentityOnly") assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = { runner: projectFile("scripts/run-stage4-epoch-complete-stage0-causal-adjudication.mjs"), checker: projectFile("scripts/check-stage4-epoch-complete-stage0-causal-adjudication.mjs"), decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-epoch-complete-stage0-causal-adjudication.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = { schemaVersion: "stage4-epoch-complete-stage0-causal-consumption-v1", status: "cpu_readonly_adjudication_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256: authorizationSha, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }

const manifest = readJson(projectFile(authorization.sourceEvidence.stage0Manifest.path))
const telemetry = readJson(projectFile(authorization.sourceEvidence.stage0Telemetry.path))
const sourceIndex = readJson(projectFile(authorization.sourceEvidence.sourceIndex.path))
const replayEvents = telemetry.events.filter((event) => event.step === "epoch_complete_per_class_selected_luminance_replay")
const replayEpochs = [...new Set(replayEvents.map((event) => event.epoch))].sort((a, b) => a - b)
let malformed = 0
let epochCoverage = true
let passCoverage = true
let classCoverage = true
let matchesPrevious = true
for (const epoch of replayEpochs) {
  const events = replayEvents.filter((event) => event.epoch === epoch)
  const batches = new Set(events.map((event) => event.batch))
  const passes = [...new Set(events.map((event) => event.replayPass))].sort()
  epochCoverage &&= events.length === 96 && batches.size === 48 && Math.min(...batches) === 1 && Math.max(...batches) === 48
  passCoverage &&= same(passes, [1, 2])
  const counts = Object.fromEntries(ALL_CLASSES.map((name) => [name, events.filter((event) => event.classIdentity === name).length]))
  classCoverage &&= ALL_CLASSES.every((name) => counts[name] === 24)
  const prior = manifest.metrics.find((row) => row.epoch === epoch - 1)?.trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections ?? []
  const expected = new Map(prior.map((entry) => [entry.classIdentity, entry]))
  for (const event of events) {
    const selection = expected.get(event.classIdentity)
    if (!selection || event.sampleId !== selection.sampleId || event.selectionScore !== selection.weightedScore) matchesPrevious = false
    if (event.status !== "completed" || !Number.isInteger(event.batch) || !Number.isInteger(event.replayPass) || !Number.isFinite(event.selectionScore)) malformed += 1
  }
}
const telemetryInspection = { stepIdentity: "epoch_complete_per_class_selected_luminance_replay", totalEvents: replayEvents.length, epochs: replayEpochs, eachEpochHas48BatchesAnd96Events: epochCoverage, eachEpochHasTwoPasses: passCoverage, eachEpochHas24EventsPerClass: classCoverage, matchesPreviousEpochSelections: matchesPrevious, unknownOrMalformedEvents: malformed }

const contributions = sourceIndex.v7CapacityContributions
const trainIds = new Set(contributions.filter((row) => row.split === "train").map((row) => row.sampleId))
const validationIds = new Set(contributions.filter((row) => row.split === "validation").map((row) => row.sampleId))
const trainSelections = manifest.metrics.flatMap((row) => row.trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections ?? [])
const validationSelections = manifest.metrics.flatMap((row) => row.validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointSelections ?? [])
const validationIdentityCounts = manifest.metrics.map((row) => row.validationRolloutEpochCompletePerClassWorstSampleFinalVisibleLuminanceCheckpointIdentityCount)
const sourceIndexInspection = { trainCount: trainIds.size, validationCount: validationIds.size, rolloutSeedCount: Math.max(...validationIdentityCounts) / validationIds.size, allTrainSelectionsBelongToTrain: trainSelections.every((entry) => trainIds.has(entry.sampleId)), allValidationSelectionsBelongToValidation: validationSelections.every((entry) => validationIds.has(entry.sampleId)) }

const decision = adjudicateEpochCompleteStage0Failure({
  terminal: readJson(projectFile(authorization.sourceEvidence.stage0Terminal.path)),
  manifest,
  review: readJson(projectFile(authorization.sourceEvidence.stage0MachineReview.path)),
  activeConfig: readJson(projectFile(authorization.sourceEvidence.activeConfig.path)),
  failedCheckpointIdentity: { path: authorization.sourceEvidence.failedCheckpointIdentityOnly.path, sha256: authorization.sourceEvidence.failedCheckpointIdentityOnly.sha256 },
  telemetryInspection,
  sourceIndexInspection,
  directClassInterferenceEvidence: false,
})
assert.equal(decision.selectedCause, "A")

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = { cpu: path.join(output, "cpu-report.json"), report: path.join(output, "causal-analysis-report.json"), decision: path.join(output, "adjudication.json"), contract: path.join(output, "inactive-repair-contract.json"), owner: path.join(output, "owner-action-request.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
const sourceEvidence = authorization.sourceEvidence
writeJsonAtomic(files.cpu, { ...cpuReport, sourceRunId: SOURCE_RUN_ID, sourceEvidence, telemetryInspection, sourceIndexInspection, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, { schemaVersion: "stage4-epoch-complete-stage0-causal-analysis-report-v1", status: "active_legal_objectives_insufficient_for_multisample_final_visible_reference_semantics_confirmed", businessFinding: "The complete Stage 0 engineering chain ran correctly. Road, water and rock pass at Epoch 40; footprints, tree and vegetation remain below the frozen held-out luminance-correlation requirement despite valid local response.", causalFinding: "The former batch-local selector defect is absent: all 48 train identities are collected, two replay passes execute for every primary batch from Epoch 2 onward, and all 8 validation records across two rollout seeds feed persisted per-class checkpoint identities. Legal objectives improve, so the remaining failure is not explained by the previously repaired identity wiring.", decision, sourceEvidence, telemetryInspection, sourceIndexInspection, cpuReport: bind(files.cpu), checkpointWeightsRead: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-epoch-complete-stage0-causal-decision-v1", status: decision.status, selectedCause: "A", alternatives: decision.alternatives, evidence: decision.evidence, report: bind(files.report), boundedInactiveContractGenerated: true, stage1EntryPermitted: false, stage2EntryPermitted: false, automaticRetryAllowed: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-final-visible-reference-semantic-supervision-identifiability-review-contract-v1",
  status: "bounded_inactive_not_authorized_for_execution",
  contractId: decision.nextContractId,
  purpose: "Determine whether the approved data contains a uniquely derivable, not-yet-covered final-visible semantic signal for footprints, tree, and vegetation before any further training target is built.",
  scope: { mode: "cpu_readonly_design_and_data_trace_only", classes: ["footprints", "tree", "vegetation"], records: "64_approved_records_with_48_8_4_4_split_preserved", compareExistingTargets: ["final_visible_rgb", "multiscale_luminance_structure", "frozen_autoencoder_reference_feature_structure", "complete_epoch_per_class_worst_sample_replay"] },
  requiredSources: ["original_owner_approved_reference_rgb", "original_object_semantic_masks", "formal_23_channel_condition_pack", "approved_source_index_and_split_identity", "existing_frozen_autoencoder_feature_contract"],
  requiredOutcome: "one_uniquely_derived_not_yet_covered_supervision_expression_or_project_level_owner_route_decision",
  forbiddenSources: ["failed_preview_pixels", "machine_review_thresholds_as_targets", "machine_review_pass_fail_results_as_targets", "failed_checkpoint_weights"],
  invariants: { modelArchitectureChanged: false, existingLossWeightsChanged: false, dataOrSplitChanged: false, checkpointFormatChanged: false, machineReviewThresholdsChanged: false, freeHyperparametersSelected: false },
  executionAuthorized: false,
  boundDecision: bind(files.decision),
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-v1", status: "not_authorized_not_consumed", requestedAction: `execute_cpu_readonly_${decision.nextContractId}`, businessReason: "The complete-epoch selection and checkpoint identity chain is correct, but legal active targets still do not constrain held-out footprints/tree/vegetation luminance semantics sufficiently. A new training run is not justified until a uniquely derivable missing supervision signal is proven.", boundDecision: bind(files.decision), boundInactiveContract: bind(files.contract), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-epoch-complete-stage0-causal-terminal-v1", status: "stage0_active_legal_objectives_insufficient_adjudicated_closed", sourceRunId: SOURCE_RUN_ID, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, selectedCause: "A", stage0FailedClosed: true, stage1Started: false, stage2Started: false, nextLegalAction: `owner_authorize_cpu_readonly_${decision.nextContractId}`, report: bind(files.report), decision: bind(files.decision), inactiveRepairContract: bind(files.contract), ownerActionRequest: bind(files.owner), automaticRetryStarted: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 Stage 0 footprints/tree/vegetation reference semantic failure causally adjudicated", latestTerminal: bind(files.terminal), latestBlocker: "active_legal_objectives_insufficient_for_multisample_final_visible_reference_semantics", nextLegalAction: `owner_authorize_cpu_readonly_${decision.nextContractId}`, forbiddenActions: DENIALS, evidence: { sourceEvidence, cpuReport: bind(files.cpu), report: bind(files.report), decision: bind(files.decision), inactiveRepairContract: bind(files.contract), ownerActionRequest: bind(files.owner) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；当前完整Epoch逐类别最差样本选择候选的Stage 0已完成40 Epoch并真实视觉失败。CPU只读裁决确认旧的batch局部选择缺陷已修复，48条train、两次回放及8条validation×2 seeds身份链完整；合法目标和选择分数下降，但Epoch 40仅道路、水体、rock通过，footprints/tree/vegetation参考亮度语义仍不足。唯一裁决A，Stage 1/2未启动")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(plan.includes(anchor), true, "plan_anchor_missing")
const bullet = "- 当前完整Epoch逐类别最差选择Stage 0的独立CPU只读裁决已经完成：48条train完整选择、Epoch 2–40每轮48批×2次回放、全部8条validation×2 rollout seeds及逐类Checkpoint身份均正确，旧B类接线缺陷不再存在；合法目标与Checkpoint分数改善，但Epoch 40仅road、water、rock通过，footprints/tree/vegetation的maskedLumaCorrelation为0.0694/0.0225/0.0716，仍低于0.08。唯一裁决A，当前只能先执行CPU只读合法监督可辨识性复核，不得复用失败Checkpoint或进入Stage 1。\n"
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_epoch_complete_stage0_causal_adjudication", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) }) }
appendAiPainterProgramEvent({ id: `stage4-epoch-complete-stage0-adjudication-${authorization.runId}`, timestamp: now, action: "stage4_epoch_complete_stage0_reference_semantic_causal_adjudication", runId: authorization.runId, kind: "cpu_readonly_adjudication", status: "success", title: "Stage4 Stage 0 active legal objectives adjudicated insufficient", titleZh: "Stage4 Stage 0已裁决为合法目标完整激活但仍不足", detailZh: "旧的batch局部选择缺陷已修复；48条train、两次回放及8条validation×2 seeds身份完整。footprints/tree/vegetation最终参考亮度语义仍未达标，唯一裁决A。", evidencePath: relative(files.terminal), evidenceSha256: shaFile(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: readJson(files.terminal).status, selectedCause: "A", terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision), inactiveRepairContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
