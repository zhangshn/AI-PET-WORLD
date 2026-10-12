// Record the bounded V26 comparison and close its failed route, without retraining.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from
  "../src/server/ai-painter-current-execution-registry.mjs"
import { validateV26Review } from "./run-ai-painter-mvp256-dry-v26-v2-independent-audit.mjs"

const sha = payload => crypto.createHash("sha256").update(payload).digest("hex")
function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && ![".", "..", "latest", "latest.json"].includes(part)))
  const target = path.resolve(root, logical)
  assert.ok(target.startsWith(`${root}${path.sep}`))
  return target
}
function read(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const payload = fs.readFileSync(inside(root, binding.path))
  assert.equal(sha(payload), binding.sha256, `changed evidence: ${binding.path}`)
  return payload
}
const json = (root, binding) => JSON.parse(read(root, binding))

export function closeDecision(comparison, audit, baseline) {
  assert.ok(["dry_single_world_review_failed_closed",
    "dry_single_world_numeric_passed_visual_approval_pending"].includes(audit.status))
  for (const key of ["visualApprovalGranted", "formalStage4QualificationGranted", "runtimePublicationGranted"])
    assert.equal(audit[key], false)
  assert.equal(audit.runId, comparison.runId)
  assert.deepEqual(audit.selectedCheckpoint, comparison.selectedCheckpoint)
  const previous = comparison.measurements.v24.selectionCpu
  const current = comparison.measurements.v26.selectionCpu
  assert.ok([previous.meanValidationRgbMae, current.meanValidationRgbMae,
    previous.worstApplicableObjectCorrelation, current.worstApplicableObjectCorrelation].every(Number.isFinite))
  const auditPassed = audit.status === "dry_single_world_numeric_passed_visual_approval_pending"
  if (auditPassed) {
    assert.equal(audit.objectSemanticsPassed, true)
    assert.deepEqual(audit.issueCodes, [])
  } else assert.ok(audit.issueCodes.length > 0)
  const validationImproved = current.worstApplicableObjectCorrelation > previous.worstApplicableObjectCorrelation
    && current.meanValidationRgbMae <= previous.meanValidationRgbMae
  const successful = auditPassed && validationImproved
  return { status: successful ? audit.status : "dry_single_world_review_failed_closed",
    routeDecision: successful ? "bounded_context_comparison_complete_no_automatic_retry"
      : "close_context_isolation_route_no_automatic_retry",
    executionState: successful ? "completed" : "failed_closed",
    validationImprovedWithoutMeanRgbRegression: validationImproved,
    validation: { meanRgbMaeV24: previous.meanValidationRgbMae,
      meanRgbMaeV26: current.meanValidationRgbMae,
      meanRgbMaeDeltaV26MinusV24: current.meanValidationRgbMae - previous.meanValidationRgbMae,
      worstObjectCorrelationV24: previous.worstApplicableObjectCorrelation,
      worstObjectCorrelationV26: current.worstApplicableObjectCorrelation,
      worstObjectCorrelationDeltaV26MinusV24:
        current.worstApplicableObjectCorrelation - previous.worstApplicableObjectCorrelation },
    previousSemanticIssues: baseline.issueCodes, currentSemanticIssues: audit.issueCodes,
    independentChallengeResult: false, positiveWaterAndShorelineCapability: "unverified_not_passed",
    visualApprovalGranted: false, formalStage4QualificationGranted: false, runtimePublicationGranted: false }
}

export async function reconcile(root, auditBinding, execute = false) {
  root = fs.realpathSync(root)
  const audit = json(root, auditBinding)
  const report = json(root, audit.input)
  const execution = json(root, report.executionPackage)
  const terminal = json(root, report.trainingTerminal)
  const worker = json(root, report.workerTerminal)
  const policy = json(root, report.candidateContract)
  const parent = json(root, report.sourceDataCandidate)
  const scope = json(root, parent.frozenBindings.dryScope)
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode)
  validateV26Review({ report, execution, terminal, worker, registry: current.registry, policy, parent, scope })
  assert.equal(current.registry.runId, report.runId)
  for (const binding of Object.values(execution.programBindings)) read(root, binding)
  for (const binding of [report.program, report.selectedCheckpoint, report.candidateRgb,
    report.responsibility.archive, audit.program, audit.numericContract, audit.detailContract]) read(root, binding)
  assert.deepEqual(audit.numericContract, parent.frozenBindings.numericReview)
  assert.deepEqual(audit.detailContract, parent.frozenBindings.detailReview)
  const decision = closeDecision(report, audit, json(root, report.baselineAudit))
  if (current.registry.activity === decision.status) {
    assert.equal(current.registry.nextMachineAction, null)
    assert.equal(current.currentTaskTerminal.routeDecision, decision.routeDecision)
    return { status: "already_reconciled", stage4Advanced: false }
  }
  assert.equal(current.registry.activity, "training_completed_review_pending")
  assert.equal(current.registry.terminalEvidence.sha256, report.trainingTerminal.sha256)
  if (!execute) return { status: "review_closure_preflight_passed", decision, registryWritten: false }
  const out = path.posix.dirname(auditBinding.path)
  assert.equal(out, `${execution.outputRoot}/dry-review`)
  const writeOrVerify = (name, value) => {
    const logical = `${out}/${name}`
    const payload = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
    const target = inside(root, logical)
    if (fs.existsSync(target)) assert.ok(fs.readFileSync(target).equals(payload), "closure record differs")
    else {
      const fd = fs.openSync(target, "wx")
      try { fs.writeFileSync(fd, payload); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
    }
    return { path: logical, sha256: sha(payload) }
  }
  const end = writeOrVerify("review-terminal.json", {
    schemaVersion: "ai-painter-mvp256-dry-v26-v2-review-terminal-v1", ...decision,
    executionState: decision.executionState, runId: report.runId, packageId: report.packageId,
    audit: auditBinding, cpuComparison: audit.input, trainingTerminal: report.trainingTerminal,
    selectedCheckpoint: report.selectedCheckpoint, trainingStartedByReconciliation: false,
  })
  const capsule = writeOrVerify("review-capsule.json", {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: `${report.runId}-review-closure`,
    integrity: { status: "verified" }, evidence: [
      { ...auditBinding, kind: "dry_single_world_review_audit", sha256Verified: true },
      { ...audit.input, kind: "cpu_validation_comparison", sha256Verified: true },
    ],
  })
  const result = await advanceCurrentExecutionRegistry({ projectRoot: root,
    capabilityVersion: current.registry.capabilityVersion, packageId: current.registry.packageId,
    taskId: `${report.runId}-review-closure`, taskKind: "mvp256_dry_v26_v2_review_closure",
    taskGoal: "Close the V26 context isolation comparison after its frozen validation and dry-world review.",
    priority: current.registry.priority, queueStatus: decision.executionState, nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc, runId: report.runId,
    lifecycleStage: current.registry.lifecycleStage, executionState: decision.executionState, activity: decision.status,
    taskCapsulePath: capsule.path, terminalEvidencePath: end.path, activeExecution: null,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256 })
  assert.equal(result.ok, true)
  return { status: decision.status, terminal: end, stage4Advanced: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, logical, digest] = process.argv.slice(2)
  assert.ok(["--check", "--execute"].includes(mode))
  process.stdout.write(`${JSON.stringify(await reconcile(process.cwd(), { path: logical, sha256: digest }, mode === "--execute"))}\n`)
}
