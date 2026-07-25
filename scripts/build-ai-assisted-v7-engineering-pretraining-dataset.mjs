import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"

const ROOT = process.cwd()
const AUTHORIZATION_ID = "owner-authorized-transform-derived-capacity-suspension-and-sakaerat-engineering-pretrain-20260724"
const OUTPUT_ROOT = path.join(ROOT, "data", "world-samples", "ai-assisted-v7-engineering-pretraining-datasets")
const SOURCE_POINTER_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
const RECLASSIFICATION_POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-capacity-reclassifications/latest.json"
const CAPACITY_POINTER_PATH = ".runtime/ai-painter/ai-assisted-v7-data-capacity-plans/latest.json"
const SAKAERAT_REFERENCE_PATH = "data/world-samples/original-image-library/natural-home-v1/sakaerat-wang-nam-khiao-mvp-reference-v1.json"
const CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7-engineering-26.json"
const TRUSTED_V7_SLOTS = new Set([
  "v7-capacity-slot-001",
  "v7-capacity-slot-002",
  "v7-capacity-slot-003",
  "v7-capacity-slot-033",
  "v7-capacity-slot-034",
])

const createdAtUtc = new Date().toISOString()
const createdAtAsiaShanghai = formatShanghai(createdAtUtc)
const packageId = `ai-assisted-v7-engineering-pretraining-trusted-26-${createdAtUtc.replace(/[:.]/g, "-")}`
const packageDir = path.join(OUTPUT_ROOT, packageId)
const runId = packageId

const sourcePointer = readJson(SOURCE_POINTER_PATH)
const sourceManifest = readJson(sourcePointer.manifestPath)
const sourceIndex = readJson(sourcePointer.sourceIndexPath)
const reclassificationPointer = readJson(RECLASSIFICATION_POINTER_PATH)
const reclassification = readJson(reclassificationPointer.runPath)
const capacityPointer = readJson(CAPACITY_POINTER_PATH)
const capacityPlan = readJson(capacityPointer.capacityPlanPath)
const sakaeratReference = readJson(SAKAERAT_REFERENCE_PATH)
const modelConfig = readJson(CONFIG_PATH)

assert(reclassification.suspendedRecords.length === 17, "expected 17 suspended transform-derived records")
assert(capacityPlan.auditSummary.qualifiedExistingRecordCount === 26, "capacity plan must expose exactly 26 trusted records")
assert(capacityPlan.auditSummary.suspendedHistoricalRecordCount === 17, "capacity plan suspension count mismatch")
assert(capacityPlan.gapSummary.requiredNewRecordCount === 102, "formal V7 gap must remain 102")
assert(sakaeratReference.referenceId === "sakaerat-wang-nam-khiao-mvp-reference-v1", "Sakaerat reference identity mismatch")
assert(modelConfig.training.trainingMode === "nonformal_engineering_pretraining", "engineering model config boundary mismatch")

const suspendedRecordIds = new Set(reclassification.suspendedRecords.map((entry) => entry.recordId))
fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.mkdirSync(packageDir, { recursive: false })

const neutralFocalAreaPath = path.join(packageDir, "shared-conditions", "focal_area.png")
fs.mkdirSync(path.dirname(neutralFocalAreaPath), { recursive: true })
await sharp({
  create: {
    width: 1024,
    height: 768,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
  },
})
  .greyscale()
  .png({ compressionLevel: 9 })
  .toFile(neutralFocalAreaPath)
const neutralFocalAreaProjectPath = projectPath(neutralFocalAreaPath)
const neutralFocalAreaSha256 = sha256File(neutralFocalAreaPath)
const trustedSamples = sourceIndex.samples
  .filter((sample) => sample.categoryId === "complete-maps")
  .filter((sample) => (
    sample.currentConditionIdentityMatches === true
    || TRUSTED_V7_SLOTS.has(sample.v7CapacitySlotId)
  ))
  .filter((sample) => !suspendedRecordIds.has(sample.recordId))
  .map((sample) => validateAndNormalizeSample(sample))
  .sort((left, right) => left.recordId.localeCompare(right.recordId))

