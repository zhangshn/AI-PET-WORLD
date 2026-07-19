import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const POLICY_VERSION = "owner-authorized-ai-assisted-cold-start-v1"
const OWNER_AUTHORIZATION_REF = "conversation-owner-authorization-2026-07-13"
const WORLD_PROFILE_ID = "mainland-southeast-asia-tropical-monsoon-natural-home-v1"
const OUTPUT_ROOT = path.join(ROOT, "data", "world-samples", "ai-assisted-cold-start-dataset-packages")
const INDEX_PATH = "data/world-samples/original-image-library/natural-home-v1/index.json"
const CONFIG_PATH = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v2.json"
const modelConfig = readRequiredJson(CONFIG_PATH)
const dictionaryPointer = readRequiredJson("data/world-visual-data-dictionary/latest.json")
const index = readRequiredJson(INDEX_PATH)
const conditionalFactsPointer = readRequiredJson(".runtime/ai-painter/ai-assisted-conditional-world-facts/latest.json")
const conditionalFactsManifest = readRequiredJson(conditionalFactsPointer.manifestPath)
const trainingGateApprovalPointer = readOptionalJson(".runtime/ai-painter/ai-assisted-training-gate-owner-approvals/latest.json")
const connectivityCoverageBlueprint = readRequiredJson("data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json")
const connectivityCoverage = connectivityCoverageBlueprint.connectivityCoverage
const connectivityContract = readRequiredJson("data/world-samples/world-connectivity/world-connectivity-contract-v1.json")
const connectivityCoveragePointer = readOptionalJson("data/world-samples/world-connectivity/coverage/latest.json")
const connectivityCoverageManifest = connectivityCoveragePointer?.manifestPath
  ? readOptionalJson(connectivityCoveragePointer.manifestPath)
  : null
const currentConditionRows = conditionalFactsManifest.rows ?? []
const currentConditionByWorldId = new Map(currentConditionRows.map((row) => [row.worldId, row]))
const timestamp = new Date().toISOString()
const packageId = `natural-home-ai-assisted-cold-start-${dictionaryPointer.dictionaryVersionId}-${timestamp.replace(/[:.]/g, "-")}`
const packageDir = path.join(OUTPUT_ROOT, packageId)

const eligibleRecords = (index.records ?? [])
  .filter((record) => record.status === "ai_assisted_cold_start_eligible")
  .sort((left, right) => left.recordId.localeCompare(right.recordId))

assert(eligibleRecords.length > 0, "no owner-approved AI-assisted cold-start records")
assert(currentConditionRows.length === 21, `expected 21 current condition rows, got ${currentConditionRows.length}`)
assert(currentConditionByWorldId.size === currentConditionRows.length, "current condition world identities must be unique")
fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
fs.mkdirSync(packageDir, { recursive: false })

