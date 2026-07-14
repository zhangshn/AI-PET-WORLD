import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const INFERENCE_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-bootstrap-inference")
const REVIEW_ROOT = path.join(ROOT, ".runtime", "ai-painter", "complete-world-visual-machine-reviews")
const LEDGER_ROOT = path.join(ROOT, ".runtime", "ai-painter", "training-process-ledger")

const inferencePointer = readJson(path.join(INFERENCE_ROOT, "latest.json"))
const candidate = readJson(resolveProjectPath(inferencePointer.manifestPath))
const conditionPointer = readJson(path.join(ROOT, ".runtime", "ai-painter", "world-visual-generation-task-packages", "latest.json"))
const conditionManifestPath = path.join(path.dirname(resolveProjectPath(conditionPointer.taskPath)), "compiled-conditions", "manifest.json")
const conditionManifest = readJson(conditionManifestPath)
const conditionPack = readJson(resolveProjectPath(conditionManifest.conditionPackPath))
const imagePath = resolveProjectPath(candidate.outputImagePath)
const imageBytes = fs.readFileSync(imagePath)
const imageSha256 = sha256(imageBytes)
const timestamp = new Date().toISOString()
const reviewId = `bootstrap-machine-review-${candidate.runId}-${timestamp.replace(/[:.]/g, "-")}`
const reviewDir = path.join(REVIEW_ROOT, reviewId)
const reviewPath = path.join(reviewDir, "machine-review.json")

assert(candidate.outputImageSha256 === imageSha256, "candidate image identity mismatch")
assert(candidate.taskId === conditionPack.taskId, "candidate task does not match current condition pack")
assert(candidate.conditionPackSha256 === conditionManifest.conditionPackSha256, "candidate condition pack mismatch")