assert(trustedSamples.length === 26, `expected 26 trusted engineering samples, received ${trustedSamples.length}`)
assert(new Set(trustedSamples.map((sample) => sample.recordId)).size === 26, "trusted record identities must be unique")
assert(new Set(trustedSamples.map((sample) => sample.conditionWorldId)).size === 26, "trusted condition world identities must be unique")
assert(trustedSamples.filter((sample) => sample.v7CapacitySlotId).length === 5, "trusted V7 contribution count must be 5")
assert(trustedSamples.filter((sample) => sample.currentConditionSource === "complete_map_v2_current_pair").length === 21, "current v2 pair count must be 21")

const splitCounts = countBy(trustedSamples, (sample) => sample.split)
assert(splitCounts.train === 21, "engineering train split must contain 21 samples")
assert(splitCounts.validation === 2, "engineering validation split must contain 2 samples")
assert(splitCounts.challenge === 1, "engineering challenge split must contain 1 sample")
assert(splitCounts.regression === 2, "engineering regression split must contain 2 samples")

const conditionOnlyBlueprints = trustedSamples.map((sample) => ({
  sourceRecordId: sample.recordId,
  worldId: sample.conditionWorldId,
  taskId: sample.taskPackageId,
  conditionLabel: sample.conditionLabel,
  conditionPackPath: sample.conditionPackPath,
  conditionPackSha256: sample.conditionPackSha256,
  channelCount: 23,
  existingRgbBound: true,
  engineeringIdentityMatches: true,
}))

const sourceIndexOutput = {
  schemaVersion: "ai-assisted-cold-start-dataset-source-index-v1",
  policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
  ownerAuthorizationRef: AUTHORIZATION_ID,
  ownerAuthorizationRefs: [AUTHORIZATION_ID],
  packageId,
  dictionaryVersionId: sourceManifest.dictionaryVersionId,
  sampleCount: trustedSamples.length,
  categoryCounts: { "complete-maps": trustedSamples.length },
  samples: trustedSamples,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionOnlyBlueprints,
  currentConditionPairCount: trustedSamples.length,
  currentConditionUnpairedCount: 0,
  currentConditionPairs: trustedSamples.map((sample) => ({
    sampleId: sample.sampleId,
    conditionLabel: sample.conditionLabel,
    worldId: sample.conditionWorldId,
    taskPackageId: sample.taskPackageId,
    conditionPackPath: sample.conditionPackPath,
    conditionPackSha256: sample.conditionPackSha256,
    imageSha256: sample.imageSha256,
  })),
  v7CapacityContributionCount: 5,
  v7CapacityContributions: trustedSamples
    .filter((sample) => sample.v7CapacitySlotId)
    .map((sample) => ({
      sampleId: sample.sampleId,
      capacitySlotId: sample.v7CapacitySlotId,
      split: sample.split,
      conditionLabel: sample.conditionLabel,
      worldId: sample.conditionWorldId,
      taskPackageId: sample.taskPackageId,
      conditionPackPath: sample.conditionPackPath,
      imageSha256: sample.imageSha256,
      contributionPath: sample.v7CapacityContributionPath,
      contributionSha256: sample.v7CapacityContributionSha256,
    })),
  excludedTransformDerivedRecords: reclassification.suspendedRecords.map((entry) => ({
    recordId: entry.recordId,
    capacitySlotId: entry.capacitySlotId,
    imageSha256: entry.imageSha256,
    reason: "owner_suspended_transform_derived_capacity_contribution",
  })),
}