const completeMaps = eligibleRecords.filter((record) => record.categoryId === "complete-maps")
const completeMapSplits = new Map(completeMaps.map((record, indexValue) => [record.recordId, splitForIndex(indexValue)]))
const samples = eligibleRecords.map((summary) => buildSample(summary, completeMapSplits.get(summary.recordId) ?? "knowledge"))
const autoencoderSamples = samples.filter((sample) => sample.trainingRoles.includes("rgb_autoencoder_warmup"))
const conditionBoundSamples = samples.filter((sample) => sample.trainingRoles.includes("conditional_denoiser"))
const pairedWorldIds = new Set(conditionBoundSamples.map((sample) => sample.conditionWorldId))
const unpairedConditionRows = currentConditionRows.filter((row) => !pairedWorldIds.has(row.worldId))
assert(pairedWorldIds.size === conditionBoundSamples.length, "current condition RGB pairs must have unique world identities")
const conditionOnlyBlueprints = (conditionalFactsManifest.rows ?? []).map((row) => ({
  sourceRecordId: row.sourceRecordId,
  worldId: row.worldId,
  taskId: row.taskId,
  targetRegionalLandscapeType: row.targetRegionalLandscapeType,
  snapshotId: row.snapshotId,
  blueprintPath: row.blueprintPath,
  blueprintSha256: row.blueprintSha256,
  directorOutputPath: row.directorOutputPath,
  directorOutputSha256: row.directorOutputSha256,
  taskPackagePath: row.taskPackagePath,
  taskPackageSha256: row.taskPackageSha256,
  conditionPackPath: row.conditionPackPath,
  conditionPackSha256: row.conditionPackSha256,
  conditionPackFileSha256: sha256(fs.readFileSync(resolveProjectPath(row.conditionPackPath))),
  channelCount: row.channelCount,
  existingRgbBound: false,
  needsNewRgbPair: true,
}))
assert(conditionalFactsManifest.sourceImageGeometryRead === false, "conditional facts must not be inferred from RGB")
assert(conditionalFactsManifest.existingRgbBoundToGeneratedConditions === false, "existing RGB must remain unbound")
assert(conditionOnlyBlueprints.length === 21, `expected 21 condition-only blueprints, got ${conditionOnlyBlueprints.length}`)
const categoryCounts = countBy(samples, (sample) => sample.categoryId)
const splitCounts = countBy(autoencoderSamples, (sample) => sample.split)
const conditionalThreshold = trainingGateApprovalPointer?.approvals?.conditionalDenoiserThreshold
const autoencoderVisualReview = trainingGateApprovalPointer?.approvals?.autoencoderV2VisualReview
const connectivityThreshold = trainingGateApprovalPointer?.approvals?.worldConnectivityCoverageThreshold
const conditionalThresholdApproved = conditionalThreshold?.decision === "approved"
  && conditionBoundSamples.length >= conditionalThreshold.minimumCurrentConditionPairCount
const autoencoderVisualApproved = autoencoderVisualReview?.decision === "approved"
const connectivityThresholdApproved = connectivityThreshold?.decision === "approved"
  && connectivityCoverage?.minimumThresholdStatus === "owner_approved"
const connectivityCoverageEvidenceValid = validateConnectivityCoverageEvidence()
const connectivityCoverageMet = connectivityThresholdApproved
  && connectivityCoverage?.thresholdMet === true
  && connectivityCoverageEvidenceValid
const blockers = [
  ...(conditionBoundSamples.length === 0 ? ["condition_bound_complete_map_samples_missing"] : []),
  ...(unpairedConditionRows.length > 0 ? ["condition_blueprints_require_new_rgb_pairs"] : []),
  ...(!conditionalThresholdApproved ? ["ai_assisted_conditional_training_threshold_pending_owner_approval"] : []),
  ...(!autoencoderVisualApproved ? ["ai_assisted_autoencoder_v2_visual_review_pending_owner_approval"] : []),
  ...(!connectivityThresholdApproved ? ["world_connectivity_coverage_thresholds_pending"] : []),
  ...(connectivityThresholdApproved && connectivityCoverage?.thresholdMet === true && !connectivityCoverageEvidenceValid
    ? ["world_connectivity_coverage_evidence_invalid"]
    : []),
  ...(connectivityThresholdApproved && !connectivityCoverageMet ? (connectivityCoverage.remainingBlockers ?? ["world_connectivity_coverage_insufficient"]) : []),
]
const canTrainConditionalDenoiser = blockers.length === 0
const packageStatus = canTrainConditionalDenoiser
  ? "conditional_denoiser_training_ready"
  : unpairedConditionRows.length === 0 && conditionalThresholdApproved && autoencoderVisualApproved && connectivityThresholdApproved
    ? "conditional_rgb_pairs_complete_owner_gates_approved_connectivity_coverage_insufficient"
    : unpairedConditionRows.length === 0
      ? "conditional_rgb_pairs_complete_owner_gates_pending"
      : "autoencoder_warmup_ready_condition_blueprints_ready_rgb_pairing_blocked"

