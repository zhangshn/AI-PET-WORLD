import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"


const ROOT = process.cwd()
const REVIEW_FAILED = "stage4_mvp_stage0_machine_review_failed"
const REVIEW_PASSED = "stage4_mvp_stage0_machine_review_passed"
const V10_CAPABILITY = "stage4_mvp_native_complete_rgb_aperiodic_detail_renderer_v10"
const V11_CAPABILITY = "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
const V12_CAPABILITY = "stage4_mvp_native_complete_rgb_local_texture_renderer_v12"
const V9_CAPABILITY = "stage4_mvp_native_complete_rgb_detail_recovery_renderer_v9"

const args = parseArgs(process.argv.slice(2))
const reportBinding = {
  path: required(args, "machine-review").replaceAll("\\", "/"),
  sha256: required(args, "machine-review-sha256"),
}
const report = readBoundJson(reportBinding, "machineReview")
assert.equal(report.schemaVersion, "ai-painter-stage4-mvp-stage0-machine-review-v1")
assert.equal([REVIEW_FAILED, REVIEW_PASSED].includes(report.status), true)
assert.equal(report.executionState, "completed")
assert.equal(report.runId.length > 0, true)
const detailReviewBinding = args.has("detail-review") ? {
  path: required(args, "detail-review").replaceAll("\\", "/"),
  sha256: required(args, "detail-review-sha256"),
} : null
const detailReview = detailReviewBinding
  ? readBoundJson(detailReviewBinding, "detailReview") : null
if (report.architectureId === V9_CAPABILITY || report.architectureId === V10_CAPABILITY || report.architectureId === V11_CAPABILITY || report.architectureId === V12_CAPABILITY) assert.ok(detailReview, "native RGB detail review is required")
if (detailReview) {
  assert.equal(detailReview.schemaVersion, "stage4-mvp-256-detail-sufficiency-review-v1")
  assert.equal(detailReview.executionState, "completed")
  assert.equal(detailReview.runId, report.runId)
  assert.deepEqual(detailReview.candidateManifest, report.candidateManifest)
}

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
if (current.registry.taskId === `${report.runId}-machine-review-closed`) {
  assert.equal(current.currentTaskTerminal.machineReview.sha256, reportBinding.sha256)
  process.stdout.write(`${JSON.stringify({
    status: current.currentTaskTerminal.status,
    terminal: current.registry.terminalEvidence,
    registryRevision: current.registry.registryRevision,
    recoveredCommittedResult: true,
  }, null, 2)}\n`)
  process.exit(0)
}
assert.equal(current.registry.runId, report.runId)
assert.equal(current.registry.capabilityVersion, report.architectureId)
assert.equal(current.registry.nextMachineAction, "run_stage0_machine_review")
assert.equal(current.registry.activeExecution, null)

const candidateManifest = readBoundJson(report.candidateManifest, "candidateManifest")
const trainingTerminal = readBoundJson(report.trainingTerminal, "trainingTerminal")
assert.equal(candidateManifest.runId, report.runId)
assert.equal(trainingTerminal.runId, report.runId)
assert.equal(trainingTerminal.status, "training_completed_review_pending")
assert.equal(trainingTerminal.executionState, "completed")
assert.equal(trainingTerminal.capabilityVersion, report.architectureId)
assert.deepEqual(trainingTerminal.checkpoint, report.checkpoint)
assert.equal(report.candidatePassCount + report.candidateFailCount, report.candidateCount)
const detailPassed = !detailReview
  || detailReview.status === "stage4_mvp_256_detail_sufficiency_review_passed"
const formallyQualified = report.status === REVIEW_PASSED
  && detailPassed
  && report.reviewAuthority?.formalReviewDispatchable === true
  && report.formalQualificationGranted === true
assert.equal(report.checkpointPromotionEligible, formallyQualified)
assert.equal(report.stage1InitializationEligible, formallyQualified)

const outputRoot = path.dirname(inside(reportBinding.path))
const terminalPath = path.join(outputRoot, "terminal.json")
const capsulePath = path.join(outputRoot, "task-capsule.json")
const recordedAtUtc = report.recordedAtUtc
assert.equal(new Date(recordedAtUtc).toISOString(), recordedAtUtc)
const passed = report.status === REVIEW_PASSED && detailPassed
const terminalStatus = formallyQualified
  ? REVIEW_PASSED
  : passed
    ? "stage4_mvp_stage0_diagnostic_review_passed_not_formally_qualified"
    : REVIEW_FAILED
