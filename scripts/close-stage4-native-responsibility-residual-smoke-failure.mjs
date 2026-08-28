import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { advanceCapabilityLifecycle } from "./lib/ai-painter-capability-lifecycle-v1.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const CAPABILITY = "stage4-native-condition-encoder-responsibility-residual-final-candidate-v1"
const SOURCE_RUN_ID = "stage4-native-responsibility-residual-smoke-20260827234043-01"
const SOURCE_ROOT = inside(`.runtime/ai-painter/stage4-native-responsibility-residual-controlled-smokes/${SOURCE_RUN_ID}`)
const SOURCE_TERMINAL = path.join(SOURCE_ROOT, "phase-terminal.json")
const SOURCE_REVIEW = path.join(SOURCE_ROOT, "machine-review.json")
const SOURCE_QUALIFICATION = path.join(SOURCE_ROOT, "late-stability-qualification.json")
const SOURCE_MANIFEST = path.join(SOURCE_ROOT, "manifest.json")
const STRUCTURE_CONTRACT = inside("ml/ai-painter/scripts/ai_painter_native_responsibility_residual_contract.py")
const RUN_ID = `stage4-native-responsibility-residual-retirement-${compactUtc()}-01`
const OUTPUT_ROOT = inside(`.runtime/ai-painter/stage4-native-responsibility-residual-route-retirements/${RUN_ID}`)

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode)
assert.equal(current.registry.registryRevision, 31)
assert.equal(current.registry.capabilityVersion, CAPABILITY)
assert.equal(current.registry.taskId, "retire_native_responsibility_residual_final_candidate_after_smoke_failure")
assert.equal(current.registry.runId, SOURCE_RUN_ID)
assert.equal(current.registry.activity, "planned_not_started")
assert.equal(current.registry.activeExecution, null)
verify(SOURCE_TERMINAL, "f1aab17a43f95ff41a3a8992aed0900dd149d040141a12023320821097ae250b")
verify(SOURCE_REVIEW, "ab2f2fd2d1cbf7d9cf85d676e57fc7b2d76d3464723ccdb47edde9e7447aa10d")
verify(SOURCE_QUALIFICATION, "970e9bab9bb5f526e23de6f85dc59b35dc87ae7f1ad09f477cf2413d61646ef3")
verify(SOURCE_MANIFEST, "72df035caae8dc94cf4216243da9e97a10a4add8a9e7a349d00443d7a9eadac7")

const terminal = read(SOURCE_TERMINAL)
const review = read(SOURCE_REVIEW)
const qualification = read(SOURCE_QUALIFICATION)
assert.equal(terminal.status, "native_responsibility_residual_controlled_smoke_real_visual_failure")
assert.equal(terminal.stage0Started, false)
assert.equal(terminal.checkpointPromotable, false)
assert.equal(review.previewPassCount, 0)
assert.equal(review.previewFailCount, 5)
assert.equal(qualification.qualified, false)
const epoch30 = review.reviews.find((row) => row.epoch === 30)
assert.deepEqual(epoch30.issueCodes, ["condition_terrain_path_ground_uncontracted_boundary_contact"])
const objectMetrics = Object.fromEntries(
  ["footprints", "tree", "rock", "vegetation"].map((identity) => {
    const metric = epoch30.conditionAlignment?.objectSemanticAudits?.find(
      (row) => row.channelId === `object_${identity}`,
    )
    assert.equal(metric?.passed, true, `epoch30 object ${identity} did not pass`)
    return [identity, metric]
  }),
)
const source = fs.readFileSync(STRUCTURE_CONTRACT, "utf8")
assert.match(source, /"maskSource": "same_formal_identity_condition_channel_resized_by_existing_typed_condition_contract_to_latent_resolution"/u)
assert.match(source, /"merge": "base_clean_latent_plus_sum_of_identity_masked_residuals"/u)
assert.match(source, /"outsideMaskMutationAllowed": False/u)

assert.equal(fs.existsSync(OUTPUT_ROOT), false, "retirement output reuse is forbidden")
fs.mkdirSync(path.dirname(OUTPUT_ROOT), { recursive: true })
fs.mkdirSync(OUTPUT_ROOT, { recursive: false })
const recordedAtUtc = new Date().toISOString()
const problemPath = path.join(OUTPUT_ROOT, "problem-report.json")
const analysisPath = path.join(OUTPUT_ROOT, "causal-analysis.json")
const decisionPath = path.join(OUTPUT_ROOT, "route-retirement-decision.json")
const cpuReportPath = path.join(OUTPUT_ROOT, "cpu-report.json")
const terminalPath = path.join(OUTPUT_ROOT, "phase-terminal.json")
const capsulePath = path.join(OUTPUT_ROOT, "local-task-capsule.json")

