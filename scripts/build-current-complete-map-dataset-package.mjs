import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { STRICT_PROJECT_OWNED_IP_POLICY_VERSION } from "./lib/complete-map-training-sample-contract.mjs"

const ROOT = process.cwd()
const OUTPUT_ROOT = path.join(ROOT, "data", "world-samples", "dataset-packages")
const auditPointer = readRequiredJson("data/world-samples/dataset-blueprints/latest-natural-home-complete-map-audit.json")
const audit = readRequiredJson(auditPointer.auditPath)
const dictionaryPointer = readRequiredJson("data/world-visual-data-dictionary/latest.json")
const dictionaryPath = resolveProjectPath(dictionaryPointer.dictionaryPath)
const taskPointer = readOptionalJson(".runtime/ai-painter/world-visual-generation-task-packages/latest.json")
const timestamp = new Date().toISOString()
const packageId = `natural-home-complete-map-${dictionaryPointer.dictionaryVersionId}-${timestamp.replace(/[:.]/g, "-")}`
const packageDir = path.join(OUTPUT_ROOT, packageId)

assert(audit.dictionaryVersionId === dictionaryPointer.dictionaryVersionId, "data audit dictionary is stale")
assert(audit.validatedSamples && typeof audit.validatedSamples === "object", "invalid audit validated sample collection")

const samples = []
for (const [classification, validated] of Object.entries(audit.validatedSamples)) {
  for (const item of validated) {
    const record = readRequiredJson(item.recordPath)
    samples.push({
      classification,
      sampleId: item.sampleId,
      sampleType: record.sampleType,
      split: record.split,
      trainingUsage: record.trainingUsage,
      imagePath: item.imagePath,
      imageSha256: item.imageSha256,
      recordPath: item.recordPath,
      blueprintHash: record.blueprintHash,
      conditionHashes: record.conditionHashes,
      taskPackageId: record.taskPackageId,
      directorPlanId: record.directorPlanId,
      sourceType: record.sourceType,
      independentTrainingEligible: record.independentTrainingEligible === true,
      trainingDataProvenance: record.trainingDataProvenance ?? null,
      modelOwnership: record.modelOwnership ?? null,
      upstreamModelIds: record.upstreamModelIds ?? [],
      thirdPartyGeneratedTrainingOutputUsed: record.thirdPartyGeneratedTrainingOutputUsed ?? null,
      conditionPackPath: record.conditionPackPath ?? null,
      ipProvenance: record.ipProvenance ?? null,
      ipEvidenceHashes: record.ipEvidenceHashes ?? [],
      sourceFileSha256: record.sourceFileSha256 ?? null,
      conditionPackFileSha256: record.conditionPackFileSha256 ?? null,
      ipProvenanceVerifiedByProgram: record.ipProvenanceVerifiedByProgram === true,
      ownerReviewStatus: record.ownerReviewStatus,
      machineReviewStatus: record.machineReviewStatus,
      failureCodes: record.failureCodes ?? [],
      affectedRegions: record.affectedRegions ?? record.failureRegions ?? [],
    })
  }
}

const isolationFailures = validateSplitIsolation(samples)
const splitIndex = Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [split, samples.filter((sample) => sample.split === split)]))
const status = audit.status === "training_data_sufficient" && isolationFailures.length === 0
  ? "training_ready"
  : "blocked_insufficient_or_invalid_training_data"

fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.mkdirSync(packageDir, { recursive: false })
const snapshotDir = path.join(packageDir, "snapshots")
fs.mkdirSync(snapshotDir, { recursive: true })
const dictionarySnapshotPath = path.join(snapshotDir, "world-visual-dictionary.json")
fs.copyFileSync(dictionaryPath, dictionarySnapshotPath)

const taskSnapshot = snapshotOptional(taskPointer?.taskPath, path.join(snapshotDir, "generation-task-package.json"))
const directorSnapshot = snapshotOptional(taskPointer?.directorPath, path.join(snapshotDir, "world-director-output.json"))
const conditionManifestSource = taskPointer?.taskPath
  ? path.join(path.dirname(resolveProjectPath(taskPointer.taskPath)), "compiled-conditions", "manifest.json")
  : null
const conditionSnapshot = snapshotOptional(conditionManifestSource, path.join(snapshotDir, "compiled-condition-manifest.json"))
const reviewSnapshotPath = path.join(snapshotDir, "review-gates.json")
writeJson(reviewSnapshotPath, buildReviewSnapshot())

const sourceIndex = {
  schemaVersion: "complete-map-dataset-source-index-v1",
  ipPolicyVersion: STRICT_PROJECT_OWNED_IP_POLICY_VERSION,
  packageId,
  dictionaryVersionId: dictionaryPointer.dictionaryVersionId,
  sampleCount: samples.length,
  samples,
}
writeJson(path.join(packageDir, "source-index.json"), sourceIndex)
for (const [split, rows] of Object.entries(splitIndex)) {
  writeJson(path.join(packageDir, "splits", `${split}.json`), {
    schemaVersion: "complete-map-dataset-split-v1",
    packageId,
    split,
    sampleCount: rows.length,
    samples: rows,
  })
}