const sourceIndex = {
  schemaVersion: "ai-assisted-cold-start-dataset-source-index-v1",
  policyVersion: POLICY_VERSION,
  ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
  packageId,
  dictionaryVersionId: dictionaryPointer.dictionaryVersionId,
  sampleCount: samples.length,
  categoryCounts,
  samples,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionOnlyBlueprints,
  currentConditionPairCount: conditionBoundSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  currentConditionPairs: conditionBoundSamples.map((sample) => ({
    sampleId: sample.sampleId,
    conditionLabel: sample.conditionLabel,
    worldId: sample.conditionWorldId,
    taskPackageId: sample.taskPackageId,
    conditionPackPath: sample.conditionPackPath,
    imageSha256: sample.imageSha256,
  })),
}
writeJson(path.join(packageDir, "source-index.json"), sourceIndex)

for (const split of ["train", "validation", "challenge", "regression", "knowledge"]) {
  const rows = samples.filter((sample) => sample.split === split)
  writeJson(path.join(packageDir, "splits", `${split}.json`), {
    schemaVersion: "ai-assisted-cold-start-dataset-split-v1",
    packageId,
    split,
    sampleCount: rows.length,
    samples: rows,
  })
}

const snapshots = snapshotInputs(packageDir)
const manifest = {
  schemaVersion: "ai-assisted-cold-start-dataset-package-v1",
  policyVersion: POLICY_VERSION,
  ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
  packageId,
  parentPackageId: readOptionalJson(path.join(OUTPUT_ROOT, "latest.json"))?.packageId ?? null,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  status: packageStatus,
  immutable: true,
  trainingLane: "ai_assisted_cold_start",
  checkpointOwnership: "project_owned_architecture_ai_assisted_cold_start_weights",
  modelConfigId: modelConfig.modelId,
  modelArchitectureVersion: modelConfig.architectureVersion,
  modelConfigPath: CONFIG_PATH,
  dictionaryVersionId: dictionaryPointer.dictionaryVersionId,
  worldProfileId: WORLD_PROFILE_ID,
  sampleCount: samples.length,
  categoryCounts,
  completeMapCount: completeMaps.length,
  autoencoderSampleCount: autoencoderSamples.length,
  conditionBoundCompleteMapCount: conditionBoundSamples.length,
  currentConditionPairCount: conditionBoundSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  currentConditionExpectedCount: currentConditionRows.length,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionalFactsBatchId: conditionalFactsManifest.batchId,
  conditionalFactsManifestPath: conditionalFactsPointer.manifestPath,
  conditionalFactsManifestSha256: sha256(fs.readFileSync(resolveProjectPath(conditionalFactsPointer.manifestPath))),
  trainingGateApprovalId: trainingGateApprovalPointer?.approvalId ?? null,
  trainingGateApprovalPath: trainingGateApprovalPointer?.approvalPath ?? null,
  trainingGateApprovalSha256: trainingGateApprovalPointer?.approvalSha256 ?? null,
  trainingGateStatus: {
    conditionalThresholdApproved,
    autoencoderVisualApproved,
    connectivityThresholdApproved,
    connectivityCoverageMet,
  },
  connectivityCoverage: {
    minimumPositiveRecordCount: connectivityCoverage?.minimumPositiveRecordCount ?? null,
    minimumNegativeRecordCount: connectivityCoverage?.minimumNegativeRecordCount ?? null,
    minimumPositivePerAxis: connectivityCoverage?.minimumPositivePerAxis ?? null,
    minimumNegativePerAxis: connectivityCoverage?.minimumNegativePerAxis ?? null,
    currentPositiveRecordCount: connectivityCoverage?.currentPositiveRecordCount ?? 0,
    currentNegativeRecordCount: connectivityCoverage?.currentNegativeRecordCount ?? 0,
    axisCounts: connectivityCoverage?.axisCounts ?? {},
    thresholdMet: connectivityCoverageMet,
    evidenceValid: connectivityCoverageEvidenceValid,
    datasetId: connectivityCoverageManifest?.datasetId ?? null,
    manifestPath: connectivityCoveragePointer?.manifestPath ?? null,
    manifestSha256: connectivityCoveragePointer?.manifestSha256 ?? null,
  },
  splitCounts,
  readinessContract: {
    autoencoderWarmup: "nonempty_owner_approved_rgb_technical_gate_only",
    conditionalDenoiser: "owner_approved_threshold_and_per_image_23_channel_binding_required",
    conditionOnlyBlueprints: "must_receive_new_rgb_generated_after_the_condition_pack; existing_rgb_rebinding_forbidden",
    formalInference: "conditional_checkpoint_and_all_formal_gates_required",
    inventedThresholdsAllowed: false,
  },
  canStartAutoencoderWarmup: autoencoderSamples.length > 0,
  canTrainConditionalDenoiser,
  canStartFormalTraining: false,
  formalInferenceEligible: false,
  blockers,
  thirdPartyWeightsLoaded: false,
  thirdPartyGeneratedTrainingOutputUsed: true,
  aiGenerationDependencyDeclared: true,
  sourceIndexPath: projectPath(path.join(packageDir, "source-index.json")),
  snapshots,
  automaticStorage: true,
}
writeJson(path.join(packageDir, "manifest.json"), manifest)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "ai-assisted-cold-start-dataset-package-latest-v1",
  packageId,
  status: manifest.status,
  createdAtUtc: timestamp,
  manifestPath: projectPath(path.join(packageDir, "manifest.json")),
  sourceIndexPath: manifest.sourceIndexPath,
  sampleCount: samples.length,
  autoencoderSampleCount: autoencoderSamples.length,
  conditionBoundCompleteMapCount: conditionBoundSamples.length,
  currentConditionPairCount: conditionBoundSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  conditionOnlyBlueprintCount: conditionOnlyBlueprints.length,
  conditionalFactsBatchId: conditionalFactsManifest.batchId,
  canStartAutoencoderWarmup: manifest.canStartAutoencoderWarmup,
  canTrainConditionalDenoiser: manifest.canTrainConditionalDenoiser,
})

