import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { isOwnerAuthorizedAiAssistedColdStartRef } from "./lib/original-image-library-contract.mjs"

const ROOT = process.cwd()
const COLLECTION_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const COVERAGE_BLUEPRINT_PATH = path.join(COLLECTION_ROOT, "coverage-blueprint.json")
const REBUILD64_SEQUENCE_REGISTRY_PATH = path.join(
  ROOT,
  "data",
  "ai-painter",
  "system-governance",
  "thailand-rebuild64-sequence-registry-v1.json",
)
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "ai-assisted-cold-start", "candidates")
const CODEX_GENERATED_ROOT = path.resolve(process.env.USERPROFILE ?? "", ".codex", "generated_images")
const TEMP_ROOT = path.resolve(process.env.LOCALAPPDATA ?? "", "Temp")
const inputArg = argumentValue("--input")
const promptArg = argumentValue("--prompt-evidence")
const recordId = argumentValue("--record-id")
const title = argumentValue("--title")
const categoryId = argumentValue("--category-id") ?? "complete-maps"
const regionalLandscapeType = argumentValue("--regional-landscape-type")
const taskArg = argumentValue("--task-package")
const conditionArg = argumentValue("--condition-pack")
const guideManifestArg = argumentValue("--condition-guide-manifest")
const COLD_START_DERIVATIVE_POLICY = "owner-approved-high-resolution-four-three-derivative-v1"
const THAILAND_REBUILD64_BATCH_AUTHORIZATION_ID =
  "owner-authorized-thailand-rebuild64-complete-batch-generation-20260731"
const THAILAND_REBUILD64_REMAINING63_AUTHORIZATION_ID =
  "owner-authorized-thailand-rebuild64-remaining63-full-world-rgb-generation-20260801"
const THAILAND_REBUILD64_FAILED8_REPLACEMENT_AUTHORIZATION_ID =
  "owner-authorized-thailand-rebuild64-failed8-rgb-replacements-20260801"
const THAILAND_REBUILD64_CROSS_MODAL_REPLACEMENT_AUTHORIZATION_ID =
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-20260801"
const THAILAND_REBUILD64_FAILED8_CAPACITY_SLOTS = new Set([
  "v7-capacity-slot-168",
  "v7-capacity-slot-178",
  "v7-capacity-slot-184",
  "v7-capacity-slot-188",
  "v7-capacity-slot-190",
  "v7-capacity-slot-192",
  "v7-capacity-slot-194",
  "v7-capacity-slot-200",
])
const TRAINING_WIDTH = 1024
const TRAINING_HEIGHT = 768

assert(inputArg && promptArg && recordId && title, "usage: npm run intake:ai-assisted-cold-start-image -- --input <generated.png> --prompt-evidence <prompt.json> --record-id <id> --title <title> [--category-id <category>] [--regional-landscape-type <type-id>]")
assert(/^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "record-id is invalid")
const library = readJson(path.join(COLLECTION_ROOT, "library.json"))
const allowedCategoryIds = new Set(library.categories.map((item) => item.id))
assert(allowedCategoryIds.has(categoryId), `category is not defined by the original image library: ${categoryId}`)
const coverageBlueprint = readJson(COVERAGE_BLUEPRINT_PATH)
const allowedRegionalLandscapeTypes = new Set(coverageBlueprint.regionalLandscapeTypes.map((item) => item.typeId))
if (categoryId === "complete-maps") assert(allowedRegionalLandscapeTypes.has(regionalLandscapeType), `regional landscape type is not defined by the coverage blueprint: ${regionalLandscapeType}`)