writeClassificationIndex("positive/complete-map", samples.filter((sample) => sample.classification === "completeMapPositive"))
writeClassificationIndex("negative/complete-map", samples.filter((sample) => sample.classification === "completeMapNegative"))
writeClassificationIndex("transition", samples.filter((sample) => /^(grassToPath|grassToWater)/.test(sample.classification)))
writeClassificationIndex("object-grounding", samples.filter((sample) => /^objectToGround/.test(sample.classification)))
writeClassificationIndex("blocked", [])
writeJson(path.join(packageDir, "reports", "data-sufficiency-audit.json"), audit)

const manifest = {
  schemaVersion: "complete-map-dataset-package-v1",
  ipPolicyVersion: STRICT_PROJECT_OWNED_IP_POLICY_VERSION,
  packageId,
  parentPackageId: readOptionalJson(path.join(OUTPUT_ROOT, "latest.json"))?.packageId ?? null,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  status,
  immutable: true,
  dictionaryVersionId: dictionaryPointer.dictionaryVersionId,
  dataAuditId: audit.auditId,
  dataAuditStatus: audit.status,
  sampleCount: samples.length,
  observed: audit.observed,
  blockingGates: audit.blockingGates,
  splitCounts: Object.fromEntries(Object.entries(splitIndex).map(([split, rows]) => [split, rows.length])),
  splitIsolationFailures: isolationFailures,
  snapshots: {
    dictionary: snapshotRecord(dictionarySnapshotPath),
    taskPackage: taskSnapshot,
    directorOutput: directorSnapshot,
    compiledConditions: conditionSnapshot,
    reviewGates: snapshotRecord(reviewSnapshotPath),
  },
  sourceIndexPath: projectPath(path.join(packageDir, "source-index.json")),
  auditReportPath: projectPath(path.join(packageDir, "reports", "data-sufficiency-audit.json")),
  canStartFormalTraining: status === "training_ready",
  automaticStorage: true,
}
writeJson(path.join(packageDir, "manifest.json"), manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "complete-map-dataset-package-latest-v1",
  packageId,
  status,
  dictionaryVersionId: manifest.dictionaryVersionId,
  createdAtUtc: timestamp,
  packagePath: projectPath(packageDir),
  manifestPath: projectPath(path.join(packageDir, "manifest.json")),
  sourceIndexPath: manifest.sourceIndexPath,
  auditReportPath: manifest.auditReportPath,
  sampleCount: samples.length,
  canStartFormalTraining: manifest.canStartFormalTraining,
})

console.log(JSON.stringify({
  status,
  packageId,
  packagePath: projectPath(packageDir),
  sampleCount: samples.length,
  splitCounts: manifest.splitCounts,
  blockingGateCount: audit.blockingGates.length,
  splitIsolationFailures: isolationFailures,
  canStartFormalTraining: manifest.canStartFormalTraining,
}, null, 2))

function writeClassificationIndex(relativeDir, rows) {
  writeJson(path.join(packageDir, relativeDir, "index.json"), {
    schemaVersion: "complete-map-dataset-classification-index-v1",
    packageId,
    classificationPath: relativeDir,
    sampleCount: rows.length,
    samples: rows,
  })
}

function validateSplitIsolation(rows) {
  const failures = []
  const identities = new Map()
  for (const row of rows) {
    const keys = [row.imageSha256, row.blueprintHash, ...(row.conditionHashes ?? [])].filter(Boolean)
    for (const key of keys) {
      const existing = identities.get(key)
      if (existing && existing !== row.split) failures.push({ identityHash: key, firstSplit: existing, conflictingSplit: row.split, sampleId: row.sampleId })
      else identities.set(key, row.split)
    }
  }
  return failures
}

function buildReviewSnapshot() {
  const files = [
    "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
    "scripts/check-current-world-visual-conditions.mjs",
    "scripts/check-ai-painter-model-training-alignment.mjs",
    "scripts/audit-complete-map-data-sufficiency.mjs",
  ]
  return {
    schemaVersion: "complete-map-review-gate-snapshot-v1",
    createdAtUtc: timestamp,
    files: files.map((file) => snapshotRecord(resolveProjectPath(file))),
    ownerFinalReviewRequired: true,
    machineReviewCannotOverrideOwner: true,
  }
}

function snapshotOptional(sourcePath, destinationPath) {
  if (!sourcePath) return null
  const resolved = resolveProjectPath(sourcePath)
  if (!fs.existsSync(resolved)) return null
  fs.copyFileSync(resolved, destinationPath)
  return snapshotRecord(destinationPath)
}

function snapshotRecord(filePath) {
  const bytes = fs.readFileSync(filePath)
  return { path: projectPath(filePath), sha256: sha256(bytes), bytes: bytes.length }
}

function readRequiredJson(value) {
  const result = readOptionalJson(value)
  assert(result, `required JSON missing: ${value}`)
  return result
}

function readOptionalJson(value) {
  try {
    return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
  } catch {
    return null
  }
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`)
  return resolved
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function projectPath(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