console.log(JSON.stringify({
  status: manifest.status,
  packageId,
  packagePath: projectPath(packageDir),
  sampleCount: samples.length,
  categoryCounts,
  autoencoderSampleCount: autoencoderSamples.length,
  conditionBoundCompleteMapCount: conditionBoundSamples.length,
  currentConditionPairCount: conditionBoundSamples.length,
  currentConditionUnpairedCount: unpairedConditionRows.length,
  splitCounts,
  blockers,
}, null, 2))

function buildSample(summary, split) {
  const record = readRequiredJson(summary.recordPath)
  assert(record.recordId === summary.recordId, `record identity mismatch: ${summary.recordId}`)
  assert(record.status === "ai_assisted_cold_start_eligible", `record is not eligible: ${summary.recordId}`)
  assert(record.aiAssistedColdStartEligible === true, `AI cold-start eligibility missing: ${summary.recordId}`)
  assert(record.independentTrainingEligible === false, `independent lane contamination: ${summary.recordId}`)
  assert(record.aiAssistedColdStart?.policyVersion === POLICY_VERSION, `policy mismatch: ${summary.recordId}`)
  assert(record.aiAssistedColdStart?.ownerAuthorizationRef === OWNER_AUTHORIZATION_REF, `owner authorization mismatch: ${summary.recordId}`)
  assert(record.aiAssistedColdStart?.trainingLane === "ai_assisted_cold_start", `training lane mismatch: ${summary.recordId}`)
  assert(record.source?.thirdPartyContentUsed === false, `third-party content present: ${summary.recordId}`)
  assert(record.source?.thirdPartyGenerativeModelUsed === true, `AI generation dependency missing: ${summary.recordId}`)
  assert(record.source?.copiedFromExistingWork === false, `copied work present: ${summary.recordId}`)
  assert(record.worldBinding?.worldProfileId === WORLD_PROFILE_ID, `world profile mismatch: ${summary.recordId}`)
  assert(record.reviews?.ownerReviewStatus === "owner_approved", `owner review missing: ${summary.recordId}`)
  assert(record.reviews?.machineReviewStatus === "machine_contract_passed_waiting_owner_visual_review", `machine review missing: ${summary.recordId}`)
  assert(record.gameUseContract?.directWorldDisplayAllowed === false, `direct world display must be blocked: ${summary.recordId}`)
  assert(record.gameUseContract?.directRuntimeFrameUseAllowed === false, `direct RuntimeFrame use must be blocked: ${summary.recordId}`)
  assert(record.originalImage?.width === 1024 && record.originalImage?.height === 768, `native image size invalid: ${summary.recordId}`)

  const sourceImagePath = resolveProjectPath(path.join(record.relativeDirectory, record.originalImage.path))
  verifyHash(sourceImagePath, record.originalImage.sha256, `image hash mismatch: ${summary.recordId}`)
  const promptPath = resolveProjectPath(record.aiAssistedColdStart.promptEvidencePath)
  verifyHash(promptPath, record.aiAssistedColdStart.promptEvidenceSha256, `prompt hash mismatch: ${summary.recordId}`)
  const machineReviewPath = resolveProjectPath(record.reviews.machineReviewPath)
  const ownerReviewPath = resolveProjectPath(record.reviews.ownerReviewPath)
  const machineReview = readRequiredJson(machineReviewPath)
  const ownerReview = readRequiredJson(ownerReviewPath)
  assert(machineReview.passed === true && machineReview.imageSha256 === record.originalImage.sha256, `machine review invalid: ${summary.recordId}`)
  assert(ownerReview.decision === "owner_approved" && ownerReview.imageSha256 === record.originalImage.sha256, `owner review invalid: ${summary.recordId}`)

  const packageImagePath = path.join(packageDir, "images", record.categoryId, `${record.recordId}.png`)
  fs.mkdirSync(path.dirname(packageImagePath), { recursive: true })
  fs.copyFileSync(sourceImagePath, packageImagePath)
  verifyHash(packageImagePath, record.originalImage.sha256, `packaged image hash mismatch: ${summary.recordId}`)

  const conditionPackPath = record.worldBinding?.conditionPackPath ?? null
  const conditionWorldId = record.conditionBinding?.worldId ?? record.worldBinding?.worldId ?? null
  const currentConditionRow = conditionWorldId ? currentConditionByWorldId.get(conditionWorldId) : null
  const conditionReferencePresent = record.categoryId === "complete-maps"
    && Boolean(record.worldBinding?.taskPackageId)
    && Boolean(conditionPackPath)
    && fs.existsSync(conditionPackPath ? resolveProjectPath(conditionPackPath) : "")
  const currentConditionIdentityMatches = Boolean(currentConditionRow)
    && record.worldBinding?.taskPackageId === currentConditionRow.taskId
    && conditionPackPath === currentConditionRow.conditionPackPath
  const conditionBound = conditionReferencePresent
    && currentConditionIdentityMatches
    && record.conditionBinding?.formalConditionalTrainingEligible === true
    && machineReview.semanticConditionAudit?.passed === true
  const trainingRoles = []
  if (record.categoryId === "complete-maps") trainingRoles.push("rgb_autoencoder_warmup")
  else trainingRoles.push("visual_knowledge_reference")
  if (conditionBound) trainingRoles.push("conditional_denoiser")

  return {
    sampleId: record.recordId,
    recordId: record.recordId,
    title: record.title,
    categoryId: record.categoryId,
    split,
    trainingRoles,
    imagePath: projectPath(packageImagePath),
    imageSha256: record.originalImage.sha256,
    width: 1024,
    height: 768,
    sourceRecordPath: record.recordPath,
    sourceRecordSha256: sha256(fs.readFileSync(resolveProjectPath(record.recordPath))),
    promptEvidencePath: record.aiAssistedColdStart.promptEvidencePath,
    promptEvidenceSha256: record.aiAssistedColdStart.promptEvidenceSha256,
    machineReviewPath: record.reviews.machineReviewPath,
    machineReviewSha256: sha256(fs.readFileSync(machineReviewPath)),
    ownerReviewPath: record.reviews.ownerReviewPath,
    ownerReviewSha256: sha256(fs.readFileSync(ownerReviewPath)),
    ownerReviewStatus: "owner_approved",
    machineReviewStatus: "passed",
    worldProfileId: record.worldBinding.worldProfileId,
    snapshotId: record.worldBinding.snapshotId,
    classification: record.classification,
    taskPackageId: record.worldBinding?.taskPackageId ?? null,
    conditionPackPath,
    conditionLabel: currentConditionRow?.conditionLabel ?? null,
    conditionWorldId,
    conditionGenerationContractVersion: currentConditionRow?.generationContractVersion ?? null,
    currentConditionIdentityMatches,
    conditionReferencePresent,
    conditionBindingStatus: record.conditionBinding?.status ?? null,
    formalConditionalTrainingEligible: record.conditionBinding?.formalConditionalTrainingEligible === true,
    conditionBound,
    connectivityBinding: record.worldBinding?.connectivityBinding ?? null,
    policyVersion: POLICY_VERSION,
    ownerAuthorizationRef: OWNER_AUTHORIZATION_REF,
    independentTrainingEligible: false,
    aiAssistedColdStartEligible: true,
    thirdPartyWeightsLoaded: false,
    thirdPartyGeneratedTrainingOutputUsed: true,
    directWorldDisplayAllowed: false,
    directRuntimeFrameUseAllowed: false,
  }
}

