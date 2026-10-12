// V26 review adapter: reuse the frozen V24 auditors, never train or publish.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"
import { auditProfessionalAestheticFromFrozenContract } from "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { decodeV17ResponsibilityArtifact } from "./lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"
import { decideMvp256DryReview } from "./lib/ai-painter-mvp256-dry-review-decision-v1.mjs"

const CAPABILITY = "stage4_mvp256_dry_object_local_context_isolation_v26_v1"
const PROGRAM = "scripts/run-ai-painter-mvp256-dry-v26-independent-audit.mjs"
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && ![".", "..", "latest", "latest.json"].includes(part)), "unsafe evidence path")
  const target = path.resolve(root, logical)
  assert.ok(target.startsWith(`${root}${path.sep}`), "evidence escaped root")
  return target
}
function bytes(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const value = fs.readFileSync(inside(root, binding.path))
  assert.equal(sha(value), binding.sha256, `changed evidence: ${binding.path}`)
  return value
}
const json = (root, binding) => JSON.parse(bytes(root, binding))
const bind = (root, logical) => ({ path: logical, sha256: sha(fs.readFileSync(inside(root, logical))) })

export function validateV26Review({ report, execution, terminal, worker, registry, policy, parent, scope }) {
  assert.equal(report.schemaVersion, "ai-painter-mvp256-dry-v26-cpu-review-v1")
  assert.equal(report.status, "cpu_comparison_completed_visual_review_pending")
  for (const record of [report, execution, terminal, worker]) {
    assert.equal(record.capabilityVersion, CAPABILITY)
    assert.equal(record.runId, execution.runId)
    assert.equal(record.packageId, execution.packageId)
  }
  assert.equal(terminal.status, "training_completed_review_pending")
  assert.equal(worker.status, terminal.status)
  assert.equal(worker.completedEpochs, 48)
  assert.equal(worker.optimizerStepsGenerator, 2304)
  assert.equal(worker.optimizerStepsDiscriminator, 2304)
  assert.equal(worker.checkpointReloadVerified, true)
  assert.deepEqual(report.selectedCheckpoint, worker.selectedCheckpoint)
  assert.equal(report.selectedEpoch, worker.selectedEpoch)
  assert.deepEqual(report.candidateContract, execution.candidateContract)
  assert.deepEqual(report.sourceDataCandidate, policy.predecessorCandidate)
  assert.deepEqual(execution.sourceDataCandidate, report.sourceDataCandidate)
  assert.equal(policy.executionVersion, "context_isolation_v1")
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.latestTrainingTerminal?.runId, execution.runId)
  assert.deepEqual({ path: registry.latestTrainingTerminal.path,
    sha256: registry.latestTrainingTerminal.sha256 }, report.trainingTerminal)
  assert.deepEqual(terminal.workerTerminal, report.workerTerminal)
  assert.deepEqual(terminal.executionPackage, report.executionPackage)
  assert.equal(report.subject.sampleId, scope.preselectedSubject.sampleId)
  for (const key of ["worldId", "regionId", "tick", "factHash", "conditionPack"])
    assert.deepEqual(report.subject[key], scope.preselectedSubject[key])
  assert.equal(report.subject.split, "validation")
  assert.equal(report.optimizerSteps, 0)
  for (const key of ["gpuStarted", "weightsModified", "challengeContentRead", "regressionContentRead",
    "formalStage4QualificationGranted", "runtimePublicationGranted"])
    assert.equal(report[key], false)
  assert.equal(report.validationSampleIds.length, 8)
  assert.equal(new Set(report.validationSampleIds).size, 8)
  for (const label of ["v24", "v26"])
    assert.deepEqual(report.measurements[label].rows.map(row => row.sampleId), report.validationSampleIds)
  assert.deepEqual(execution.execution.reviewPlan, {
    boundedDryReviewAllowed: true, formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false, numericThresholdContract: parent.frozenBindings.numericReview,
    detailThresholdContract: parent.frozenBindings.detailReview,
  })
  return true
}