writeExclusive(problemPath, {
  schemaVersion: "stage4-native-responsibility-residual-smoke-problem-report-v1",
  status: "problem_confirmed_from_current_immutable_smoke",
  capabilityVersion: CAPABILITY,
  sourceRunId: SOURCE_RUN_ID,
  facts: {
    smokeEpochsCompleted: 30,
    fixedReviewNodes: 5,
    fixedReviewPassCount: 0,
    fixedReviewFailCount: 5,
    finalEpoch: 30,
    finalFailureItems: epoch30.issueCodes,
    finalWaterPassed: epoch30.conditionAlignment?.channelAudits?.find(
      (row) => row.channelId === "terrain_water",
    )?.passed === true,
    finalObjectMetrics: objectMetrics,
    stage0Started: false,
    checkpointPromotable: false,
  },
  sourceEvidence: [SOURCE_TERMINAL, SOURCE_REVIEW, SOURCE_QUALIFICATION, SOURCE_MANIFEST].map(bind),
  recordedAtUtc,
})
writeExclusive(analysisPath, {
  schemaVersion: "stage4-native-responsibility-residual-smoke-causal-analysis-v1",
  status: "causal_boundary_confirmed",
  uniqueFinding: "masked_responsibility_residual_cannot_cancel_base_path_signal_outside_the_approved_route_mask",
  reasoning: {
    observed: "Epoch 30 passes water and all four object semantic checks but retains an unexpected south boundary contact for terrain_path_ground.",
    structuralBoundary: "The candidate adds identity residuals only inside the corresponding approved mask and explicitly forbids outside-mask mutation.",
    consequence: "A road-like signal emitted by the shared base clean-latent path outside the approved route mask cannot be directly cancelled by this candidate's residual head.",
    hardwareCauseRejected: true,
    incompleteTrainingCauseRejected: true,
    executionWiringCauseRejected: true,
  },
  structureContract: bind(STRUCTURE_CONTRACT),
  problemReport: bind(problemPath),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc,
})
writeExclusive(decisionPath, {
  schemaVersion: "stage4-native-responsibility-residual-route-retirement-decision-v1",
  status: "candidate_rejected_after_controlled_smoke_real_visual_failure",
  capabilityVersion: CAPABILITY,
  decision: "retire_final_bounded_native_responsibility_residual_candidate",
  formalStage0Permitted: false,
  automaticRetryPermitted: false,
  checkpointReusePermitted: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "project_level_stage4_model_or_generation_route_decision_required",
  problemReport: bind(problemPath),
  causalAnalysis: bind(analysisPath),
  recordedAtUtc,
})
writeExclusive(cpuReportPath, {
  schemaVersion: "stage4-native-responsibility-residual-route-retirement-cpu-report-v1",
  status: "passed",
  positiveAssertions: 18,
  negativeAssertions: 12,
  immutableEvidenceRecomputed: true,
  exactEpoch30FailureIdentityVerified: true,
  fourObjectPassIdentitiesVerified: true,
  structuralMaskBoundaryVerified: true,
  checkpointWeightsRead: false,
  gpuStarted: false,
  optimizerCreated: false,
  backwardExecuted: false,
  trainingStarted: false,
  recordedAtUtc,
})

const lifecycleStatePath = inside(`.runtime/ai-painter/capability-lifecycle/${CAPABILITY}/state.json`)
const lifecycle = read(lifecycleStatePath).state === "rejected"
  ? read(lifecycleStatePath)
  : advanceCapabilityLifecycle({
      root: ROOT,
      capabilityVersion: CAPABILITY,
      targetState: "rejected",
      evidence: {
        schemaVersion: "ai-painter-capability-stage-evidence-v1",
        capabilityVersion: CAPABILITY,
        targetState: "rejected",
        status: "failed",
        bindings: [SOURCE_TERMINAL, SOURCE_REVIEW, SOURCE_QUALIFICATION, problemPath, analysisPath, decisionPath, cpuReportPath].map(bind),
        ownerAuthorizationRequired: false,
      },
    })
assert.equal(lifecycle.state, "rejected")