writeJson(path.join(packageDir, "source-index.json"), sourceIndexOutput)
for (const split of ["train", "validation", "challenge", "regression"]) {
  const rows = trustedSamples.filter((sample) => sample.split === split)
  writeJson(path.join(packageDir, "splits", `${split}.json`), {
    schemaVersion: "ai-assisted-cold-start-dataset-split-v1",
    packageId,
    split,
    sampleCount: rows.length,
    samples: rows,
  })
}

const manifest = {
  schemaVersion: "ai-assisted-cold-start-dataset-package-v1",
  policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
  ownerAuthorizationRef: AUTHORIZATION_ID,
  ownerAuthorizationRefs: [AUTHORIZATION_ID],
  packageId,
  parentPackageId: sourceManifest.packageId,
  createdAtUtc,
  createdAtAsiaShanghai,
  status: "nonformal_engineering_pretraining_ready",
  immutable: true,
  trainingLane: "ai_assisted_cold_start",
  engineeringTrainingLane: "v7_trusted_26_nonformal_engineering_pretraining",
  checkpointOwnership: "project_owned_architecture_ai_assisted_cold_start_weights",
  modelConfigId: modelConfig.datasetPackageModelId,
  modelArchitectureVersion: modelConfig.architectureVersion,
  modelConfigPath: CONFIG_PATH,
  dictionaryVersionId: sourceManifest.dictionaryVersionId,
  worldProfileId: sourceManifest.worldProfileId,
  factualReferenceId: sakaeratReference.referenceId,
  sampleCount: 26,
  categoryCounts: { "complete-maps": 26 },
  completeMapCount: 26,
  autoencoderSampleCount: 26,
  conditionBoundCompleteMapCount: 26,
  currentConditionPairCount: 26,
  v7CapacityContributionCount: 5,
  currentConditionUnpairedCount: 0,
  currentConditionExpectedCount: 26,
  conditionOnlyBlueprintCount: 26,
  conditionalFactsBatchId: "trusted-26-engineering-condition-bindings-v1",
  splitCounts,
  trainingGateStatus: {
    engineeringPretrainingAuthorized: true,
    formalV7TrainingAuthorized: false,
    transformDerivedRecordsExcluded: true,
    trustedRecordCountVerified: true,
  },
  connectivityCoverage: sourceManifest.connectivityCoverage,
  readinessContract: {
    conditionalDenoiser: "trusted_26_nonformal_engineering_pretraining_only",
    formalInference: "forbidden",
    formalV7CapacityContribution: "unchanged_26_of_128",
    rgbGeneration: "forbidden",
  },
  canStartAutoencoderWarmup: false,
  canTrainConditionalDenoiser: true,
  canStartFormalTraining: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  formalV7CapacityCount: 26,
  formalV7RequiredNewCount: 102,
  blockers: [],
  thirdPartyWeightsLoaded: false,
  thirdPartyGeneratedTrainingOutputUsed: true,
  aiGenerationDependencyDeclared: true,
  sourceIndexPath: projectPath(path.join(packageDir, "source-index.json")),
  sourceEvidence: {
    sourceManifestPath: sourcePointer.manifestPath,
    sourceManifestSha256: sha256File(sourcePointer.manifestPath),
    reclassificationPath: reclassificationPointer.runPath,
    reclassificationSha256: sha256File(reclassificationPointer.runPath),
    capacityPlanPath: capacityPointer.capacityPlanPath,
    capacityPlanSha256: sha256File(capacityPointer.capacityPlanPath),
    sakaeratReferencePath: SAKAERAT_REFERENCE_PATH,
    sakaeratReferenceSha256: sha256File(SAKAERAT_REFERENCE_PATH),
  },
  executionBoundary: {
    imagesGenerated: 0,
    imageGenerationStarted: false,
    gpuTrainingStartedByDatasetBuild: false,
    formalTrainingAuthorized: false,
  },
  automaticStorage: true,
}

