import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateStage0GeneralizationFailure } from "./lib/ai-painter-stage4-stage0-generalization-causal-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUIRED_ACTIONS = Object.freeze([
  "execute_cpu_positive_negative_contract_regression",
  "execute_one_cpu_readonly_stage0_generalization_causal_adjudication",
  "write_cpu_report_analysis_decision_inactive_contract_and_terminal",
  "synchronize_plan_capsule_event_ledger_and_sqlite",
])
const FORBIDDEN_ACTIONS = Object.freeze([
  "read_or_load_checkpoint_weights", "modify_code", "modify_training_config", "modify_data",
  "modify_model_weights", "modify_review_thresholds", "create_optimizer", "execute_backward",
  "start_gpu", "start_training", "rerun_same_stage0", "start_stage1", "start_stage2",
  "start_stage5", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry",
])
const SOURCES = Object.freeze({
  smokeQualification: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260813-042808433/phase-terminal.json", "f6ad38f57d37df559bbe23ea8900f8398ab596b5f4b33070f8e13047cbec4c5f"],
  smokeQualificationReport: [".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260813-042808433/timeline-qualification-report.json", "70e795b754e65cf4c543d4bdc84a6be51c6a8c76b242f9f77126ab415d4ac64b"],
  smokeManifest: [".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260813-041600000/training-output/manifest.json", "9a45c565fa07d5aa30be1280ca6ea1815d1fc9d18b247145bd192f6b6fdbcb0d"],
  smokeReview: [".runtime/ai-painter/stage4-fact-conditioned-semantic-mixture-smoke-executions/20260813-041600000/training-output/fixed-preview-reviews.json", "f6b26aeff01e7336ccfd6093af994c5e61a6a709e41365dd6735a73c581427db"],
  stage0Terminal: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-050000000-stage0/finalization/phase-terminal.json", "ff2e8913482afb5df172554474407911d9e0362e8da4a542665e02b73d05736a"],
  stage0Manifest: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-050000000-stage0/training-output/manifest.json", "7f920fe1b0df83592816523c0744d181f95d5930a1d43dd908dab39802fb0ec9"],
  stage0Review: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-050000000-stage0/training-output/fixed-preview-reviews.json", "03ade5f612d49faaac158f660972d58c6bda66b71378281ed2b906a89779c6ea"],
  stage0Telemetry: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-050000000-stage0/training-output/stage4-step-telemetry.json", "d9ece1774f18d3d779c0e40e3dbc73de9a0f36ba9f47427918b41daa667debc9"],
  failedCheckpointIdentityOnly: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260813-050000000-stage0/training-output/complete-world-ai-assisted-conditional-denoiser.pt", "d20dcd5a9de1b289ca2e10ffd82670cbcb359cefb31bbf4fb260ff5c098b4fd5"],
})

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
const projectFile = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const out = path.resolve(ROOT, value); assert.ok(out.startsWith(`${ROOT}${path.sep}`)); return out }
const shaFile = (value) => { const hash = crypto.createHash("sha256"); const fd = fs.openSync(value, "r"); const buffer = Buffer.allocUnsafe(1024 * 1024); try { let count; while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count)) } finally { fs.closeSync(fd) } return hash.digest("hex") }
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-stage0-generalization-causal-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_stage0_generalization_failure_causal_adjudication")
assert.equal(same(authorization.allowedActions, REQUIRED_ACTIONS), true, "allowed_actions_not_exact")
assert.equal(FORBIDDEN_ACTIONS.every((item) => authorization.deniedActions.includes(item)), true, "denied_actions_incomplete")
assert.equal(authorization.automaticRetryAuthorized, false)

for (const [name, [logicalPath, expectedSha]] of Object.entries(SOURCES)) {
  const file = projectFile(logicalPath)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(shaFile(file), expectedSha, `${name}_sha256_mismatch`)
  assert.deepEqual(authorization.sourceEvidence[name], { path: logicalPath, sha256: expectedSha })
}
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "formal_output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = {
  schemaVersion: "stage4-stage0-generalization-causal-analysis-consumption-v1",
  status: "cpu_readonly_analysis_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  authorizationPath: authorizationArg,
  authorizationSha256: authorizationSha,
  oneTimeConsumption: true,
  consumedAtUtc,
  consumedAtAsiaShanghai: formatShanghai(consumedAtUtc),
}
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }

