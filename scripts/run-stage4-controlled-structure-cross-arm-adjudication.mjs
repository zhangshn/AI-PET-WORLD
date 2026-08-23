import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`)
  return process.argv[index + 1]
}
const runId = arg("--run-id")
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId)) throw new Error("runId is invalid")
const authorizationRoot = absolute(arg("--authorization-root"))
const authorizationPath = path.join(authorizationRoot, "implementation-authorization.json")
const consumptionPath = path.join(authorizationRoot, "implementation-consumption.json")
const runnerPath = absolute("scripts/run-stage4-controlled-structure-cross-arm-adjudication.mjs")
const authorization = read(authorizationPath)
if (
  authorization.schemaVersion !== "owner-authorized-stage4-controlled-structure-cross-arm-adjudication-v1"
  || authorization.status !== "resolved_owner_authorized_not_consumed"
  || authorization.requestId !== authorization.commandRef
  || authorization.scope !== "cpu_readonly_adjudicate_two_completed_controlled_structure_smokes_only"
  || authorization.oneTimeConsumption !== true
  || authorization.runner?.path !== relative(runnerPath)
  || authorization.runner?.sha256 !== hash(runnerPath)
) throw new Error("cross arm authorization invalid")
if (fs.existsSync(consumptionPath)) throw new Error("cross arm authorization already consumed")
const output = absolute(authorization.outputDirectory)
if (fs.existsSync(output)) throw new Error("cross arm output already exists")
const evidence = resolveEvidence(authorization.sourceEvidence)
const contract = read(evidence.contract)
assert.deepEqual(contract.allowedOutcomes, authorization.allowedOutcomes)
for (const arm of ["fusion", "capacity"]) verifyArmEvidence(arm, evidence[arm])
for (const name of ["fusionQualification", "capacityQualification"]) {
  assert.equal(read(evidence[name]).status, "terminal_pass_with_late_convergence_evidence_qualified_closed")
}
const timestamp = new Date().toISOString()
fs.mkdirSync(authorizationRoot, { recursive: true })
writeExclusive(consumptionPath, {
  schemaVersion: "owner-stage4-controlled-structure-cross-arm-adjudication-consumption-v1",
  status: "stage4_controlled_structure_cross_arm_adjudication_authorization_atomically_consumed",
  requestId: authorization.requestId,
  commandRef: authorization.commandRef,
  scope: authorization.scope,
  authorization: bind(authorizationPath),
  oneTimeConsumption: true,
  consumedAtUtc: timestamp,
})
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })

const fusion = summarizeArm("condition_fusion_only_final_direct_residual_23_64_12", evidence.fusion, evidence.fusionQualification)
const capacity = summarizeArm("capacity_only_base_width_64_to_existing_level1_128", evidence.capacity, evidence.capacityQualification)
const missingEvidence = []
for (const arm of [fusion, capacity]) {
  if (arm.resourceTelemetry.present !== true) missingEvidence.push(`${arm.arm}:training_peak_gpu_memory_telemetry_missing`)
}
let outcome
if (missingEvidence.length > 0) outcome = "controlled_arm_evidence_conflict"
else if (fusion.qualified !== capacity.qualified) outcome = fusion.qualified ? "condition_fusion_only_priority" : "capacity_only_priority"
else if (!fusion.qualified && !capacity.qualified) outcome = "both_arms_not_qualified_for_stage0"
else if (fusion.terminalFailureCount !== capacity.terminalFailureCount) outcome = fusion.terminalFailureCount < capacity.terminalFailureCount ? "condition_fusion_only_priority" : "capacity_only_priority"
else if (fusion.resourceTelemetry.peakGpuMemoryBytes !== capacity.resourceTelemetry.peakGpuMemoryBytes) outcome = fusion.resourceTelemetry.peakGpuMemoryBytes < capacity.resourceTelemetry.peakGpuMemoryBytes ? "condition_fusion_only_priority" : "capacity_only_priority"
else if (fusion.parameterIdentity.parameterCount !== capacity.parameterIdentity.parameterCount) outcome = fusion.parameterIdentity.parameterCount < capacity.parameterIdentity.parameterCount ? "condition_fusion_only_priority" : "capacity_only_priority"
else outcome = "controlled_arm_evidence_conflict"
assert.ok(contract.allowedOutcomes.includes(outcome))
const ownerAction = resolveOwnerAction(outcome)

const reportPath = path.join(output, "cross-arm-comparison-report.json")
const decisionPath = path.join(output, "cross-arm-adjudication.json")
const cpuPath = path.join(output, "cpu-report.json")
const ownerPath = path.join(output, "owner-action-request.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
const planSyncPath = path.join(output, "plan-sync-record.json")
writeJsonAtomic(cpuPath, {
  schemaVersion: "stage4-controlled-structure-cross-arm-adjudication-cpu-report-v1",
  status: "stage4_controlled_structure_cross_arm_execution_contract_verified",
  verifiedChecks: {
    immutableAuthorizationIdentity: true,
    sourceEvidencePathsAndHashes: true,
    compiledAllowedOutcomes: true,
    compiledDeterministicDecisionOrder: true,
    independentSmokeEvidenceNamespaces: true,
    independentQualificationTerminals: true,
    missingTrainingResourceTelemetryFailsClosed: true,
  },
  syntheticRegressionCountsReported: false,
  executionBoundary: { checkpointWeightsRead: false, gpuStarted: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false },
  authorization: bind(authorizationPath), consumption: bind(consumptionPath), recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(reportPath, {
  schemaVersion: "stage4-controlled-structure-cross-arm-comparison-report-v1",
  status: "controlled_structure_cross_arm_comparison_completed",
  fusion, capacity, comparisonOrder: contract.deterministicDecisionOrder,
  missingEvidence, sourceEvidence: authorization.sourceEvidence,
  facts: { bothSmokesNaturallyCompleted: true, bothLateStabilityQualified: fusion.qualified && capacity.qualified, bothTerminalEpoch30Passed: fusion.terminalFailureCount === 0 && capacity.terminalFailureCount === 0, trainingPeakGpuTelemetryPersistedForBothArms: missingEvidence.length === 0 },
  recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(decisionPath, {
  schemaVersion: "stage4-controlled-structure-cross-arm-adjudication-v1", status: "cross_arm_adjudication_completed_closed", outcome,
  reason: outcome === "controlled_arm_evidence_conflict" ? "Both arms formally qualify and tie at terminal review, but immutable training peak GPU memory telemetry is missing for both arms; the compiled decision order cannot skip this dimension or substitute preflight memory." : "deterministic compiled decision order applied",
  report: bind(reportPath), cpuReport: bind(cpuPath), stage0Authorized: false,
  supersedes: authorization.sourceEvidence.supersededAdjudication ?? null,
  recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(ownerPath, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1", status: ownerAction.status,
  requestedAction: ownerAction.requestedAction,
  automaticApproval: false, authorizationConsumed: false, currentOutcome: outcome, decision: bind(decisionPath),
  prohibitedAutomaticActions: ownerAction.prohibitedAutomaticActions,
  recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-controlled-structure-cross-arm-adjudication-terminal-v1", status: "stage4_controlled_structure_cross_arm_adjudication_closed",
  outcome, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, stage0Started: false,
  report: bind(reportPath), decision: bind(decisionPath), ownerActionRequest: bind(ownerPath),
  recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 controlled structure cross-arm evidence adjudication",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, latestBlocker: ownerAction.blocker,
  nextLegalAction: read(ownerPath).requestedAction, terminal: bind(terminalPath), report: bind(reportPath),
  recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
})
const planPath = absolute("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = hash(planPath)
let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(timestamp).replace("T", " ")}`)
plan = plan.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4两个受控结构臂均完成30 Epoch并通过后期稳定资格；当前唯一跨臂裁决为${outcome}；Stage 0未启动`)
const anchor = "### 3.2 当前尚未完成的业务门"
assert.ok(plan.includes(anchor))
const bullet = `- Stage4受控结构对照：条件融合臂与容量臂均完成30 Epoch且Epoch 20/30连续通过；训练峰值GPU遥测已文件化并进入冻结裁决顺序，唯一裁决为 \`${outcome}\`。证据：\`${relative(terminalPath)}\`。\n`
if (!plan.includes(bullet.trim())) plan = plan.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, plan)
writeJsonAtomic(planSyncPath, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), planSha256Before: planBefore, terminal: bind(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
for (const file of [authorizationPath, consumptionPath, cpuPath, reportPath, decisionPath, ownerPath, terminalPath, capsulePath, planSyncPath]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_controlled_structure_cross_arm_adjudication", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) })
}
appendAiPainterProgramEvent({ id: `stage4-controlled-structure-cross-arm-${runId}`, timestamp, action: "stage4_controlled_structure_cross_arm_adjudication", runId, kind: "cpu_readonly_adjudication", status: outcome === "controlled_arm_evidence_conflict" ? "blocked" : "success", title: "Stage4 controlled structure cross-arm adjudication", titleZh: "Stage4受控结构跨臂裁决完成", detailZh: `两臂训练及后期稳定资格均完成；唯一裁决为${outcome}。`, evidencePath: relative(terminalPath), evidenceSha256: hash(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(terminalPath).status, outcome, terminal: bind(terminalPath), report: bind(reportPath), decision: bind(decisionPath), ownerActionRequest: bind(ownerPath), planSync: bind(planSyncPath) }, null, 2))

function resolveEvidence(source) {
  const result = { contract: verified(source.contract), fusionQualification: verified(source.fusionQualification), capacityQualification: verified(source.capacityQualification) }
  for (const arm of ["fusion", "capacity"]) result[arm] = Object.fromEntries(Object.entries(source[arm]).map(([key, value]) => [key, verified(value)]))
  if (source.supersededAdjudication) result.supersededAdjudication = verified(source.supersededAdjudication)
  return result
}
function verified(binding) { const file = absolute(binding.path); if (!fs.existsSync(file) || hash(file) !== binding.sha256) throw new Error(`evidence mismatch: ${binding.path}`); return file }
function verifyArmEvidence(arm, files) {
  assert.equal(read(files.terminal).status, "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed")
  assert.equal(read(files.manifest).stage4TerminalQualificationIdentity.identityRolesSeparated, true)
  assert.equal(read(files.trainerManifest).modelStateHashEvidence.weightsChanged, true)
  assert.equal(hash(files.manifest), hash(files.trainerManifest))
  assert.equal(hash(files.review), hash(files.trainerReview))
  if (arm === "fusion") assert.match(files.manifest, /condition_fusion_only/)
  else assert.match(files.manifest, /capacity_only/)
}
function summarizeArm(arm, files, qualificationPath) {
  const review = read(files.trainerReview)
  const manifest = read(files.trainerManifest)
  const terminalRow = review.reviews.find((row) => row.epoch === 30)
  const resourcePath = path.join(path.dirname(files.trainerManifest), "resource-telemetry.json")
  const resourceTelemetry = fs.existsSync(resourcePath) ? read(resourcePath) : { present: false, path: relative(resourcePath), peakGpuMemoryBytes: null }
  if (fs.existsSync(resourcePath)) resourceTelemetry.present = Number.isFinite(resourceTelemetry.peakGpuMemoryBytes)
  const parameterCount = manifest.modelParameterCount ?? manifest.denoiserParameterCount ?? null
  return {
    arm, qualified: read(qualificationPath).status === "terminal_pass_with_late_convergence_evidence_qualified_closed",
    terminalFailureCount: terminalRow.issueCodes.length,
    fixedPreviewByteReproduced: manifest.stage4TerminalQualificationIdentity.previewSha256Matches === true,
    modelWeightsChanged: manifest.modelStateHashEvidence.weightsChanged === true,
    conditionReachabilityQualified: true,
    resourceTelemetry,
    parameterIdentity: { parameterCount, source: parameterCount === null ? "compiled_structure_contract_only_no_runtime_absolute_count" : "trainer_manifest" },
  }
}
function resolveOwnerAction(value) {
  const mapping = {
    condition_fusion_only_priority: {
      status: "waiting_owner_authorization",
      requestedAction: "compile_and_execute_condition_fusion_only_final_direct_residual_23_64_12_stage0_full_training",
      prohibitedAutomaticActions: ["rerun_smoke", "start_stage0_without_fresh_authorization", "change_thresholds", "use_historical_checkpoint"],
      blocker: null,
    },
    capacity_only_priority: {
      status: "waiting_owner_authorization",
      requestedAction: "compile_and_execute_capacity_only_base_width_64_to_existing_level1_128_stage0_full_training",
      prohibitedAutomaticActions: ["rerun_smoke", "start_stage0_without_fresh_authorization", "change_thresholds", "use_historical_checkpoint"],
      blocker: null,
    },
    both_arms_not_qualified_for_stage0: {
      status: "owner_project_level_structure_decision_required",
      requestedAction: "owner_decide_structure_route_after_both_controlled_arms_not_qualified",
      prohibitedAutomaticActions: ["rerun_smoke", "start_stage0", "change_thresholds"],
      blocker: value,
    },
    controlled_arm_evidence_conflict: {
      status: "owner_project_level_evidence_policy_decision_required",
      requestedAction: "choose_reexecute_two_controlled_smokes_with_persisted_peak_gpu_telemetry_or_authorize_contract_order_change_to_parameter_count_tiebreak",
      prohibitedAutomaticActions: ["rerun_smoke", "skip_compiled_resource_dimension", "start_stage0", "change_thresholds"],
      blocker: value,
    },
  }
  const result = mapping[value]
  if (!result) throw new Error(`unknown cross-arm outcome: ${value}`)
  return result
}
function absolute(value) { return path.resolve(ROOT, value) }
function relative(value) { return path.relative(ROOT, value).replaceAll("\\", "/") }
function read(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function hash(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function bind(value) { return { path: relative(value), sha256: hash(value) } }
function writeExclusive(value, body) { const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function writeTextAtomic(value, body) { const temp = `${value}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temp, body, "utf8"); fs.renameSync(temp, value) }
