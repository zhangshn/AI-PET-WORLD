import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { OBJECT_CLASSES, SOURCE_RUN_ID, adjudicateCurrentStage0Failure } from "./lib/ai-painter-stage4-current-stage0-four-object-causal-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze(["verify_current_stage0_four_object_failure_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_adjudication_authorization", "write_problem_analysis_decision_route_exit_owner_request_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const DENIALS = Object.freeze(["read_or_load_checkpoint_weights", "reuse_failed_checkpoint", "modify_model", "modify_loss", "select_free_hyperparameters", "start_gpu", "start_training", "rerun_stage0", "lower_review_thresholds", "use_failed_preview_as_training_target", "use_review_result_as_training_target", "reuse_historical_stage0", "reuse_old_run_id", "reuse_old_authorization", "reuse_old_checkpoint", "auto_generate_new_model", "auto_generate_new_training_objective", "start_stage1", "start_stage2", "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const result = path.resolve(ROOT, value); assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return result }
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
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
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-current-stage0-four-object-causal-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.sourceRunId, SOURCE_RUN_ID)
assert.equal(authorization.scope, "one_cpu_readonly_current_stage0_four_object_reference_semantic_causal_adjudication")
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
const programs = { runner: projectFile("scripts/run-stage4-current-stage0-four-object-causal-adjudication.mjs"), checker: projectFile("scripts/check-stage4-current-stage0-four-object-causal-adjudication.mjs"), decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-current-stage0-four-object-causal-adjudication.mjs") }
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
const consumption = { schemaVersion: "stage4-current-stage0-four-object-causal-consumption-v1", status: "cpu_readonly_adjudication_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256: authorizationSha, oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }

const manifest = readJson(projectFile(authorization.sourceEvidence.stage0Manifest.path))
const telemetry = readJson(projectFile(authorization.sourceEvidence.stage0Telemetry.path))
const sourceIndex = readJson(projectFile(authorization.sourceEvidence.sourceIndex.path))
const metricsByEpoch = new Map(manifest.metrics.map((entry) => [entry.epoch, entry]))
const expectedEpochs = Array.from({ length: 39 }, (_, index) => index + 2)
const inspectStep = (step, replayPass, selectionField) => {
  const events = telemetry.events.filter((event) => event.step === step)
  let batchesComplete = true
  let passCorrect = true
  let rotationCorrect = true
  let matchesPrior = true
  let malformed = 0
  for (const epoch of expectedEpochs) {
    const rows = events.filter((event) => event.epoch === epoch)
    batchesComplete &&= rows.length === 48 && new Set(rows.map((event) => event.batch)).size === 48
    const priorSelections = new Map((metricsByEpoch.get(epoch - 1)?.[selectionField] ?? []).map((entry) => [entry.classIdentity, entry]))
    for (const event of rows) {
      passCorrect &&= event.replayPass === replayPass
      const expectedClass = OBJECT_CLASSES[(event.batch - 1) % OBJECT_CLASSES.length]
      rotationCorrect &&= event.classIdentity === expectedClass
      const selected = priorSelections.get(event.classIdentity)
      matchesPrior &&= Boolean(selected && event.sampleId === selected.sampleId && event.selectionScore === selected.weightedScore)
      if (event.status !== "completed" || !Number.isInteger(event.batch) || !Number.isFinite(event.selectionScore)) malformed += 1
    }
  }
  return { events, batchesComplete, passCorrect, rotationCorrect, matchesPrior, malformed }
}
const luminance = inspectStep("epoch_complete_per_class_selected_luminance_replay", 1, "trainEpochCompletePerClassWorstSampleFinalVisibleLuminanceSelections")
const reference = inspectStep("epoch_complete_per_class_selected_reference_feature_replay", 2, "trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections")
const telemetryInspection = { luminanceStepIdentity: "epoch_complete_per_class_selected_luminance_replay", referenceStepIdentity: "epoch_complete_per_class_selected_reference_feature_replay", luminanceEventCount: luminance.events.length, referenceEventCount: reference.events.length, epochsComplete: same([...new Set([...luminance.events, ...reference.events].map((event) => event.epoch))].sort((a, b) => a - b), expectedEpochs), batchCoverageComplete: luminance.batchesComplete && reference.batchesComplete, objectivePassIdentityCorrect: luminance.passCorrect && reference.passCorrect, classRotationCorrect: luminance.rotationCorrect && reference.rotationCorrect, matchesPriorEpochSelections: luminance.matchesPrior && reference.matchesPrior, unknownOrMalformedEvents: luminance.malformed + reference.malformed }

const contributions = sourceIndex.v7CapacityContributions
const splitIds = Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [split, new Set(contributions.filter((row) => row.split === split).map((row) => row.sampleId))]))
const trainSelections = manifest.metrics.flatMap((row) => row.trainEpochCompletePerClassWorstSampleReferenceFeatureStructureSelections ?? [])
const validationSelections = manifest.metrics.flatMap((row) => row.validationRolloutEpochCompletePerClassWorstSampleReferenceFeatureStructureCheckpointSelections ?? [])
const sourceIndexInspection = { trainCount: splitIds.train.size, validationCount: splitIds.validation.size, challengeCount: splitIds.challenge.size, regressionCount: splitIds.regression.size, rolloutSeedCount: 2, allTrainSelectionsBound: trainSelections.every((entry) => splitIds.train.has(entry.sampleId)), allValidationSelectionsBound: validationSelections.every((entry) => splitIds.validation.has(entry.sampleId)) }

const decision = adjudicateCurrentStage0Failure({
  terminal: readJson(projectFile(authorization.sourceEvidence.stage0Terminal.path)),
  manifest,
  review: readJson(projectFile(authorization.sourceEvidence.stage0MachineReview.path)),
  activeConfig: readJson(projectFile(authorization.sourceEvidence.activeConfig.path)),
  failedCheckpointIdentity: { path: authorization.sourceEvidence.failedCheckpointIdentityOnly.path, sha256: authorization.sourceEvidence.failedCheckpointIdentityOnly.sha256 },
  telemetryInspection,
  sourceIndexInspection,
  directWiringDefectEvidence: false,
  directFeatureRgbBoundaryDefectEvidence: false,
})
assert.equal(decision.selectedCause, "A")

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = { cpu: path.join(output, "cpu-report.json"), problem: path.join(output, "problem-report.json"), report: path.join(output, "causal-analysis-report.json"), decision: path.join(output, "adjudication.json"), exit: path.join(output, "route-exit-proposal.json"), owner: path.join(output, "owner-decision-request.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
const sourceEvidence = authorization.sourceEvidence
writeJsonAtomic(files.cpu, { ...cpuReport, sourceRunId: SOURCE_RUN_ID, sourceEvidence, telemetryInspection, sourceIndexInspection, authorization: bind(authorizationPath), consumption: bind(consumptionPath), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false })
writeJsonAtomic(files.problem, { schemaVersion: "stage4-current-stage0-four-object-problem-report-v1", status: "problem_confirmed", sourceRunId: SOURCE_RUN_ID, facts: { epochsCompleted: 40, optimizerSteps: 5760, roadPassedAtEpoch40: true, waterPassedAtEpoch40: true, localResponsePassedClasses: OBJECT_CLASSES, failedClasses: OBJECT_CLASSES, maskedLumaCorrelation: decision.evidence.terminalMaskedLumaCorrelation, frozenMinimumMaskedLumaCorrelation: 0.08, previewPassCount: 0, previewFailCount: 6 }, sourceEvidence, failedCheckpointWeightsRead: false })
writeJsonAtomic(files.report, { schemaVersion: "stage4-current-stage0-four-object-causal-analysis-report-v1", status: "causal_analysis_succeeded", sourceRunId: SOURCE_RUN_ID, selectedCause: decision.selectedCause, problem: decision.problem, evidence: decision.evidence, alternatives: decision.alternatives, metricTimeline: decision.metrics, reviewTimeline: decision.reviews, forbiddenTargetsUsed: false, failedCheckpointWeightsRead: false })
writeJsonAtomic(files.decision, decision)
writeJsonAtomic(files.exit, { schemaVersion: "stage4-current-stage0-candidate-route-exit-proposal-v1", status: "current_candidate_route_exit_proposed", candidate: "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1", reason: "All registered legal objectives and identities are active and improve, but the frozen Stage 0 visual qualification still fails for all four object classes. No unique wiring or feature-RGB boundary defect is proven.", forbiddenReuse: { stage0RunId: SOURCE_RUN_ID, checkpoint: sourceEvidence.failedCheckpointIdentityOnly, authorizationOrOutputReuseAllowed: false }, automaticRetryAllowed: false, newModelOrObjectiveAutoGenerationAllowed: false })
writeJsonAtomic(files.owner, { schemaVersion: "stage4-project-level-owner-decision-request-v1", status: "owner_project_level_decision_required", question: "Choose whether to pause the current Stage4 model route or authorize a separately scoped project-level data/supervision/resource redesign. The current candidate must not be rerun.", options: ["pause_current_stage4_model_route", "authorize_project_level_data_supervision_resource_redesign"], prohibitedShortcut: ["rerun_same_stage0", "reuse_failed_checkpoint", "lower_review_thresholds", "auto_generate_another_loss", "free_hyperparameter_search"] })
const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
const currentLinePrefix = "-> 当前完整Epoch逐类别参考特征选择与亮度共享回放候选已通过CPU、只读GPU、30 Epoch Smoke及独立后期稳定资格；随后全新Stage 0"
const replacement = "-> 当前完整Epoch逐类别参考特征选择与亮度共享回放候选的最新Stage 0已完成40 Epoch和5760次优化，工程证据完整但六张预览0/6通过；Epoch 40道路和水体通过，footprints、tree、rock、vegetation的maskedLumaCorrelation为0.0437/-0.0345/0.0360/0.0674，均低于0.08。独立CPU只读因果裁决已唯一选择A：完整Epoch选择、两目标共享回放、总Loss和validation身份均正确激活且指标改善，但仍不足以约束多样本最终可见语义。当前候选正式提出退出，不得重跑或复用失败Checkpoint；下一步需要Owner在暂停Stage4模型路线与另行授权项目级数据/监督/资源重设计之间作出选择。"
const lines = planText.split(/\r?\n/)
const index = lines.findIndex((line) => line.startsWith(currentLinePrefix))
assert.notEqual(index, -1, "unique_plan_current_candidate_line_missing")
lines[index] = replacement
writeTextAtomic(planPath, `${lines.join("\n")}\n`)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-current-stage0-four-object-plan-sync-v1", status: "unique_plan_synchronized", planPath: relative(planPath), beforeSha256: planBefore, afterSha256: shaFile(planPath), selectedCause: "A", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-current-stage0-four-object-causal-terminal-v1", status: "stage4_current_stage0_four_object_causal_adjudication_succeeded_closed", sourceRunId: SOURCE_RUN_ID, selectedCause: "A", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, problemReport: bind(files.problem), causalAnalysisReport: bind(files.report), adjudication: bind(files.decision), routeExitProposal: bind(files.exit), ownerDecisionRequest: bind(files.owner), cpuReport: bind(files.cpu), planSync: bind(files.planSync), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, nextLegalAction: "owner_project_level_decision", recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 current Stage 0 four-object causal adjudication", terminal: bind(files.terminal), latestDecision: "A_active_legal_objectives_insufficient_for_multisample_final_visible_reference_semantics", nextLegalAction: "owner_project_level_decision", forbiddenActions: DENIALS, recordedAtUtc: now })
for (const target of Object.values(files)) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_current_stage0_four_object_causal_adjudication", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) }) }
appendAiPainterProgramEvent({ id: `stage4-current-stage0-four-object-adjudication-${authorization.runId}`, timestamp: now, action: "stage4_current_stage0_four_object_reference_semantic_causal_adjudication", runId: authorization.runId, kind: "cpu_readonly_adjudication", status: "success", title: "Stage4 current Stage 0 candidate adjudicated insufficient", titleZh: "Stage4当前Stage 0候选已裁决为合法目标完整但仍不足", detailZh: "40 Epoch与5760次优化完整；完整Epoch选择、两目标共享回放及validation身份均正确，四类对象终态参考语义仍失败，唯一裁决A并提出退出当前候选。", evidencePath: relative(files.terminal), evidenceSha256: shaFile(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: readJson(files.terminal).status, selectedCause: "A", terminal: bind(files.terminal), problemReport: bind(files.problem), causalAnalysisReport: bind(files.report), adjudication: bind(files.decision), routeExitProposal: bind(files.exit), ownerDecisionRequest: bind(files.owner), cpuReport: bind(files.cpu), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