const cpu = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-stage4-stage0-generalization-causal-adjudication.mjs")], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.positivePassed, cpuReport.positiveTotal)
assert.equal(cpuReport.negativePassed, cpuReport.negativeTotal)
const input = {
  smokeQualification: readJson(projectFile(SOURCES.smokeQualification[0])),
  smokeManifest: readJson(projectFile(SOURCES.smokeManifest[0])),
  smokeReview: readJson(projectFile(SOURCES.smokeReview[0])),
  stage0Terminal: readJson(projectFile(SOURCES.stage0Terminal[0])),
  stage0Manifest: readJson(projectFile(SOURCES.stage0Manifest[0])),
  stage0Review: readJson(projectFile(SOURCES.stage0Review[0])),
  directGradientConflictEvidence: false,
  perSampleGradientEvidence: false,
}
const decision = adjudicateStage0GeneralizationFailure(input)
assert.equal(decision.selectedCause, "C")
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  report: path.join(output, "generalization-causal-report.json"),
  decision: path.join(output, "adjudication.json"),
  contract: path.join(output, "inactive-repair-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const sources = Object.fromEntries(Object.entries(SOURCES).map(([name, [p, s]]) => [name, { path: p, sha256: s, checkpointWeightsRead: name === "failedCheckpointIdentityOnly" ? false : undefined }]))
writeJsonAtomic(files.cpu, { ...cpuReport, sourceEvidence: sources, authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.report, { schemaVersion: "ai-painter-stage4-stage0-generalization-causal-report-v1", status: "training_objective_gap_confirmed", businessFinding: "The fixed single-sample candidate learned and passed, while the 48-record Stage 0 trajectory reduced every registered final-visible class loss but all six fixed previews failed. Aggregate improvement therefore did not become stable visible spatial-semantic correctness across the full data distribution.", decision, sourceEvidence: sources, cpuReport: bind(files.cpu), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.decision, { schemaVersion: "ai-painter-stage4-stage0-generalization-causal-decision-v1", status: decision.status, selectedCause: "C", rejectedCauses: { A: decision.alternatives.A, B: decision.alternatives.B, D: decision.alternatives.D }, nextContractId: decision.nextContractId, automaticRetryAllowed: false, stage1EntryPermitted: false, stage2EntryPermitted: false, report: bind(files.report), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-distribution-aware-visible-spatial-semantic-obligation-contract-v1",
  status: "bounded_inactive_not_authorized_for_execution",
  contractId: decision.nextContractId,
  purpose: "Make final decoded RGB obligations observable per sample and per class over the complete training distribution instead of accepting aggregate loss improvement as sufficient.",
  scope: {
    architectureChanged: false,
    legalSupervision: ["owner_approved_reference_rgb", "original_23_channel_condition_pack", "approved_world_facts", "visual_fact_manifest", "road_geometry", "object_semantic_masks", "frozen_autoencoder_decode"],
    prohibitedTargets: ["failed_preview_pixels", "machine_review_thresholds", "machine_review_pass_fail_labels"],
    requiredClasses: ["route", "footprints", "tree", "rock", "vegetation"],
    requirements: [
      "export_per_sample_per_class_final_decoded_rgb_obligations_before_aggregation",
      "normalize_each_obligation_only_by_its_bound_mask_support_and_existing_derived_class_weight",
      "make_worst_observed_sample_class_obligation_visible_to_checkpoint_qualification_without_new_free_numeric_weight",
      "preserve_exact_23_channel_order_dataset_split_checkpoint_format_and_review_thresholds",
      "fail_closed_when_existing_formal_weights_do_not_uniquely_determine_the_objective",
    ],
  },
  acceptanceRoute: {
    cpu: ["two_sample_counterexample_where_aggregate_mean_improves_but_one_bound_class_regresses_is_rejected", "per_sample_per_class_source_and_mask_identity", "finite_nonzero_final_rgb_gradient_inside_bound_mask", "zero_gradient_outside_bound_mask", "legacy_mode_compatibility"],
    readonlyGpu: ["real_cuda_per_sample_per_class_final_rgb_gradient_and_decode_response"],
    subsequentExecutionRequiresNewOwnerAuthorization: true,
  },
  freeHyperparametersSelected: false,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_authorized_not_consumed", requestedAction: `implement_cpu_inactive_support_for_${decision.nextContractId}`, boundDecision: bind(files.decision), boundContract: bind(files.contract), automaticApproval: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.terminal, { schemaVersion: "ai-painter-stage4-stage0-generalization-causal-terminal-v1", status: "stage0_generalization_failure_cause_C_confirmed_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, stage0FailedClosed: true, stage1Started: false, stage2Started: false, selectedCause: "C", nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.nextContractId}`, report: bind(files.report), decision: bind(files.decision), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner), automaticRetryStarted: false, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 Stage 0 generalization failure closed with cause C", candidateTerminal: bind(files.terminal), latestBlocker: "full_distribution_final_visible_spatial_semantic_objective_insufficient", nextLegalAction: `owner_authorize_cpu_inactive_support_for_${decision.nextContractId}`, forbiddenActions: FORBIDDEN_ACTIONS, evidence: { ...sources, cpuReport: bind(files.cpu), report: bind(files.report), decision: bind(files.decision), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner) }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const file of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: authorization.runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(file) })
}
appendAiPainterProgramEvent({ id: `stage4-stage0-generalization-causal-${authorization.runId}`, timestamp: now, action: "stage4_stage0_generalization_causal_adjudication", runId: authorization.runId, kind: "cpu_readonly_adjudication", status: "success", title: "Stage4 Stage 0 generalization cause C confirmed", titleZh: "Stage4 Stage 0 泛化失败已裁决为训练目标约束不足", detailZh: "单样本Smoke通过，但48条训练样本下五类Loss下降仍未转化为六张预览中的任何一次视觉通过；A无直接梯度冲突证据，B不能解释六个Checkpoint全部失败，因此唯一裁决为C。", evidencePath: relative(files.terminal), evidenceSha256: shaFile(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: readJson(files.terminal).status, terminal: bind(files.terminal), report: bind(files.report), decision: bind(files.decision), inactiveContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule) }, null, 2))