const manifestPath = path.join(packageDir, "manifest.json")
writeJson(manifestPath, manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "ai-assisted-v7-engineering-pretraining-dataset-latest-v1",
  packageId,
  status: manifest.status,
  createdAtUtc,
  createdAtAsiaShanghai,
  manifestPath: projectPath(manifestPath),
  manifestSha256: sha256File(manifestPath),
  sourceIndexPath: manifest.sourceIndexPath,
  sampleCount: 26,
  splitCounts,
  formalInferenceEligible: false,
  formalV7TrainingAuthorized: false,
})

indexArtifactTree(packageDir)
appendAiPainterProgramEvent({
  status: "success",
  stage: "ai_assisted_v7_engineering_pretraining_dataset",
  action: "build_trusted_26_engineering_pretraining_dataset",
  runId,
  titleZh: "26张可信完整地图工程预训练数据包已由程序建立",
  titleEn: "The program built the trusted 26-map engineering pretraining dataset",
  summaryZh: "21张当前条件配对与5张独立V7容量记录通过图片、审核、23通道、hash和split检查；17条变换派生记录已排除。程序为工程数据包生成全零focal_area兼容通道，没有生成RGB，没有启动GPU训练，正式V7缺口仍为102张。",
  summaryEn: "Twenty-one current condition pairs and five independent V7 capacity records passed image, review, 23-channel, hash, and split checks. Seventeen transform-derived records were excluded. No images or GPU training were started; the formal V7 gap remains 102.",
  evidence: [projectPath(manifestPath), manifest.sourceIndexPath],
  evidencePath: projectPath(manifestPath),
  evidenceSha256: sha256File(manifestPath),
})

console.log(JSON.stringify({
  status: manifest.status,
  packageId,
  manifestPath: projectPath(manifestPath),
  manifestSha256: sha256File(manifestPath),
  sampleCount: 26,
  splitCounts,
  excludedTransformDerivedRecordCount: 17,
  formalV7RequiredNewCount: 102,
  imagesGenerated: 0,
  gpuTrainingStarted: false,
}, null, 2))