const inputPath = path.resolve(inputArg)
assert(isWithin(CODEX_GENERATED_ROOT, inputPath) || isWithin(TEMP_ROOT, inputPath) || isWithin(ROOT, inputPath), "input image is outside an allowed generated-image source root")
assert(fs.existsSync(inputPath) && fs.statSync(inputPath).isFile(), "generated input image is missing")
const promptPath = resolveProjectPath(promptArg)
assert(fs.existsSync(promptPath) && fs.statSync(promptPath).isFile(), "prompt evidence is missing")
const promptEvidence = readJson(promptPath)
assert(promptEvidence.policyVersion === "owner-authorized-ai-assisted-cold-start-v1", "prompt evidence policy is invalid")
assert(isOwnerAuthorizedAiAssistedColdStartRef(promptEvidence.ownerAuthorizationRef), "prompt evidence owner authorization is invalid")
assert((promptEvidence.targetCategoryId ?? "complete-maps") === categoryId, "prompt evidence category mismatch")
if (categoryId === "complete-maps") assert(promptEvidence.targetRegionalLandscapeType === regionalLandscapeType, "prompt evidence regional landscape type mismatch")
const conditionBinding = loadConditionBinding(taskArg, conditionArg, guideManifestArg)
if (promptEvidence.ownerAuthorizationRef === THAILAND_REBUILD64_FAILED8_REPLACEMENT_AUTHORIZATION_ID) {
  assert(
    THAILAND_REBUILD64_FAILED8_CAPACITY_SLOTS.has(conditionBinding?.capacitySlotId),
    "failed8 replacement authorization does not cover this capacity slot",
  )
  assert(
    promptEvidence.retryRepairProfile?.sourceFailedRecordId,
    "failed8 replacement intake requires an immutable source failed record identity",
  )
}
if (promptEvidence.ownerAuthorizationRef === THAILAND_REBUILD64_CROSS_MODAL_REPLACEMENT_AUTHORIZATION_ID) {
  assert(
    new Set(["v7-capacity-slot-190", "v7-capacity-slot-194"]).has(
      conditionBinding?.capacitySlotId,
    ),
    "cross-modal replacement authorization does not cover this capacity slot",
  )
  assert(
    promptEvidence.retryRepairProfile?.sourceFailedRecordId,
    "cross-modal replacement intake requires an immutable source failed record identity",
  )
}
const rebuild64Sequence = rebuild64SequenceForCapacitySlot(conditionBinding?.capacitySlotId)
const effectiveTitle = rebuild64Sequence
  ? `${rebuild64Sequence.sequenceLabel}: ${regionalLandscapeType}`
  : title

const defaultSnapshotPath = resolveProjectPath(library.provisionalVisualSnapshotPath)
const snapshotPath = promptEvidence.targetVisualSnapshotPath
  ? resolveProjectPath(promptEvidence.targetVisualSnapshotPath)
  : defaultSnapshotPath
assert(isWithin(COLLECTION_ROOT, snapshotPath), "visual snapshot must be stored inside the original image library")
const snapshot = readJson(snapshotPath)
if (promptEvidence.targetVisualSnapshotId) assert(promptEvidence.targetVisualSnapshotId === snapshot.snapshotId, "prompt evidence visual snapshotId mismatch")
if (promptEvidence.targetMonsoonSeason) assert(promptEvidence.targetMonsoonSeason === snapshot.environment?.season, "prompt evidence monsoon season does not match visual snapshot")
const sourceBytes = fs.readFileSync(inputPath)
const sourceMetadata = await sharp(sourceBytes, { failOn: "error" }).metadata()
assert(sourceMetadata.width && sourceMetadata.height, "generated input dimensions are missing")
const sourceIsNativeTrainingSize = sourceMetadata.width === TRAINING_WIDTH && sourceMetadata.height === TRAINING_HEIGHT
const sourceIsEligibleHighResolutionFourThree = sourceMetadata.width >= TRAINING_WIDTH
  && sourceMetadata.height >= TRAINING_HEIGHT
  && sourceMetadata.width * 3 === sourceMetadata.height * 4
assert(
  sourceIsNativeTrainingSize || sourceIsEligibleHighResolutionFourThree,
  `AI-assisted cold-start source must be native 1024x768 or a no-smaller exact 4:3 source; received ${sourceMetadata.width}x${sourceMetadata.height}`,
)

