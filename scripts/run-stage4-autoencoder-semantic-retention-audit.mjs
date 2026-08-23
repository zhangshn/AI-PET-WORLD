import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateAutoencoderSemanticRetention, DECISION_A, DECISION_B, DECISION_C } from "./lib/ai-painter-stage4-autoencoder-semantic-retention-audit.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const result = path.resolve(ROOT, value)
  assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return result
}
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (value, text) => { const temp = `${value}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temp, text, "utf8"); fs.renameSync(temp, value) }

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
assert.ok(authorizationArg && authorizationSha, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-frozen-autoencoder-semantic-retention-audit-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_readonly_gpu_frozen_autoencoder_semantic_retention_audit_across_64")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.gpuAuthorized, true)
assert.equal(authorization.checkpointWeightsReadAuthorized, true)
assert.equal(authorization.optimizerAuthorized, false)
assert.equal(authorization.backwardAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
assert.equal(same(authorization.taskIdentity.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 }), true)
assert.deepEqual(authorization.taskIdentity.objectClasses, ["footprints", "tree", "rock", "vegetation"])

for (const [name, evidence] of Object.entries(authorization.bindings)) {
  if (name === "projectAutoencoderCheckpoint") continue
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-autoencoder-semantic-retention-audit.mjs"),
  checker: projectFile("scripts/check-stage4-autoencoder-semantic-retention-audit.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-autoencoder-semantic-retention-audit.mjs"),
  gpuRunner: projectFile("ml/ai-painter/scripts/run_stage4_frozen_autoencoder_semantic_retention_audit.py"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])), "program_lineage_mismatch")
const output = projectFile(authorization.execution.outputDirectory)
const consumptionPath = projectFile(authorization.execution.consumptionPath)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")

const python = projectFile("ml/ai-painter/.venv/Scripts/python.exe")
const pythonArgs = [programs.gpuRunner, "--authorization", relative(authorizationPath), "--authorization-sha256", authorizationSha, "--consumption", relative(consumptionPath), "--output-dir", authorization.execution.outputDirectory]
const pythonEnv = { ...process.env, PYTHONPATH: projectFile("ml/ai-painter/src") }
const preflight = spawnSync(python, [...pythonArgs, "--preflight-only"], { cwd: ROOT, env: pythonEnv, encoding: "utf8" })
assert.equal(preflight.status, 0, `python_cuda_disk_preflight_failed:${preflight.stderr}`)
const preflightReport = JSON.parse(preflight.stdout)
assert.equal(preflightReport.status, "passed_gpu_not_started_not_consumed")
assert.equal(fs.existsSync(consumptionPath), false, "preflight_consumed_gpu_authorization")
assert.equal(fs.existsSync(output), false, "preflight_created_formal_output")

const temporaryEvidenceRoot = path.dirname(authorizationPath)
const preflightPath = path.join(temporaryEvidenceRoot, "preflight-report.json")
const cpuTemporaryPath = path.join(temporaryEvidenceRoot, "cpu-report.json")
writeJsonAtomic(preflightPath, { ...preflightReport, authorization: bind(authorizationPath) })
writeJsonAtomic(cpuTemporaryPath, { ...cpuReport, authorization: bind(authorizationPath) })

console.log(JSON.stringify({ status: "cpu_and_resource_preflight_passed", runId: authorization.runId, next: "atomically_consume_and_run_readonly_gpu_audit", approvedRecords: 64 }))
const gpu = spawnSync(python, pythonArgs, { cwd: ROOT, env: pythonEnv, stdio: "inherit" })
assert.equal(gpu.status, 0, `readonly_gpu_audit_failed:${gpu.status}`)
assert.equal(fs.existsSync(consumptionPath), true, "gpu_authorization_not_consumed")
assert.equal(fs.existsSync(output), true, "gpu_output_missing")

const files = {
  gpu: path.join(output, "gpu-report.json"),
  telemetry: path.join(output, "cuda-telemetry.json"),
  states: path.join(output, "model-state-hashes.json"),
  cpu: path.join(output, "cpu-report.json"),
  preflight: path.join(output, "preflight-report.json"),
  analysis: path.join(output, "autoencoder-semantic-retention-analysis.json"),
  decision: path.join(output, "adjudication.json"),
  action: path.join(output, "owner-action-request-or-boundary-contract.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath) })
writeJsonAtomic(files.preflight, { ...preflightReport, authorization: bind(authorizationPath), consumptionStillAbsentAtPreflight: true })
const gpuReport = readJson(files.gpu)
const decision = adjudicateAutoencoderSemanticRetention(gpuReport)
const now = new Date().toISOString()
const classSummary = Object.fromEntries(authorization.taskIdentity.objectClasses.map((classIdentity) => {
  const values = gpuReport.rows.flatMap((row) => row.classMetrics.filter((item) => item.classIdentity === classIdentity))
  return [classIdentity, { audited: values.length, passed: values.filter((item) => item.referenceResponsePassed).length, failed: values.filter((item) => !item.referenceResponsePassed).length, latentContrastFiniteNonZero: values.filter((item) => item.latentMaskContrastFiniteNonZero).length }]
}))
writeJsonAtomic(files.analysis, {
  schemaVersion: "stage4-frozen-autoencoder-semantic-retention-analysis-v1",
  status: "cpu_gpu_readonly_autoencoder_boundary_analysis_completed",
  businessQuestion: "Does the frozen project Autoencoder preserve the approved object semantics required by the final auditable map output across all 64 records?",
  auditedRecords: 64,
  auditedClassPairs: 256,
  classSummary,
  uniqueLatentHashCount: gpuReport.uniqueLatentHashCount,
  autoencoderStateUnchanged: gpuReport.autoencoderStateUnchanged,
  selectedDecision: decision.selectedDecision,
  sourceEvidence: authorization.bindings,
  prohibitedActionsObserved: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, { ...decision, analysis: bind(files.analysis), gpuReport: bind(files.gpu), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

let action
if (decision.selectedDecision === DECISION_A) {
  action = {
    schemaVersion: "stage4-frozen-autoencoder-boundary-redesign-contract-v1",
    status: "bounded_inactive_autoencoder_boundary_redesign_contract_generated",
    activationStatus: "not_authorized_cpu_design_only",
    problem: "The frozen Autoencoder roundtrip does not retain the unchanged approved object-semantic qualification across all 64 records.",
    permittedNextScope: ["design_autoencoder_boundary_with_explicit_semantic_retention", "derive_supervision_only_from_original_reference_rgb_masks_conditions_and_existing_features", "cpu_only_contract_and_regression"],
    prohibited: ["choose_free_hyperparameters", "modify_original_64", "read_failed_checkpoint", "start_gpu", "start_training", "lower_review_thresholds"],
  }
} else if (decision.selectedDecision === DECISION_B) {
  action = {
    schemaVersion: "stage4-current-model-multisample-capacity-gradient-interference-owner-action-request-v1",
    status: "owner_action_requested",
    requestedAction: "current_model_multisample_capacity_and_gradient_interference_readonly_diagnostic",
    reason: "The frozen Autoencoder preserves the required semantics, so the next causal boundary is the current Denoiser's multi-sample capacity and gradient interference.",
    gpuTrainingAuthorized: false,
  }
} else {
  assert.equal(decision.selectedDecision, DECISION_C)
  action = {
    schemaVersion: "stage4-autoencoder-boundary-evidence-owner-request-v1",
    status: "owner_evidence_requested",
    requestedEvidence: "bounded_additional_autoencoder_latent_semantic_distinctiveness_evidence",
    gpuTrainingAuthorized: false,
  }
}
writeJsonAtomic(files.action, { ...action, adjudication: bind(files.decision), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

const terminalStatus = decision.selectedDecision === DECISION_A ? "stage4_frozen_autoencoder_semantic_retention_gap_confirmed_closed" : decision.selectedDecision === DECISION_B ? "stage4_frozen_autoencoder_semantic_retention_sufficient_closed" : "stage4_autoencoder_boundary_evidence_insufficient_closed"
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-frozen-autoencoder-semantic-retention-terminal-v1",
  status: terminalStatus,
  selectedDecision: decision.selectedDecision,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  gpuReport: bind(files.gpu),
  cudaTelemetry: bind(files.telemetry),
  stateHashes: bind(files.states),
  cpuReport: bind(files.cpu),
  preflightReport: bind(files.preflight),
  analysis: bind(files.analysis),
  adjudication: bind(files.decision),
  actionOrContract: bind(files.action),
  autoencoderStateUnchanged: gpuReport.autoencoderStateUnchanged,
  denoiserCheckpointRead: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 frozen Autoencoder semantic-retention boundary audited across all 64 approved records",
  latestTerminal: bind(files.terminal),
  latestFinding: decision.selectedDecision,
  nextLegalAction: action.requestedAction ?? action.status,
  evidence: { gpuReport: bind(files.gpu), analysis: bind(files.analysis), adjudication: bind(files.decision), actionOrContract: bind(files.action) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4已完成冻结Autoencoder跨64份语义保留边界审计，唯一裁决为${decision.selectedDecision}；后续仅按该边界结果推进，不再继续无判别力地叠加同类Loss`)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = `- Stage4冻结Autoencoder语义保留审计已覆盖64份批准参考和footprints/tree/rock/vegetation共256个样本—类别对；Autoencoder权重保持不变。唯一裁决：\`${decision.selectedDecision}\`。证据：\`${relative(files.terminal)}\`。\n`
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), planSha256Before: planBefore, terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_frozen_autoencoder_semantic_retention_audit", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-frozen-autoencoder-semantic-retention-audit-${authorization.runId}`,
  timestamp: now,
  action: "stage4_frozen_autoencoder_semantic_retention_audit_across_64",
  runId: authorization.runId,
  kind: "readonly_gpu_boundary_diagnostic",
  status: "success",
  title: "Frozen Autoencoder semantic-retention boundary audited across all approved records",
  titleZh: "冻结Autoencoder跨64份批准数据的语义保留边界审计完成",
  detailZh: `覆盖64份参考与256个样本—类别对，唯一裁决为${decision.selectedDecision}，未读取Denoiser、未训练、未修改权重。`,
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({ status: terminalStatus, selectedDecision: decision.selectedDecision, terminal: bind(files.terminal), analysis: bind(files.analysis), adjudication: bind(files.decision), actionOrContract: bind(files.action), gpuReport: bind(files.gpu), cpuReport: bind(files.cpu), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