const terminal = {
  schemaVersion: "ai-painter-stage4-mvp-stage0-machine-review-terminal-v1",
  executionState: formallyQualified ? "completed" : "failed_closed",
  status: terminalStatus,
  capabilityVersion: report.architectureId,
  packageId: trainingTerminal.packageId,
  runId: report.runId,
  stage: report.stage,
  sourceTrainingTerminal: report.trainingTerminal,
  candidateManifest: report.candidateManifest,
  machineReview: reportBinding,
  detailReview: detailReviewBinding,
  checkpoint: report.checkpoint,
  candidateCount: report.candidateCount,
  candidatePassCount: report.candidatePassCount,
  candidateFailCount: report.candidateFailCount,
  detailCandidatePassCount: detailReview?.candidatePassCount ?? null,
  detailCandidateFailCount: detailReview?.candidateFailCount ?? null,
  issueHistogram: report.issueHistogram,
  diagnosticReviewPassed: passed,
  stagePassed: formallyQualified,
  reviewAuthority: report.reviewAuthority,
  formalQualificationGranted: formallyQualified,
  checkpointPromotionEligible: formallyQualified,
  stage1InitializationEligible: formallyQualified,
  automaticRetryStarted: false,
  thresholdChanged: false,
  reviewResultsUsedAsTrainingTarget: false,
  nextMachineAction: formallyQualified ? "compile_stage1_execution_package" : null,
  recordedAtUtc,
}
writeOrVerifyJson(terminalPath, terminal)
const terminalBinding = bind(terminalPath)
const capsule = {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${report.runId}-machine-review-closed`,
  generatedFrom: "program_saved_evidence",
  readOnly: true,
  module: { id: "ai-painter-stage4", nameZh: "AI Painter Stage4" },
  fixedOverallProgress: {
    completedStages: 3,
    totalStages: 5,
    percent: 60,
    source: "current_execution_registry",
  },
  currentStage: {
    number: 4,
    total: 5,
    labelZh: "Stage 0→1→2完整训练",
    status: terminal.status,
  },
  candidateTerminal: {
    runId: report.runId,
    status: terminal.status,
    recordedAtUtc,
  },
  latestBlocker: formallyQualified ? null : passed
    ? {
        code: "formal_review_contract_inactive",
        summaryZh: "256×192诊断审核通过，但正式审核合同尚未激活；本候选不晋级且不自动续训。",
      }
    : {
        code: "stage0_machine_review_failed",
        summaryZh: detailReview && !detailPassed
          ? "Stage0真实训练已完成，但8张验证候选未通过冻结机器审核及最低细节审核；本候选不晋级且不自动重训。"
          : "Stage0真实训练已完成，但8张验证候选未通过冻结机器审核；本候选不晋级且不自动重训。",
      },
  nextAllowedAction: terminal.nextMachineAction,
  forbiddenActions: [
    "automatic_retry",
    "reuse_failed_checkpoint",
    "lower_machine_review_threshold",
    "treat_stage0_as_formal_runtime_release",
  ],
  taskIdentity: { modelId: report.architectureId, runId: report.runId },
  latestTerminal: terminalBinding,
  evidence: [
    { kind: "stage0_training_terminal", ...report.trainingTerminal, sha256Verified: true },
    { kind: "stage0_review_candidate_manifest", ...report.candidateManifest, sha256Verified: true },
    { kind: "stage0_machine_review", ...reportBinding, sha256Verified: true },
    ...(detailReviewBinding
      ? [{ kind: "stage0_minimum_detail_review", ...detailReviewBinding, sha256Verified: true }]
      : []),
    { kind: "stage0_machine_review_terminal", ...terminalBinding, sha256Verified: true },
  ],
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
}
writeOrVerifyJson(capsulePath, capsule)
const capsuleBinding = bind(capsulePath)
const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: report.architectureId,
  packageId: trainingTerminal.packageId,
  taskId: `${report.runId}-machine-review-closed`,
  taskKind: "stage0_machine_review_closure",
  taskGoal: "Close the exact Stage0 training candidate from its immutable machine-review result.",
  priority: 5,
  queueStatus: formallyQualified ? "ready" : "completed",
  nextMachineAction: terminal.nextMachineAction,
  queuedAtUtc: recordedAtUtc,
  runId: report.runId,
  lifecycleStage: formallyQualified ? "stage0_review_passed" : "rejected",
  executionState: terminal.executionState,
  activity: terminal.status,
  taskCapsulePath: projectPath(capsulePath),
  terminalEvidencePath: projectPath(terminalPath),
  activeExecution: null,
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
})
process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  terminal: terminalBinding,
  registryRevision: advanced.registry.registryRevision,
  nextMachineAction: advanced.registry.nextMachineAction,
}, null, 2)}\n`)


function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--"), "invalid argument")
    assert.ok(values[index + 1] && !values[index + 1].startsWith("--"),
      `missing value for ${values[index]}`)
    parsed.set(values[index].slice(2), values[index + 1])
  }
  return parsed
}

function required(values, name) {
  const value = values.get(name)
  assert.ok(value, `--${name} is required`)
  return value
}

function inside(logicalPath) {
  assert.equal(path.isAbsolute(logicalPath), false, "project-relative path required")
  const resolved = path.resolve(ROOT, logicalPath)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    "path escapes project")
  return resolved
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replaceAll("\\", "/")
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function bind(value) {
  return { path: projectPath(value), sha256: sha256File(value) }
}

function readBoundJson(binding, role) {
  assert.match(binding?.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`)
  const absolute = inside(binding.path)
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`)
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`)
  return JSON.parse(fs.readFileSync(absolute, "utf8"))
}

function writeOrVerifyJson(valuePath, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`
  fs.mkdirSync(path.dirname(valuePath), { recursive: true })
  if (fs.existsSync(valuePath)) {
    assert.equal(fs.readFileSync(valuePath, "utf8"), bytes, `${valuePath} differs`)
    return
  }
  fs.writeFileSync(valuePath, bytes, { encoding: "utf8", flag: "wx" })
}