function validateAndNormalizeSample(sample) {
  assert(sample.formalConditionalTrainingEligible === true, `conditional eligibility missing: ${sample.recordId}`)
  assert(sample.conditionBound === true, `condition binding missing: ${sample.recordId}`)
  assert(sample.ownerReviewStatus === "owner_approved", `owner review missing: ${sample.recordId}`)
  assert(sample.machineReviewStatus === "passed", `machine review missing: ${sample.recordId}`)
  assert(sample.aiAssistedColdStartEligible === true, `AI cold-start eligibility missing: ${sample.recordId}`)
  assert(sample.independentTrainingEligible === false, `independent lane contamination: ${sample.recordId}`)
  assert(sample.width === 1024 && sample.height === 768, `native image size invalid: ${sample.recordId}`)
  assert(Array.isArray(sample.trainingRoles) && sample.trainingRoles.includes("conditional_denoiser"), `conditional training role missing: ${sample.recordId}`)

  verifyFileHash(sample.imagePath, sample.imageSha256, `image hash mismatch: ${sample.recordId}`)
  verifyFileHash(sample.sourceRecordPath, sample.sourceRecordSha256, `source record hash mismatch: ${sample.recordId}`)
  verifyFileHash(sample.machineReviewPath, sample.machineReviewSha256, `machine review hash mismatch: ${sample.recordId}`)
  verifyFileHash(sample.ownerReviewPath, sample.ownerReviewSha256, `owner review hash mismatch: ${sample.recordId}`)

  const imageSize = readPngSize(resolveProjectPath(sample.imagePath))
  assert(imageSize.width === 1024 && imageSize.height === 768, `PNG dimensions invalid: ${sample.recordId}`)

  const conditionPack = readJson(sample.conditionPackPath)
  assert(conditionPack.channels.length === 23, `23-channel contract invalid: ${sample.recordId}`)
  assert(new Set(conditionPack.channels.map((channel) => channel.id)).size === 23, `condition channel identity duplicate: ${sample.recordId}`)
  for (const channel of conditionPack.channels) {
    verifyFileHash(channel.path, channel.sha256, `condition channel hash mismatch: ${sample.recordId}/${channel.id}`)
  }
  const focalArea = conditionPack.channels.find((channel) => channel.id === "focal_area")
  assert(focalArea, `focal_area compatibility channel missing: ${sample.recordId}`)

  const engineeringConditionPack = structuredClone(conditionPack)
  const engineeringFocalArea = engineeringConditionPack.channels.find((channel) => channel.id === "focal_area")
  engineeringFocalArea.path = neutralFocalAreaProjectPath
  engineeringFocalArea.sha256 = neutralFocalAreaSha256
  engineeringFocalArea.statistics = {
    minimum: 0,
    maximum: 0,
    nonZeroCount: 0,
    nonZeroRatio: 0,
    distinctValueCount: 1,
  }
  engineeringFocalArea.semantics = "Inactive all-zero compatibility channel. It must not encode a home site, activity center, construction clearing, or road convergence."
  engineeringFocalArea.derivation = "owner_locked_engineering_neutralization_without_historical_source_mutation"
  engineeringFocalArea.sourceRefs = [
    "owner-locked-initial-world-no-preset-home-site-20260723",
    `historical-source-condition-pack:${sample.conditionPackPath}`,
  ]
  engineeringConditionPack.engineeringPretraining = {
    authorizationId: AUTHORIZATION_ID,
    sourceConditionPackPath: sample.conditionPackPath,
    sourceConditionPackSha256: sha256File(sample.conditionPackPath),
    focalAreaSourceNonZeroCount: focalArea.statistics?.nonZeroCount ?? null,
    focalAreaNeutralized: true,
    historicalSourceMutated: false,
    formalV7TrainingAuthorized: false,
  }
  const engineeringConditionPackPath = path.join(
    packageDir,
    "conditions",
    sample.recordId,
    "condition-pack.json",
  )
  writeJson(engineeringConditionPackPath, engineeringConditionPack)

  const sourceCurrentConditionIdentityMatches = sample.currentConditionIdentityMatches === true
  return {
    ...sample,
    currentConditionIdentityMatches: true,
    sourceCurrentConditionIdentityMatches,
    currentConditionSource: sourceCurrentConditionIdentityMatches
      ? "complete_map_v2_current_pair"
      : "independent_v7_capacity_contribution",
    engineeringConditionIdentityMatches: true,
    engineeringPackageAuthorizationId: AUTHORIZATION_ID,
    sourceConditionPackPath: sample.conditionPackPath,
    sourceConditionPackSha256: sha256File(sample.conditionPackPath),
    conditionPackPath: projectPath(engineeringConditionPackPath),
    conditionPackSha256: sha256File(engineeringConditionPackPath),
    sourceFocalAreaNonZeroCount: focalArea.statistics?.nonZeroCount ?? null,
    focalAreaCompatibilityChannelActive: false,
    formalInferenceEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  }
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project: ${value}`)
  assert(fs.existsSync(resolved), `required file is missing: ${value}`)
  return resolved
}

function verifyFileHash(value, expected, message) {
  assert(sha256File(value) === expected, message)
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveProjectPath(value))).digest("hex")
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath)
  assert(buffer.subarray(1, 4).toString("ascii") === "PNG", `not a PNG: ${projectPath(filePath)}`)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function indexArtifactTree(rootPath) {
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const childPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) indexArtifactTree(childPath)
    else if (entry.isFile()) {
      const info = fs.statSync(childPath)
      indexArtifact({
        logicalPath: projectPath(childPath),
        physicalUri: fs.realpathSync(childPath),
        storageLayer: "hot",
        runId,
        byteSize: info.size,
        modifiedAtUtc: info.mtime.toISOString(),
        sha256: sha256File(childPath),
      })
    }
  }
}

function countBy(values, selector) {
  return values.reduce((result, value) => {
    const key = selector(value)
    result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