function snapshotInputs(destinationRoot) {
  const sources = {
    originalImageIndex: INDEX_PATH,
    dictionary: dictionaryPointer.dictionaryPath,
    trainingDataPolicy: "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
    modelConfig: CONFIG_PATH,
    conditionalWorldFacts: conditionalFactsPointer.manifestPath,
    ...(trainingGateApprovalPointer?.approvalPath ? { trainingGateApproval: trainingGateApprovalPointer.approvalPath } : {}),
    connectivityCoverage: "data/world-samples/original-image-library/natural-home-v1/coverage-blueprint.json",
    connectivityCoverageManifest: connectivityCoveragePointer?.manifestPath,
  }
  const result = {}
  for (const [id, source] of Object.entries(sources).filter(([, source]) => Boolean(source))) {
    const sourcePath = resolveProjectPath(source)
    const destination = path.join(destinationRoot, "snapshots", `${id}${path.extname(sourcePath) || ".json"}`)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(sourcePath, destination)
    result[id] = { path: projectPath(destination), sha256: sha256(fs.readFileSync(destination)) }
  }
  return result
}

function validateConnectivityCoverageEvidence() {
  if (!connectivityCoveragePointer || !connectivityCoverageManifest) return false
  const manifestPath = connectivityCoveragePointer.manifestPath
  if (!manifestPath || !fs.existsSync(resolveProjectPath(manifestPath))) return false
  if (connectivityCoveragePointer.manifestSha256 !== sha256(fs.readFileSync(resolveProjectPath(manifestPath)))) return false
  if (connectivityCoverageManifest.schemaVersion !== "world-connectivity-coverage-dataset-v1") return false
  if (connectivityCoverageManifest.status !== "machine_verified_threshold_met") return false
  if (connectivityCoverageManifest.thresholdMet !== true) return false
  if (connectivityCoverageManifest.positiveRecordCount < connectivityThreshold.minimumPositiveRecordCount) return false
  if (connectivityCoverageManifest.negativeRecordCount < connectivityThreshold.minimumNegativeRecordCount) return false
  const axes = connectivityContract.trainingCoverageAxes ?? []
  if (axes.length !== 9) return false
  return axes.every((axis) => connectivityCoverageManifest.axisCounts?.[axis]?.positive >= connectivityThreshold.minimumPositivePerAxis
    && connectivityCoverageManifest.axisCounts?.[axis]?.negative >= connectivityThreshold.minimumNegativePerAxis)
}

function splitForIndex(indexValue) {
  const bucket = indexValue % 10
  if (bucket <= 6) return "train"
  if (bucket === 7) return "validation"
  if (bucket === 8) return "challenge"
  return "regression"
}

function countBy(rows, selector) {
  const counts = {}
  for (const row of rows) {
    const key = selector(row)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function verifyHash(filePath, expected, message) {
  assert(fs.existsSync(filePath), `file missing: ${projectPath(filePath)}`)
  assert(sha256(fs.readFileSync(filePath)) === expected, message)
}

function readRequiredJson(value) {
  const result = readOptionalJson(value)
  assert(result, `required JSON missing: ${value}`)
  return result
}

function readOptionalJson(value) {
  try { return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8")) } catch { return null }
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

function projectPath(filePath) { return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, "/") }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