const candidateRoot = path.join(OUTPUT_ROOT, recordId)
assert(!fs.existsSync(candidateRoot), `candidate already exists: ${projectPath(candidateRoot)}`)
fs.mkdirSync(candidateRoot, { recursive: true })
const rawPath = path.join(candidateRoot, "source-generated.png")
const normalizedPath = path.join(candidateRoot, sourceIsNativeTrainingSize ? "native-1024x768.png" : "training-derivative-1024x768.png")
const manifestPath = path.join(candidateRoot, "normalization-manifest.json")
const requestPath = path.join(candidateRoot, "original-image-intake-request.json")
fs.copyFileSync(inputPath, rawPath, fs.constants.COPYFILE_EXCL)
if (sourceIsNativeTrainingSize) {
  fs.copyFileSync(inputPath, normalizedPath, fs.constants.COPYFILE_EXCL)
} else {
  await sharp(sourceBytes, { failOn: "error" })
    .resize(TRAINING_WIDTH, TRAINING_HEIGHT, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .png({ compressionLevel: 9 })
    .toFile(normalizedPath)
}

const normalizedBytes = fs.readFileSync(normalizedPath)
const timestamp = new Date().toISOString()
const manifest = {
  schemaVersion: "ai-assisted-cold-start-image-normalization-v3",
  recordId,
  status: sourceIsNativeTrainingSize
    ? "native_1024x768_verified_waiting_original_image_intake"
    : "high_resolution_four_three_source_derived_waiting_original_image_intake",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
  derivativePolicyVersion: COLD_START_DERIVATIVE_POLICY,
  ownerAuthorizationRef: promptEvidence.ownerAuthorizationRef,
  continuousBatchAuthorizationId: [
    "owner-authorized-v7-remaining-104-continuous-batch-20260723",
    THAILAND_REBUILD64_BATCH_AUTHORIZATION_ID,
    THAILAND_REBUILD64_REMAINING63_AUTHORIZATION_ID,
    THAILAND_REBUILD64_FAILED8_REPLACEMENT_AUTHORIZATION_ID,
    THAILAND_REBUILD64_CROSS_MODAL_REPLACEMENT_AUTHORIZATION_ID,
  ].includes(promptEvidence.ownerAuthorizationRef)
    ? promptEvidence.ownerAuthorizationRef
    : null,
  rawGeneratedImagePath: projectPath(rawPath),
  rawGeneratedImageSha256: sha256(sourceBytes),
  rawSize: { width: sourceMetadata.width, height: sourceMetadata.height },
  sourceCrop: null,
  normalizedImagePath: projectPath(normalizedPath),
  normalizedImageSha256: sha256(normalizedBytes),
  normalizedSize: { width: 1024, height: 768 },
  transformation: sourceIsNativeTrainingSize
    ? "none_native_1024x768"
    : "nearest_neighbor_downsample_exact_four_three_to_1024x768",
  resampling: sourceIsNativeTrainingSize ? null : {
    kernel: "nearest",
    fit: "fill_exact_four_three_no_crop",
    sourceAspectRatio: "4:3",
    targetAspectRatio: "4:3",
    upscale: false,
    crop: false,
  },
  imageContentChangedByProgram: !sourceIsNativeTrainingSize,
  programDrawnRgbUsed: false,
  rawSourceRole: "immutable_ai_assisted_cold_start_source_evidence",
  normalizedImageRole: sourceIsNativeTrainingSize
    ? "ai_assisted_cold_start_training_target_and_machine_review"
    : "ai_assisted_cold_start_training_derivative_and_machine_review",
  formalCandidate: false,
  directWorldDisplayAllowed: false,
  runtimeFrameEligible: false,
  promptEvidencePath: projectPath(promptPath),
  promptEvidenceSha256: sha256(fs.readFileSync(promptPath)),
  conditionBinding,
  automaticStorage: true,
}
writeJson(manifestPath, manifest)

const request = {
  schemaVersion: "original-image-intake-request-v1",
  recordId,
  categoryId,
  title: effectiveTitle,
  imagePath: projectPath(normalizedPath),
  source: {
    sourceType: "openai_generated",
    creationMethod: "openai_built_in_image_generation_owner_authorized_cold_start",
    rightsHolder: "project-owner-authorized-use-subject-to-openai-terms",
    thirdPartyContentUsed: false,
    thirdPartyGenerativeModelUsed: true,
    copiedFromExistingWork: false,
    rawGeneratedImagePath: projectPath(rawPath),
    rawGeneratedImageSha256: manifest.rawGeneratedImageSha256,
    normalizationManifestPath: projectPath(manifestPath),
  },
  aiAssistedColdStart: {
    policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
    ownerAuthorizationRef: promptEvidence.ownerAuthorizationRef,
    continuousBatchAuthorizationId: [
      "owner-authorized-v7-remaining-104-continuous-batch-20260723",
      THAILAND_REBUILD64_BATCH_AUTHORIZATION_ID,
      THAILAND_REBUILD64_REMAINING63_AUTHORIZATION_ID,
      THAILAND_REBUILD64_FAILED8_REPLACEMENT_AUTHORIZATION_ID,
      THAILAND_REBUILD64_CROSS_MODAL_REPLACEMENT_AUTHORIZATION_ID,
    ].includes(promptEvidence.ownerAuthorizationRef)
      ? promptEvidence.ownerAuthorizationRef
      : null,
    trainingLane: "ai_assisted_cold_start",
    generatorProvider: promptEvidence.generatorProvider,
    generatorSystem: promptEvidence.generatorSystem,
    promptEvidencePath: projectPath(promptPath),
    promptEvidenceSha256: manifest.promptEvidenceSha256,
    sourceRoute: sourceIsNativeTrainingSize
      ? "generator_native_1024x768"
      : "generator_native_high_resolution_four_three_with_audited_training_derivative",
    derivativePolicyVersion: COLD_START_DERIVATIVE_POLICY,
    trainingDerivativePath: projectPath(normalizedPath),
    trainingDerivativeSha256: manifest.normalizedImageSha256,
    formalCandidate: false,
    directWorldDisplayAllowed: false,
    independentTrainingEligible: false,
  },
  conditionBinding,
  rebuild64Sequence,
  classification: classificationForPromptEvidence(categoryId, promptEvidence, regionalLandscapeType, conditionBinding, snapshot),
  worldBinding: {
    worldProfileId: snapshot.worldProfileId,
    biomeType: snapshot.biomeType,
    snapshotId: snapshot.snapshotId,
    snapshotPath: projectPath(snapshotPath),
    snapshotIsFinal: snapshot.isFinal,
    earthParameterSnapshotId: snapshot.earthParameterSnapshotId,
    worldId: conditionBinding?.worldId ?? null,
    tick: conditionBinding?.tick ?? null,
    taskPackageId: conditionBinding?.taskId ?? null,
    taskPackagePath: conditionBinding?.taskPackagePath ?? null,
    conditionPackId: conditionBinding?.conditionPackId ?? null,
    conditionPackPath: conditionBinding?.conditionPackPath ?? null,
    conditionPackSha256: conditionBinding?.conditionPackSha256 ?? null,
    conditionGuideManifestPath: conditionBinding?.guideManifestPath ?? null,
    conditionGuideSha256: conditionBinding?.guideSha256 ?? null
  },
  layerFiles: [],
  conditionFiles: conditionBinding ? [conditionBinding.taskPackagePath, conditionBinding.conditionPackPath, conditionBinding.guideManifestPath] : [],
  rightsFiles: [projectPath(promptPath), projectPath(manifestPath)],
  reviewFiles: []
}
writeJson(requestPath, request)

const child = spawnSync(process.execPath, [path.join(ROOT, "scripts", "intake-original-image.mjs"), "--request", requestPath], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
})
if (child.status !== 0) throw new Error(child.stderr || child.stdout || `original image intake exited ${child.status}`)
const intakeResult = JSON.parse(child.stdout)
writeJson(path.join(candidateRoot, "intake-result.json"), intakeResult)
console.log(JSON.stringify({
  status: "ai_assisted_cold_start_image_intaked_pending_review",
  recordId,
  rawGeneratedImageSha256: manifest.rawGeneratedImageSha256,
  normalizedImageSha256: manifest.normalizedImageSha256,
  normalizedImagePath: manifest.normalizedImagePath,
  transformation: manifest.transformation,
  derivativePolicyVersion: manifest.derivativePolicyVersion,
  recordPath: intakeResult.recordPath,
  ownerReviewStatus: "pending_review",
  aiAssistedColdStartEligible: false,
}, null, 2))

function argumentValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
function classificationForPromptEvidence(targetCategoryId, evidence, landscapeType, binding, visualSnapshot) {
  if (targetCategoryId === "complete-maps") return {
    mapScope: "complete-natural-home-map",
    regionalLandscapeType: landscapeType,
    monsoonSeason: evidence.targetMonsoonSeason ?? visualSnapshot.environment?.season ?? null,
    environmentState: evidence.targetEnvironmentState ?? visualSnapshot.environment?.monsoonPhase ?? visualSnapshot.environment?.weather ?? null,
    knowledgeRole: binding ? "condition_guided_complete_game_map_visual_candidate" : "global_composition_style_and_gameplay_readability",
  }
  assert(evidence.targetClassification && typeof evidence.targetClassification === "object", "prompt evidence target classification is missing")
  return evidence.targetClassification
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function writeJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); fs.writeFileSync(value, `${JSON.stringify(body, null, 2)}\n`) }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(isWithin(ROOT, resolved), `path escapes project root: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function isWithin(parent, child) { const root = path.resolve(parent); const target = path.resolve(child); return target === root || target.startsWith(`${root}${path.sep}`) }
function loadConditionBinding(taskValue, conditionValue, guideValue) {
  if (!taskValue && !conditionValue && !guideValue) return null
  assert(taskValue && conditionValue && guideValue, "task package, condition pack and condition guide manifest must be supplied together")
  const taskPath = resolveProjectPath(taskValue)
  const conditionPath = resolveProjectPath(conditionValue)
  const guidePath = resolveProjectPath(guideValue)
  const task = readJson(taskPath)
  const condition = readJson(conditionPath)
  const guide = readJson(guidePath)
  assert(task.worldProfileId === "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "task world profile mismatch")
  assert(condition.worldProfileId === task.worldProfileId && guide.worldProfileId === task.worldProfileId, "condition binding world profile mismatch")
  assert(condition.taskId === task.taskId && guide.taskId === task.taskId, "condition binding task mismatch")
  assert(condition.outputKind === "model_condition_only_no_rgb", "condition pack must not be an RGB target")
  assert(guide.outputKind === "semantic_condition_guide_not_training_rgb", "condition guide output kind is invalid")
  assert(guide.trainingTargetEligible === false && guide.directWorldDisplayAllowed === false, "condition guide isolation contract is invalid")
  assert(sha256(fs.readFileSync(resolveProjectPath(guide.guidePath))) === guide.guideSha256, "condition guide hash mismatch")
  const blueprint = task.sourceBindings?.trainingBlueprintPath
    ? readJson(resolveProjectPath(task.sourceBindings.trainingBlueprintPath))
    : null
  if (task.v7SlotBinding) {
    assert(
      blueprint?.realEarthRegionSourcePackageId
        && blueprint?.realEarthRegionSourcePackagePath
        && blueprint?.connectivityBlueprintId
        && /^[a-f0-9]{64}$/.test(
          blueprint?.structuralIdentities
            ?.themeArchitectureIdentity ?? "",
        )
        && /^[a-f0-9]{64}$/.test(
          blueprint?.structuralIdentities
            ?.instanceDetailIdentity ?? "",
        ),
      "V7 condition binding lacks region source, connectivity, or structural identities",
    )
  }
  return {
    status: "reference_guided_pending_alignment_review",
    worldId: task.worldId,
    tick: task.tick,
    worldProfileId: task.worldProfileId,
    taskId: task.taskId,
    taskPackagePath: projectPath(taskPath),
    taskSha256: task.taskSha256,
    capacitySlotId: task.v7SlotBinding?.slotId ?? null,
    conditionPackId: condition.conditionPackId,
    conditionPackPath: projectPath(conditionPath),
    conditionPackSha256: condition.conditionPackSha256,
    guideManifestPath: projectPath(guidePath),
    guidePath: guide.guidePath,
    guideSha256: guide.guideSha256,
    realEarthRegionId: blueprint?.realEarthRegionId ?? null,
    realEarthRegionSourcePackageId:
      blueprint?.realEarthRegionSourcePackageId ?? null,
    realEarthRegionSourcePackagePath:
      blueprint?.realEarthRegionSourcePackagePath ?? null,
    realEarthRegionSourcePackageSha256:
      blueprint?.realEarthRegionSourcePackageSha256 ?? null,
    connectivityBlueprintId:
      blueprint?.connectivityBlueprintId ?? null,
    connectivityBlueprintPath:
      blueprint?.connectivityBlueprintPath ?? null,
    structuralIdentities:
      blueprint?.structuralIdentities ?? null,
    formalConditionalTrainingEligible: false,
  }
}
function rebuild64SequenceForCapacitySlot(capacitySlotId) {
  if (!capacitySlotId || !fs.existsSync(REBUILD64_SEQUENCE_REGISTRY_PATH)) return null
  const registry = readJson(REBUILD64_SEQUENCE_REGISTRY_PATH)
  const entry = registry.entries?.find((item) => item.legacyCapacitySlotId === capacitySlotId)
  if (!entry) return null
  return {
    registryId: registry.registryId,
    seriesId: registry.seriesId,
    sequenceNumber: entry.sequenceNumber,
    sequenceCode: entry.sequenceCode,
    sequenceLabel: entry.sequenceLabel,
    workItemId: entry.workItemId,
    legacyCapacitySlotId: entry.legacyCapacitySlotId,
    ownerCommandRef: registry.ownerCommandRef,
  }
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