export async function audit(projectRoot, input) {
  const root = fs.realpathSync(projectRoot)
  const report = json(root, input)
  const execution = json(root, report.executionPackage)
  const terminal = json(root, report.trainingTerminal)
  const worker = json(root, report.workerTerminal)
  const policy = json(root, report.candidateContract)
  const parent = json(root, report.sourceDataCandidate)
  const scope = json(root, parent.frozenBindings.dryScope)
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode)
  validateV26Review({ report, execution, terminal, worker, registry: current.registry, policy, parent, scope })
  for (const binding of Object.values(execution.programBindings)) bytes(root, binding)
  bytes(root, report.program)
  const dataset = json(root, execution.datasetManifest)
  const source = json(root, dataset.sourceIndex)
  const split = json(root, execution.validationSplit)
  assert.deepEqual(split.sampleIds, report.validationSampleIds)
  const row = source.samples.find(value => value.sampleId === report.subject.sampleId)
  assert.equal(row.split, "validation")
  assert.deepEqual(row.image, report.subject.referenceRgb)
  const pack = json(root, report.subject.conditionPack)
  assert.equal(pack.worldId, report.subject.worldId)
  assert.equal(pack.tick, report.subject.tick)
  assert.equal(pack.channels.length, 23)
  for (const channel of pack.channels) bytes(root, { path: channel.path, sha256: channel.sha256 })
  for (const binding of [report.candidateRgb, report.subject.referenceRgb, report.selectedCheckpoint]) bytes(root, binding)
  const metadata = await sharp(inside(root, report.candidateRgb.path)).metadata()
  assert.deepEqual([metadata.width, metadata.height], [256, 192])
  const roles = decodeV17ResponsibilityArtifact({ archiveBytes: bytes(root, report.responsibility.archive),
    evidence: report.responsibility.evidence, expectedIdentity: {
      worldId: report.subject.worldId, regionId: report.subject.regionId, tick: report.subject.tick,
      factHash: report.subject.factHash, visualFactManifestSha256: report.subject.visualFactManifestSha256,
      conditionPackSha256: report.subject.conditionPack.sha256,
      modelStateSha256: worker.selectedModelStateSha256,
    }, schemaBytes: bytes(root, report.responsibility.interface),
    schemaSha256: report.responsibility.interface.sha256,
    candidatePackSchemaVersion: json(root, report.responsibility.interface).candidatePackSchemaVersion })
  const out = path.posix.dirname(input.path)
  const resultPath = `${out}/independent-audit.json`
  const projectionPath = `${out}/condition-audit-input-1024.png`
  assert.equal(fs.existsSync(inside(root, resultPath)), false, "audit already consumed")
  assert.equal(fs.existsSync(inside(root, projectionPath)), false, "projection already exists")
  const projection = await sharp(bytes(root, report.candidateRgb)).resize(1024, 768, { kernel: "nearest" }).png().toBuffer()
  fs.writeFileSync(inside(root, projectionPath), projection, { flag: "wx" })
  const thresholds = json(root, parent.frozenBindings.numericReview)
  const [detail, aesthetic, alignment] = await Promise.all([
    auditMvp256DetailSufficiency({ candidatePath: inside(root, report.candidateRgb.path),
      referencePath: inside(root, row.image.path), contract: json(root, parent.frozenBindings.detailReview) }),
    auditProfessionalAestheticFromFrozenContract({ imagePath: inside(root, report.candidateRgb.path),
      thresholdContract: thresholds, styleFingerprintPath: inside(root, thresholds.styleFingerprint.path),
      expectedStyleFingerprintSha256: thresholds.styleFingerprint.sha256 }),
    auditAiAssistedConditionAlignment({ record: { recordId: `${report.runId}-dry-independent-review`,
      conditionBinding: { conditionPackPath: report.subject.conditionPack.path,
        worldId: report.subject.worldId, tick: report.subject.tick },
      classification: { monsoonSeason: row.monsoonSeason, regionalLandscapeType: null } },
      imagePath: inside(root, projectionPath), referenceImagePath: inside(root, row.image.path) }),
  ])
  const decision = decideMvp256DryReview({ scope: scope.preselectedSubject,
    candidate: { sampleId: report.subject.sampleId, split: "validation", resolution: [256, 192] },
    detail, aesthetic, alignment, responsibilityRoleCount: roles.roleOrder.length })
  const value = { schemaVersion: "ai-painter-mvp256-dry-v26-independent-audit-v1", ...decision,
    runId: report.runId, sampleId: report.subject.sampleId, selectedEpoch: report.selectedEpoch,
    input, selectedCheckpoint: report.selectedCheckpoint, candidateRgb: report.candidateRgb,
    program: bind(root, PROGRAM), projection: bind(root, projectionPath),
    numericContract: parent.frozenBindings.numericReview, detailContract: parent.frozenBindings.detailReview,
    detail, aesthetic, alignment, recordedAtUtc: new Date().toISOString() }
  const encoded = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  assert.ok(encoded.length + projection.length <= 8 * 1024 * 1024)
  bytes(root, input)
  bytes(root, report.candidateRgb)
  fs.writeFileSync(inside(root, resultPath), encoded, { flag: "wx" })
  return { status: value.status, issueCodes: value.issueCodes, report: bind(root, resultPath), stage4Advanced: false }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, logical, digest] = process.argv.slice(2)
  assert.equal(mode, "--execute")
  const root = fs.realpathSync(process.cwd())
  const input = { path: logical, sha256: digest }
  // Preflight failure never creates or changes a training record.
  const initial = json(root, input)
  const failurePath = `${path.posix.dirname(logical)}/independent-audit-failure.json`
  try {
    process.stdout.write(`${JSON.stringify(await audit(root, input))}\n`)
  } catch (error) {
    if (!fs.existsSync(inside(root, failurePath)))
      fs.writeFileSync(inside(root, failurePath), `${JSON.stringify({
        status: "review_failed_closed", runId: initial.runId, input, error: String(error.stack ?? error),
        optimizerSteps: 0, stage4Advanced: false, recordedAtUtc: new Date().toISOString(),
      }, null, 2)}\n`, { flag: "wx" })
    throw error
  }
}