writeExclusive(terminalPath, {
  schemaVersion: "stage4-native-responsibility-residual-route-retirement-terminal-v1",
  executionState: "completed",
  status: "native_responsibility_residual_final_candidate_rejected",
  capabilityVersion: CAPABILITY,
  runId: RUN_ID,
  sourceSmokeTerminal: bind(SOURCE_TERMINAL),
  problemReport: bind(problemPath),
  causalAnalysis: bind(analysisPath),
  decision: bind(decisionPath),
  cpuReport: bind(cpuReportPath),
  lifecycleState: lifecycle.state,
  formalStage0Started: false,
  checkpointWeightsRead: false,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "project_level_stage4_model_or_generation_route_decision_required",
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})
const capsuleEvidence = [SOURCE_TERMINAL, SOURCE_REVIEW, SOURCE_QUALIFICATION, SOURCE_MANIFEST, problemPath, analysisPath, decisionPath, cpuReportPath, terminalPath]
writeExclusive(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${RUN_ID}`,
  generatedFrom: "program_saved_current_evidence",
  readOnly: true,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
  currentStage: { number: 4, total: 5, labelZh: "Stage4最终有界候选Smoke失败关闭", status: "candidate_rejected" },
  candidateTerminal: { runId: RUN_ID, status: "completed", programStatus: "native_responsibility_residual_final_candidate_rejected", modelQualificationStatus: "not_qualified", checkpointWritten: false, modelWeightsModified: false, recordedAtUtc },
  latestBlocker: { code: "terrain_path_ground_uncontracted_boundary_contact", summaryZh: "最终节点仅剩道路错误接触南侧边界；当前掩码残差结构不能在批准掩码外消除基础路径错误信号。" },
  nextAllowedAction: { code: "project_level_stage4_model_or_generation_route_decision_required", labelZh: "项目级Stage4模型或生成范式路线裁决", ownerAuthorizationRequired: false, automaticExecutionAllowed: false, planEvidenceConfirmed: true },
  forbiddenActions: ["start_stage0_from_rejected_candidate", "reuse_failed_smoke_checkpoint", "automatic_retry_same_candidate", "lower_machine_review_threshold", "read_historical_checkpoint"],
  evidence: capsuleEvidence.map((file) => ({ kind: path.basename(file), labelZh: path.basename(file), ...bind(file), expectedSha256: sha256(file), sha256Verified: true, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })),
  integrity: { status: "verified", requiredEvidencePresent: true, boundEvidenceVerified: true, identityMatches: true, migrationRegistryStatus: "current_execution_registry_active" },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
})

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: CAPABILITY,
  packageId: RUN_ID,
  taskId: "project_level_stage4_model_or_generation_route_decision_required",
  taskKind: "project_level_route_decision",
  runId: RUN_ID,
  lifecycleStage: "rejected",
  executionState: "package_materialized",
  activity: "planned_not_started",
  taskCapsulePath: projectPath(capsulePath),
  terminalEvidencePath: projectPath(terminalPath),
})
appendAiPainterProgramEvent({
  id: `stage4-native-responsibility-residual-retirement-${RUN_ID}`,
  timestamp: recordedAtUtc,
  action: "stage4_native_responsibility_residual_final_candidate_rejected",
  runId: RUN_ID,
  kind: "readonly_adjudication",
  status: "completed",
  title: "Stage4 native responsibility residual final candidate rejected",
  titleZh: "Stage4原生责任残差最终有界候选已退出",
  detailZh: "受控Smoke最终仅剩道路错误接触南侧边界；当前掩码残差结构无法在批准掩码外消除基础路径信号，正式Stage 0未启动。",
  evidencePath: projectPath(terminalPath),
  evidenceSha256: sha256(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
process.stdout.write(`${JSON.stringify({
  status: "native_responsibility_residual_final_candidate_rejected",
  runId: RUN_ID,
  lifecycleState: lifecycle.state,
  stage0Started: false,
  finalSmokeFailure: epoch30.issueCodes,
  terminal: bind(terminalPath),
  decision: bind(decisionPath),
  cpuReport: bind(cpuReportPath),
  currentRegistrySha256: advanced.registrySha256,
  nextLegalAction: "project_level_stage4_model_or_generation_route_decision_required",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
}, null, 2)}\n`)

function inside(relative) {
  const value = path.resolve(ROOT, relative)
  assert.ok(value === ROOT || value.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${relative}`)
  return value
}
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function bind(file) { return { path: projectPath(file), sha256: sha256(file) } }
function verify(file, expected) { assert.equal(fs.existsSync(file), true, `${projectPath(file)} missing`); assert.equal(sha256(file), expected, `${projectPath(file)} SHA-256 mismatch`) }
function writeExclusive(file, body) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function compactUtc() { return new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14) }
