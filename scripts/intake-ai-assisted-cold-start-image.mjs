import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const COLLECTION_ROOT = path.join(ROOT, "data", "world-samples", "original-image-library", "natural-home-v1")
const COVERAGE_BLUEPRINT_PATH = path.join(COLLECTION_ROOT, "coverage-blueprint.json")
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
assert(promptEvidence.ownerAuthorizationRef === "conversation-owner-authorization-2026-07-13", "prompt evidence owner authorization is invalid")
assert((promptEvidence.targetCategoryId ?? "complete-maps") === categoryId, "prompt evidence category mismatch")
if (categoryId === "complete-maps") assert(promptEvidence.targetRegionalLandscapeType === regionalLandscapeType, "prompt evidence regional landscape type mismatch")
const conditionBinding = loadConditionBinding(taskArg, conditionArg, guideManifestArg)

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
assert(sourceMetadata.width >= 1024 && sourceMetadata.height >= 768, "generated input must not be smaller than the formal canvas")
const crop = centeredFourByThreeCrop(sourceMetadata.width, sourceMetadata.height)

const candidateRoot = path.join(OUTPUT_ROOT, recordId)
assert(!fs.existsSync(candidateRoot), `candidate already exists: ${projectPath(candidateRoot)}`)
fs.mkdirSync(candidateRoot, { recursive: true })
const rawPath = path.join(candidateRoot, "source-generated.png")
const normalizedPath = path.join(candidateRoot, "normalized-1024x768.png")
const manifestPath = path.join(candidateRoot, "normalization-manifest.json")
const requestPath = path.join(candidateRoot, "original-image-intake-request.json")
fs.copyFileSync(inputPath, rawPath, fs.constants.COPYFILE_EXCL)
await sharp(sourceBytes, { failOn: "error" })
  .extract(crop)
  .resize(1024, 768, { fit: "fill", kernel: sharp.kernel.nearest })
  .png({ compressionLevel: 9, adaptiveFiltering: false })
  .toFile(normalizedPath)

const normalizedBytes = fs.readFileSync(normalizedPath)
const timestamp = new Date().toISOString()
const manifest = {
  schemaVersion: "ai-assisted-cold-start-image-normalization-v1",
  recordId,
  status: "normalized_waiting_original_image_intake",
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  policyVersion: "owner-authorized-ai-assisted-cold-start-v1",
  ownerAuthorizationRef: "conversation-owner-authorization-2026-07-13",
  rawGeneratedImagePath: projectPath(rawPath),
  rawGeneratedImageSha256: sha256(sourceBytes),
  rawSize: { width: sourceMetadata.width, height: sourceMetadata.height },
  sourceCrop: crop,
  normalizedImagePath: projectPath(normalizedPath),
  normalizedImageSha256: sha256(normalizedBytes),
  normalizedSize: { width: 1024, height: 768 },
  transformation: "center_crop_to_4_to_3_then_downscale_nearest_no_upscale",
  imageContentChangedByProgram: false,
  programDrawnRgbUsed: false,
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
  title,
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
    ownerAuthorizationRef: "conversation-owner-authorization-2026-07-13",
    trainingLane: "ai_assisted_cold_start",
    generatorProvider: promptEvidence.generatorProvider,
    generatorSystem: promptEvidence.generatorSystem,
    promptEvidencePath: projectPath(promptPath),
    promptEvidenceSha256: manifest.promptEvidenceSha256,
    independentTrainingEligible: false,
  },
  conditionBinding,
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
function centeredFourByThreeCrop(width, height) {
  let cropWidth
  let cropHeight
  if (width / height > 4 / 3) {
    cropHeight = Math.floor(height / 3) * 3
    cropWidth = (cropHeight / 3) * 4
  } else {
    cropWidth = Math.floor(width / 4) * 4
    cropHeight = (cropWidth / 4) * 3
  }
  return {
    left: Math.floor((width - cropWidth) / 2),
    top: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  }
}

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
  return {
    status: "reference_guided_pending_alignment_review",
    worldId: task.worldId,
    tick: task.tick,
    worldProfileId: task.worldProfileId,
    taskId: task.taskId,
    taskPackagePath: projectPath(taskPath),
    taskSha256: task.taskSha256,
    conditionPackId: condition.conditionPackId,
    conditionPackPath: projectPath(conditionPath),
    conditionPackSha256: condition.conditionPackSha256,
    guideManifestPath: projectPath(guidePath),
    guidePath: guide.guidePath,
    guideSha256: guide.guideSha256,
    formalConditionalTrainingEligible: false,
  }
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function assert(condition, message) { if (!condition) throw new Error(message) }