const clipChild = spawnSync(process.execPath, [path.join(ROOT, "scripts", "judge-current-world-bootstrap-clip.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
})
assert(clipChild.status === 0, `local CLIP semantic review failed: ${clipChild.stderr || clipChild.stdout}`)
const clipReviewPointer = readJson(path.join(REVIEW_ROOT, "latest-clip-review.json"))
assert(clipReviewPointer.runId === candidate.runId, "CLIP review run identity mismatch")
assert(clipReviewPointer.imageSha256 === imageSha256, "CLIP review image identity mismatch")

const image = await sharp(imageBytes, { failOn: "error" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const masks = await loadMasks(conditionPack, ["terrain_grass", "terrain_water", "terrain_path_ground", "object_tree", "object_rock"])
const pixelMetrics = measurePixels(image.data, image.info.width, image.info.height)
const regionMetrics = {
  grass: measureRegion(image.data, masks.terrain_grass),
  water: measureRegion(image.data, masks.terrain_water),
  path: measureRegion(image.data, masks.terrain_path_ground),
  trees: measureRegion(image.data, masks.object_tree),
  rocks: measureRegion(image.data, masks.object_rock),
}
const semanticMetrics = {
  waterBlueAdvantage: round(regionMetrics.water.blueAdvantage - regionMetrics.grass.blueAdvantage),
  pathLumaContrast: round(Math.abs(regionMetrics.path.averageLuma - regionMetrics.grass.averageLuma)),
  treeLumaContrast: round(Math.abs(regionMetrics.trees.averageLuma - regionMetrics.grass.averageLuma)),
  rockLumaContrast: round(Math.abs(regionMetrics.rocks.averageLuma - regionMetrics.grass.averageLuma)),
  ...measureWaterLeak(image.data, masks.terrain_water, masks.terrain_grass),
}
const duplicateEvidence = findDuplicateCandidateEvidence(candidate)

const issues = []
addIssue(!["fresh_local_model_inference", "fresh_local_foundation_inference"].includes(candidate.outputSource), "vj0_output_source_invalid", "VJ-0", "整图不是本轮本地模型新推理结果。", "The complete map is not a fresh local-model inference result.", "whole_frame", "inference_identity")
addIssue(candidate.reusedExistingImage !== false || candidate.targetImageUsed !== false || candidate.programDrawnRgbUsed !== false, "vj0_generation_boundary_failed", "VJ-0", "候选图违反非复用、无目标图或非程序绘图边界。", "The candidate violates no-reuse, no-target, or no-program-RGB boundaries.", "whole_frame", "inference_identity")
addIssue(duplicateEvidence.length > 0, "vj0_output_not_novel_across_runs", "VJ-0", "本轮模型重新推理后仍与历史候选图片 hash 完全相同，seed 未产生有效候选变化。", "Fresh model execution produced the exact image hash of an earlier candidate; the seed did not create effective candidate variation.", "whole_frame", "seed_conditioned_candidate_diversity")
addIssue(image.info.width !== 1024 || image.info.height !== 768, "vj1_formal_resolution_invalid", "VJ-1", "候选图不是 1024×768 完整画面。", "The candidate is not a 1024x768 complete frame.", "whole_frame", "native_formal_resolution")
addIssue(pixelMetrics.edgeDensity < 0.035, "vj1_low_detail_blur_artifact", "VJ-1", "整图边缘密度过低，呈现为模糊低细节画面。", "Whole-frame edge density is too low and reads as blurred low-detail output.", "whole_frame", "native_resolution_detail")
addIssue(pixelMetrics.stripeAnisotropy > 1.65, "vj1_vertical_stripe_artifact", "VJ-1", "整图存在明显纵向条纹/扫描线伪影。", "The complete frame contains strong vertical stripe or scan-line artifacts.", "whole_frame", "artifact_suppression")
addIssue(pixelMetrics.quantizedColorCount < 650, "vj1_palette_collapse", "VJ-1", "整图有效色彩变化不足，材质语言发生塌缩。", "The frame has insufficient effective color variation and collapsed material language.", "whole_frame", "complete_frame_color_language")
addIssue(semanticMetrics.waterBlueAdvantage < 10, "vj2_water_not_visually_distinct", "VJ-2", "水体区域未形成相对草地可读的水体视觉语义。", "The water region is not visually distinguishable from grass as water.", "terrain_water", "water_visual_semantics")
addIssue(semanticMetrics.grassWaterLeakRatio > 0.03, "vj2_water_outside_condition_mask", "VJ-2", "草地区域出现超过条件范围的水体视觉，模型擅自增加了湖泊或水池。", "Water-like pixels leaked into the grass condition region, indicating an invented pond or lake outside world structure.", "terrain_grass", "water_condition_spatial_fidelity")
addIssue(semanticMetrics.pathLumaContrast < 12, "vj2_path_not_visually_distinct", "VJ-2", "道路区域与草地区分不足，主路线不可可靠阅读。", "The path lacks sufficient contrast from grass for reliable route readability.", "terrain_path_ground", "path_visual_semantics")
addIssue(semanticMetrics.treeLumaContrast < 12 || semanticMetrics.rockLumaContrast < 10, "vj2_object_block_readability_failed", "VJ-2", "树木或石头仍呈块状/低语义对象，未形成专业接地对象。", "Trees or rocks remain block-like low-semantic objects without professional grounding.", "object_regions", "object_visual_grounding")
const channelCoverage = candidate.consumedCompiledChannelIds.length / conditionPack.channels.length
addIssue(channelCoverage < 0.8, "vj2_current_condition_vocabulary_not_consumed", "VJ-2", "启动模型未消费当前完整条件词汇，无法证明中尺度、过渡和接地语义。", "The bootstrap model does not consume the full current condition vocabulary, so mid-scale, transition, and grounding semantics are unproven.", "whole_frame", "current_condition_model_alignment")
addIssue(candidate.reviewOutputResample?.formalNativeResolution !== true, "professional_native_resolution_capability_missing", "Professional Aesthetic", "当前 1024×768 输出不是模型原生正式分辨率结果。", "The current 1024x768 output is not native formal-resolution model output.", "whole_frame", "native_formal_resolution_model")
for (const criterion of clipReviewPointer.rubric) {
  addIssue(
    !criterion.passed,
    `professional_clip_${criterion.id}_failed`,
    "Professional Aesthetic",
    `本地视觉语义门禁未通过：${criterion.id}。`,
    `The local visual semantic gate rejected criterion ${criterion.id} (${criterion.positiveProbability} < ${criterion.minimumPositiveProbability}).`,
    "whole_frame",
    criterion.id,
  )
}

const gate = (name) => {
  const gateIssues = issues.filter((issue) => issue.gate === name)
  return { gate: name, passed: gateIssues.length === 0, issueCodes: gateIssues.map((issue) => issue.code) }
}
const gates = [gate("VJ-0"), gate("VJ-1"), gate("VJ-2"), gate("Professional Aesthetic")]
const passed = gates.every((item) => item.passed)
const failureFeedback = issues.map((issue) => ({
  failureFamily: issue.gate === "VJ-1" ? "pixel_quality" : issue.gate === "VJ-2" ? "structure_semantics" : issue.gate === "Professional Aesthetic" ? "professional_aesthetic" : "source_identity",
  failureCode: issue.code,
  affectedRegion: issue.affectedRegion,
  negativeSampleLabel: `owner_unreviewed_machine_negative:${issue.code}`,
  dictionaryFixTarget: null,
  datasetTarget: issue.nextFixTarget,
  modelCapabilityTarget: issue.nextFixTarget,
  nextTaskConstraint: `must_clear:${issue.code}`,
}))

const report = {
  schemaVersion: "complete-world-visual-machine-review-v1",
  reviewId,
  createdAtUtc: timestamp,
  createdAtAsiaShanghai: formatShanghai(timestamp),
  reviewerVersion: "complete-world-bootstrap-vj0-vj1-vj2-professional-v1",
  status: passed ? "machine_passed_waiting_owner_review" : "machine_rejected",
  passed,
  canEnterWorld: false,
  canCountAsPositiveSample: false,
  ownerReviewStatus: passed ? "pending_review" : "not_reached_machine_failed",
  candidate: {
    runId: candidate.runId,
    imagePath: candidate.outputImagePath,
    imageSha256,
    taskId: candidate.taskId,
    conditionPackId: candidate.conditionPackId,
    modelVersion: candidate.modelVersion,
    seed: candidate.seed,
  },
  gates,
  metrics: {
    pixel: pixelMetrics,
    regions: regionMetrics,
    semantics: semanticMetrics,
    conditionChannelCoverage: round(channelCoverage),
    duplicateCandidateCount: duplicateEvidence.length,
    localClipSemanticGate: {
      status: clipReviewPointer.status,
      averagePositiveProbability: clipReviewPointer.averagePositiveProbability,
      failedCriterionIds: clipReviewPointer.failedCriterionIds,
      rubric: clipReviewPointer.rubric,
      model: clipReviewPointer.model,
    },
  },
  score: {
    sourceIdentity: gates[0].passed ? 100 : 0,
    pixelQuality: gates[1].passed ? 100 : 0,
    structureSemantics: gates[2].passed ? 100 : 0,
    professionalAesthetic: gates[3].passed ? 100 : 0,
  },
  title: passed ? "Bootstrap complete-map candidate passed machine review" : "Bootstrap complete-map candidate failed machine review",
  titleZh: passed ? "Bootstrap 完整地图候选通过机器审核" : "Bootstrap 完整地图候选未通过机器审核",
  summary: passed ? "All machine gates passed; owner final review is required." : `Machine review blocked the candidate with ${issues.length} durable issue(s).`,
  summaryZh: passed ? "全部机器闸门通过，仍需项目所有者终审。" : `机器审核记录 ${issues.length} 个可追溯问题并阻断候选图。`,
  issues,
  failureFeedback,
  evidence: [candidate.outputImagePath, inferencePointer.manifestPath, conditionManifest.conditionPackPath, clipReviewPointer.reviewPath, ...duplicateEvidence],
  automaticStorage: true,
}

writeJson(reviewPath, report)
writeJson(path.join(REVIEW_ROOT, "latest.json"), { ...report, reviewPath: projectPath(reviewPath) })
appendLedger(report)
console.log(JSON.stringify({ status: report.status, reviewId, imageSha256, gates, issueCodes: issues.map((issue) => issue.code), reviewPath: projectPath(reviewPath) }, null, 2))

function addIssue(failed, code, gateName, messageZh, message, affectedRegion, nextFixTarget) {
  if (failed) issues.push({ code, severity: "error", gate: gateName, message, messageZh, affectedRegion, nextFixTarget })
}

function findDuplicateCandidateEvidence(current) {
  if (!fs.existsSync(INFERENCE_ROOT)) return []
  const matches = []
  for (const entry of fs.readdirSync(INFERENCE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === current.runId || entry.name === "failures") continue
    const manifestPathValue = path.join(INFERENCE_ROOT, entry.name, "manifest.json")
    if (!fs.existsSync(manifestPathValue)) continue
    try {
      const manifest = readJson(manifestPathValue)
      if (manifest.outputImageSha256 === current.outputImageSha256) matches.push(projectPath(manifestPathValue))
    } catch {
      // An unreadable historical record is handled by persistence checks, not this image review.
    }
  }
  return matches
}

async function loadMasks(pack, ids) {
  const result = {}
  for (const id of ids) {
    const channel = pack.channels.find((item) => item.id === id)
    assert(channel, `required condition channel missing: ${id}`)
    const raw = await sharp(resolveProjectPath(channel.path)).greyscale().raw().toBuffer({ resolveWithObject: true })
    assert(raw.info.width === pack.canvas.width && raw.info.height === pack.canvas.height, `condition size mismatch: ${id}`)
    result[id] = raw.data
  }
  return result
}

function measurePixels(data, width, height) {
  let lumaSum = 0
  let lumaSqSum = 0
  let horizontalDiff = 0
  let verticalDiff = 0
  let horizontalEdges = 0
  let edgeComparisons = 0
  const colors = new Set()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      lumaSum += luma
      lumaSqSum += luma * luma
      colors.add(`${data[i] >> 3}:${data[i + 1] >> 3}:${data[i + 2] >> 3}`)
      if (x > 0) {
        const p = i - 3
        const diff = (Math.abs(data[i] - data[p]) + Math.abs(data[i + 1] - data[p + 1]) + Math.abs(data[i + 2] - data[p + 2])) / 3
        horizontalDiff += diff
        horizontalEdges += diff > 18 ? 1 : 0
        edgeComparisons += 1
      }
      if (y > 0) {
        const p = i - width * 3
        verticalDiff += (Math.abs(data[i] - data[p]) + Math.abs(data[i + 1] - data[p + 1]) + Math.abs(data[i + 2] - data[p + 2])) / 3
      }
    }
  }
  const count = width * height
  const averageLuma = lumaSum / count
  const lumaStdDev = Math.sqrt(Math.max(0, lumaSqSum / count - averageLuma * averageLuma))
  const horizontalMean = horizontalDiff / (height * (width - 1))
  const verticalMean = verticalDiff / ((height - 1) * width)
  return { width, height, averageLuma: round(averageLuma), lumaStdDev: round(lumaStdDev), edgeDensity: round(horizontalEdges / edgeComparisons), meanHorizontalDifference: round(horizontalMean), meanVerticalDifference: round(verticalMean), stripeAnisotropy: round(horizontalMean / Math.max(verticalMean, 0.0001)), quantizedColorCount: colors.size }
}

function measureRegion(rgb, mask) {
  let count = 0
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] < 128) continue
    const p = i * 3
    count += 1
    r += rgb[p]
    g += rgb[p + 1]
    b += rgb[p + 2]
  }
  assert(count > 0, "condition region is empty")
  const red = r / count
  const green = g / count
  const blue = b / count
  return { pixelCount: count, averageRgb: [round(red), round(green), round(blue)], averageLuma: round(0.2126 * red + 0.7152 * green + 0.0722 * blue), blueAdvantage: round(blue - (red + green) / 2) }
}

