// Independent, bounded review of one selected native-256 dry-world candidate.
// It cannot qualify Stage4, approve a RuntimeFrame, or train a model.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"

import { readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"
import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"
import { auditProfessionalAestheticFromFrozenContract } from
  "./lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs"
import { decodeV17ResponsibilityArtifact } from
  "./lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"
import { decideMvp256DryReview } from "./lib/ai-painter-mvp256-dry-review-decision-v1.mjs"

const CAPABILITY = "stage4_mvp256_dry_v24_closed_loop_candidate_v1"
const CONTRACT = "data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json"
const PROGRAM = "scripts/run-ai-painter-mvp256-dry-v24-independent-audit.mjs"
const MAX_REVIEW_BYTES = 8 * 1024 * 1024
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")

function inside(root, logical) {
  assert.equal(typeof logical, "string")
  assert.ok(logical && !path.isAbsolute(logical) && !/^[A-Za-z]:/u.test(logical)
    && !logical.includes("\\") && logical.split("/").every(part =>
      part && part !== "." && part !== ".." && part !== "latest" && part !== "latest.json"),
  "unsafe project-relative evidence path")
  const absolute = path.resolve(root, logical)
  assert.ok(absolute.startsWith(`${root}${path.sep}`), "evidence escaped project")
  return absolute
}

function bytes(root, binding) {
  assert.deepEqual(Object.keys(binding ?? {}).sort(), ["path", "sha256"])
  assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
  const result = fs.readFileSync(inside(root, binding.path))
  assert.equal(sha(result), binding.sha256, `evidence changed: ${binding.path}`)
  return result
}

function json(root, binding) { return JSON.parse(bytes(root, binding).toString("utf8")) }
function bind(root, logical) { return { path: logical, sha256: sha(fs.readFileSync(inside(root, logical))) } }

export function validateDryReviewLineage({ manifest, contract, execution, worker, registry,
  dataset, source, dryScope, checkpoint, inputBinding }) {
  assert.equal(manifest?.schemaVersion, "ai-painter-mvp256-dry-v24-candidate-manifest-v1")
  assert.equal(manifest.status, "candidate_materialized_review_pending")
  assert.equal(manifest.capabilityVersion, CAPABILITY)
  assert.deepEqual(manifest.candidateContract, contract.binding)
  assert.equal(manifest.runId, execution.runId)
  assert.equal(manifest.packageId, execution.packageId)
  assert.equal(execution.capabilityVersion, CAPABILITY)
  assert.deepEqual(execution.candidateContract, contract.binding)
  assert.equal(worker.runId, execution.runId)
  assert.equal(worker.packageId, execution.packageId)
  assert.equal(worker.status, "training_completed_review_pending")
  assert.equal(worker.optimizerStepsGenerator, 2304)
  assert.equal(worker.optimizerStepsDiscriminator, 2304)
  assert.equal(worker.checkpointReloadVerified, true)
  assert.deepEqual(worker.selectedCheckpoint, manifest.selectedCheckpoint)
  assert.equal(worker.selectedEpoch, manifest.selectedEpoch)
  assert.ok([24, 36, 48].includes(worker.selectedEpoch))
  assert.deepEqual(worker.selectedRank, manifest.selectedRank)
  assert.deepEqual(manifest.selectedCheckpoint, checkpoint.binding)
  assert.equal(worker.checkpointPromotable, false)
  assert.equal(registry.activeExecution, null)
  assert.equal(registry.latestTrainingTerminal?.runId, execution.runId)
  assert.deepEqual({ path: registry.latestTrainingTerminal.path,
    sha256: registry.latestTrainingTerminal.sha256 }, manifest.trainingTerminal)
  assert.deepEqual(execution.datasetManifest, manifest.datasetManifest)
  assert.deepEqual(dataset.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(manifest.subject?.sampleId, dryScope.preselectedSubject.sampleId)
  assert.equal(manifest.subject.split, "validation")
  assert.equal(manifest.subject.worldId, dryScope.preselectedSubject.worldId)
  assert.equal(manifest.subject.regionId, dryScope.preselectedSubject.regionId)
  assert.equal(manifest.subject.tick, dryScope.preselectedSubject.tick)
  assert.equal(manifest.subject.factHash, dryScope.preselectedSubject.factHash)
  assert.deepEqual(manifest.subject.conditionPack, dryScope.preselectedSubject.conditionPack)
  assert.deepEqual(manifest.subject.referenceRgb,
    source.samples.find(row => row.sampleId === manifest.subject.sampleId && row.split === "validation")?.image)
  assert.deepEqual(manifest.candidate.resolution, [256, 192])
  assert.equal(manifest.candidate.sampleId, manifest.subject.sampleId)
  assert.equal(manifest.candidate.split, "validation")
  assert.equal(manifest.candidate.sourceCheckpointSha256, manifest.selectedCheckpoint.sha256)
  assert.equal(manifest.modelStateSha256Before, manifest.modelStateSha256After)
  assert.equal(manifest.responsibility?.evidence?.tensorArchive?.path,
    manifest.responsibility?.archive?.path)
  assert.equal(manifest.responsibility?.evidence?.tensorArchive?.sha256,
    manifest.responsibility?.archive?.sha256)
  assert.equal(contract.value.review.candidateCount, 1)
  assert.equal(contract.value.activation.reviewExecutionAllowed, false,
    "static candidate must not self-authorize review")
  assert.deepEqual(execution.execution?.reviewPlan, {
    boundedDryReviewAllowed: true,
    formalStage4QualificationAllowed: false,
    runtimePublicationAllowed: false,
    numericThresholdContract: contract.value.frozenBindings.numericReview,
    detailThresholdContract: contract.value.frozenBindings.detailReview,
  })
  assert.equal(inputBinding.path, manifest.inputPath)
  return { runId: execution.runId, sampleId: manifest.subject.sampleId,
    selectedEpoch: worker.selectedEpoch, stage4Advanced: false }
}

export async function preflight(projectRoot, inputBinding) {
  const root = fs.realpathSync(projectRoot)
  const manifest = json(root, inputBinding)
  const contractBinding = bind(root, CONTRACT)
  const contract = json(root, contractBinding)
  const execution = json(root, manifest.executionPackage)
  const trainingTerminal = json(root, manifest.trainingTerminal)
  const worker = json(root, manifest.workerTerminal)
  const dataset = json(root, manifest.datasetManifest)
  const source = json(root, dataset.sourceIndex)
  const dryScope = json(root, contract.frozenBindings.dryScope)
  const checkpointBytes = bytes(root, manifest.selectedCheckpoint)
  // The checkpoint is a weights_only PyTorch archive. The worker's exact CPU
  // reload evidence is authoritative; JS never deserializes model weights.
  assert.ok(checkpointBytes.length > 0 && checkpointBytes.length < 128 * 1024 * 1024)
  const checkpoint = { binding: manifest.selectedCheckpoint }
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, current.errorCode ?? "current registry invalid")
  validateDryReviewLineage({ manifest, contract: { binding: contractBinding, value: contract },
    execution, worker, registry: current.registry, dataset, source, dryScope,
    checkpoint, inputBinding })
  assert.deepEqual(trainingTerminal.workerTerminal, manifest.workerTerminal)
  assert.equal(trainingTerminal.runId, manifest.runId)
  assert.equal(trainingTerminal.status, "training_completed_review_pending")
  const pack = json(root, manifest.subject.conditionPack)
  assert.equal(pack.worldId, manifest.subject.worldId)
  assert.equal(pack.tick, manifest.subject.tick)
  assert.deepEqual([pack.canvas.width, pack.canvas.height], [1024, 768])
  assert.equal(pack.channels?.length, 23)
  for (const channel of pack.channels) bytes(root, { path: channel.path, sha256: channel.sha256 })
  for (const binding of [manifest.subject.referenceRgb, manifest.candidate.rgb,
    manifest.responsibility.archive, manifest.responsibility.interface]) bytes(root, binding)
  const preview = await sharp(inside(root, manifest.candidate.rgb.path), { failOn: "error" }).metadata()
  assert.deepEqual([preview.width, preview.height], [256, 192])
  const roles = decodeV17ResponsibilityArtifact({
    archiveBytes: bytes(root, manifest.responsibility.archive),
    evidence: manifest.responsibility.evidence,
    expectedIdentity: {
      worldId: manifest.subject.worldId, regionId: manifest.subject.regionId,
      tick: manifest.subject.tick, factHash: manifest.subject.factHash,
      visualFactManifestSha256: manifest.subject.visualFactManifestSha256,
      conditionPackSha256: manifest.subject.conditionPack.sha256,
      modelStateSha256: manifest.modelStateSha256Before,
    },
    schemaBytes: bytes(root, manifest.responsibility.interface),
    schemaSha256: manifest.responsibility.interface.sha256,
    candidatePackSchemaVersion: json(root, manifest.responsibility.interface).candidatePackSchemaVersion,
  })
  assert.equal(roles.roleOrder.length, 7)
  return { root, manifest, contract, dataset, source, dryScope, pack,
    responsibilityRoleCount: roles.roleOrder.length, inputBinding }
}

export async function audit(projectRoot, inputBinding) {
  const ready = await preflight(projectRoot, inputBinding)
  const { root, manifest, contract, source, dryScope, inputBinding: input } = ready
  const outputRoot = path.posix.dirname(input.path)
  const reportPath = `${outputRoot}/independent-audit.json`
  const projectionPath = `${outputRoot}/condition-audit-input-1024.png`
  assert.equal(fs.existsSync(inside(root, reportPath)), false, "review already consumed")
  assert.equal(fs.existsSync(inside(root, projectionPath)), false, "projection already exists")
  const projection = await sharp(inside(root, manifest.candidate.rgb.path), { failOn: "error" })
    .resize(1024, 768, { kernel: "nearest" })
    .png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer()
  assert.ok(projection.length < MAX_REVIEW_BYTES, "review projection exceeds cap")
  fs.writeFileSync(inside(root, projectionPath), projection, { flag: "wx" })
  try {
    const thresholds = json(root, contract.frozenBindings.numericReview)
    const detailContract = json(root, contract.frozenBindings.detailReview)
    const row = source.samples.find(value => value.sampleId === manifest.subject.sampleId)
    assert.ok(row && row.split === "validation")
    const record = { recordId: `${manifest.runId}-dry-independent-review`,
      conditionBinding: { conditionPackPath: manifest.subject.conditionPack.path,
        worldId: manifest.subject.worldId, tick: manifest.subject.tick },
      classification: { monsoonSeason: row.monsoonSeason, regionalLandscapeType: null } }
    const [detail, aesthetic, alignment] = await Promise.all([
      auditMvp256DetailSufficiency({ candidatePath: inside(root, manifest.candidate.rgb.path),
        referencePath: inside(root, manifest.subject.referenceRgb.path), contract: detailContract }),
      auditProfessionalAestheticFromFrozenContract({ imagePath: inside(root, manifest.candidate.rgb.path),
        thresholdContract: thresholds,
        styleFingerprintPath: inside(root, thresholds.styleFingerprint.path),
        expectedStyleFingerprintSha256: thresholds.styleFingerprint.sha256 }),
      auditAiAssistedConditionAlignment({ record, imagePath: inside(root, projectionPath),
        referenceImagePath: inside(root, manifest.subject.referenceRgb.path) }),
    ])
    const decision = decideMvp256DryReview({ scope: dryScope.preselectedSubject,
      candidate: { sampleId: manifest.candidate.sampleId, split: manifest.candidate.split,
        resolution: manifest.candidate.resolution },
      detail, aesthetic, alignment, responsibilityRoleCount: ready.responsibilityRoleCount })
    const auditResult = {
      schemaVersion: "ai-painter-mvp256-dry-v24-independent-audit-v1",
      ...decision, runId: manifest.runId, sampleId: manifest.subject.sampleId,
      selectedEpoch: manifest.selectedEpoch, input, candidateRgb: manifest.candidate.rgb,
      selectedCheckpoint: manifest.selectedCheckpoint,
      projection: bind(root, projectionPath), numericContract: contract.frozenBindings.numericReview,
      detailContract: contract.frozenBindings.detailReview, program: bind(root, PROGRAM),
      detail, aesthetic, alignment,
      recordedAtUtc: new Date().toISOString(),
    }
    const encoded = Buffer.from(`${JSON.stringify(auditResult, null, 2)}\n`)
    assert.ok(encoded.length + projection.length <= MAX_REVIEW_BYTES, "review exceeds output cap")
    bytes(root, input)
    bytes(root, manifest.candidate.rgb)
    bytes(root, manifest.selectedCheckpoint)
    fs.writeFileSync(inside(root, reportPath), encoded, { flag: "wx" })
    return { status: auditResult.status, issueCodes: auditResult.issueCodes,
      report: bind(root, reportPath), stage4Advanced: false }
  } catch (error) {
    const failurePath = `${outputRoot}/independent-audit-failure.json`
    if (!fs.existsSync(inside(root, failurePath)))
      fs.writeFileSync(inside(root, failurePath), `${JSON.stringify({
        status: "review_failed_closed", input, error: String(error),
        recordedAtUtc: new Date().toISOString(), trainingStarted: false,
        optimizerSteps: 0, stage4Advanced: false }, null, 2)}\n`, { flag: "wx" })
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, manifestPath, manifestSha] = process.argv.slice(2)
  assert.ok(["--check", "--execute"].includes(mode))
  assert.match(manifestSha ?? "", /^[0-9a-f]{64}$/u)
  const input = { path: manifestPath, sha256: manifestSha }
  const result = mode === "--check" ? await preflight(process.cwd(), input)
    .then(value => ({ status: "review_preflight_passed_not_executed",
      runId: value.manifest.runId, candidateRgb: value.manifest.candidate.rgb,
      stage4Advanced: false })) : await audit(process.cwd(), input)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