function measureWaterLeak(rgb, waterMask, grassMask) {
  let grassPixels = 0
  let grassWaterLikePixels = 0
  let waterPixels = 0
  let waterLikePixels = 0
  for (let i = 0; i < waterMask.length; i += 1) {
    const p = i * 3
    const red = rgb[p]
    const green = rgb[p + 1]
    const blue = rgb[p + 2]
    const waterLike = blue > 120 && blue - (red + green) / 2 > 18
    if (grassMask[i] >= 128 && waterMask[i] < 128) {
      grassPixels += 1
      if (waterLike) grassWaterLikePixels += 1
    }
    if (waterMask[i] >= 128) {
      waterPixels += 1
      if (waterLike) waterLikePixels += 1
    }
  }
  return {
    grassWaterLeakRatio: round(grassWaterLikePixels / Math.max(grassPixels, 1)),
    conditionedWaterRecognitionRatio: round(waterLikePixels / Math.max(waterPixels, 1)),
    grassWaterLikePixels,
    conditionedWaterLikePixels: waterLikePixels,
  }
}

function appendLedger(reportValue) {
  const event = {
    schemaVersion: "ai-painter-training-process-ledger-event-v1",
    timestamp: reportValue.createdAtUtc,
    timestampAsiaShanghai: reportValue.createdAtAsiaShanghai,
    status: reportValue.passed ? "success" : "failed",
    kind: "complete_world_visual_machine_review",
    action: "review_current_world_bootstrap_candidate",
    title: reportValue.title,
    titleZh: reportValue.titleZh,
    summary: reportValue.summary,
    summaryZh: reportValue.summaryZh,
    archiveId: reportValue.reviewId,
    resourceSessionId: reportValue.candidate.imageSha256,
    script: "scripts/review-current-world-bootstrap-candidate.mjs",
    evidence: [projectPath(reviewPath), reportValue.candidate.imagePath],
    error: reportValue.passed ? null : reportValue.issues.map((issue) => issue.code).join(","),
    errorZh: reportValue.passed ? null : reportValue.issues.map((issue) => issue.messageZh).join("；"),
  }
  fs.mkdirSync(LEDGER_ROOT, { recursive: true })
  fs.appendFileSync(path.join(LEDGER_ROOT, "events.jsonl"), `${JSON.stringify(event)}\n`)
  writeJson(path.join(LEDGER_ROOT, "latest.json"), event)
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`) }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function resolveProjectPath(value) { const resolved = path.resolve(ROOT, value); assert(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), `path escapes project root: ${value}`); return resolved }
function projectPath(value) { return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/") }
function formatShanghai(iso) { return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00` }
function round(value) { return Math.round(value * 10000) / 10000 }
function assert(condition, message) { if (!condition) throw new Error(message) }
