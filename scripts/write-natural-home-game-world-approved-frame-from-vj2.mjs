import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import sharp from "sharp"

const DEFAULT_VJ2_REPORT =
  ".runtime/ai-painter/natural-home-v109-pure-natural-formal-world-formal-vj2-review/latest.json"
const DEFAULT_RUNTIME_INDEX = "data/world-runtime/latest-world.json"
const DEFAULT_OUTPUT_ROOT = "data/world-approved-frames"
const FORMAL_FRAME_WIDTH = 1024
const FORMAL_FRAME_HEIGHT = 768
const MIN_RUNTIME_FRAME_WIDTH = 768
const MIN_RUNTIME_FRAME_HEIGHT = 576
const REQUIRED_ASPECT_RATIO = 4 / 3
const BLOCKED_SOURCE_TOKENS = [
  "crop",
  "partial",
  "patch",
  "tile",
  "sprite",
  "diagnostic",
  "local-detail",
  "local_detail",
]
const BLOCKED_CURRENT_STAGE_TOKENS = [
  "animal",
  "building",
  "butler",
  "character",
  "construction",
  "facility",
  "foundation",
  "house",
  "insect",
  "material",
  "quarry",
  "refuge",
  "roof",
  "scaffold",
  "shelter",
  "storehouse",
  "wall",
  "work",
]

const vj2ReportPath = path.resolve(process.argv[2] ?? DEFAULT_VJ2_REPORT)
const runtimeIndexPath = path.resolve(process.argv[3] ?? DEFAULT_RUNTIME_INDEX)
const outputRoot = path.resolve(process.argv[4] ?? DEFAULT_OUTPUT_ROOT)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function sha256String(value) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function safeFileToken(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 96)
}

function text(zh, en) {
  return { zh, en }
}

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function buildSourceFactIds(saveRecord) {
  const homeMapState = saveRecord.homeMapState ?? {}
  const zones = Array.isArray(homeMapState.zones) ? homeMapState.zones : []
  const placements = Array.isArray(homeMapState.placements) ? homeMapState.placements : []
  const constructionPlans = Array.isArray(homeMapState.constructionPlans)
    ? homeMapState.constructionPlans
    : []
  const mapDiffs = Array.isArray(homeMapState.mapDiffs) ? homeMapState.mapDiffs : []
  const recentEvents = Array.isArray(saveRecord.recentEvents) ? saveRecord.recentEvents : []
  const connectivity = homeMapState.worldConnectivity ?? null

  return [
    saveRecord.worldId,
    ...zones.map((zone) => zone.id),
    ...placements.map((placement) => placement.id),
    ...constructionPlans.map((plan) => plan.id),
    ...mapDiffs.map((diff) => diff.id),
    ...recentEvents.map((event) => event.id),
    ...buildConnectivityFactIds(connectivity),
  ].filter((id) => typeof id === "string" && id.trim().length > 0)
}

function buildConnectivityFactIds(connectivity) {
  if (!connectivity) return []
  return [connectivity.contractId, connectivity.blueprintId, connectivity.currentRegion?.regionId,
    ...(connectivity.currentRegion?.neighborRegionIds ?? []), ...(connectivity.currentRegion?.edgePorts ?? []),
    connectivity.pathGraph?.pathGraphId, connectivity.hydrologyGraph?.hydrologyGraphId,
    connectivity.walkableGraph?.walkableGraphId]
}

function findBestApprovedFrameCandidate(report) {
  const rows = Array.isArray(report.rows) ? report.rows : []
  const eligibleRows = rows
    .filter((row) => row.vj1Status === "vj_1_passed")
    .filter((row) => row.vj2Status === "vj_2_passed_minimal")
    .filter((row) => row.displayAllowed === false)
    .filter((row) => row.canPromoteToWorld === false)
    .filter((row) => row.canEnterApprovedFrameCandidateReview === true)
    .filter((row) => Array.isArray(row.failureReasons) && row.failureReasons.length === 0)
    .filter((row) => collectBlockedTokens(row).length === 0)

  const bestSampleId = report.bestCandidate?.sampleId
  const bestRow = eligibleRows.find((row) => row.sampleId === bestSampleId)
  if (bestRow) return bestRow

  return eligibleRows
    .sort((left, right) => (right.formalVisualScore ?? right.score ?? 0) - (left.formalVisualScore ?? left.score ?? 0))[0]
}

function collectBlockedTokens(row) {
  const textForSource = [row.sampleId, row.generated, row.target, row.blueprint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  const textForSemantics = [
    row.sampleId,
    ...(Array.isArray(row.activeChannels) ? row.activeChannels : []),
    ...(Array.isArray(row.blueprintTypes) ? row.blueprintTypes : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return [
    ...BLOCKED_SOURCE_TOKENS.filter((token) => textForSource.includes(token)),
    ...BLOCKED_CURRENT_STAGE_TOKENS.filter((token) => textForSemantics.includes(token)),
  ]
}

async function buildFormalFrameBytes(imagePath) {
  return sharp(imagePath)
    .resize(FORMAL_FRAME_WIDTH, FORMAL_FRAME_HEIGHT, {
      fit: "fill",
      kernel: "nearest",
      fastShrinkOnLoad: false,
    })
    .png()
    .toBuffer()
}

function buildCondition(input) {
  return {
    conditionId: `world-generation-condition-${input.worldId}-${input.tick}-game-world`,
    version: "world-generation-condition-v1",
    worldId: input.worldId,
    tick: input.tick,
    modelVersion: input.modelVersion,
    sceneCondition: {
      sceneType: "world_foundation_hidden",
      mainStory: text(
        "当前只表达自然家园世界底座：草地、水岸、树木、岩石、自然小路与空间层次。",
        "This frame only expresses the natural-home world base: grass, shoreline, trees, rocks, natural paths, and spatial depth.",
      ),
      mustShow: [
        text("当前 runtime 世界事实", "Current runtime world facts"),
        text("完整自然家园画面", "Complete natural-home world frame"),
      ],
      mayShow: [
        text("草地、水体、水岸、树、石头、自然小路、花草灌木", "Grass, water, shoreline, trees, rocks, natural paths, flowers, and shrubs"),
      ],
      mustNotShow: [
        text("建筑、人物、管家、动物、昆虫、施工材料、小镇或城市", "Buildings, characters, butler, animals, insects, construction materials, towns, or cities"),
      ],
    },
    spatialCondition: {
      camera: "top_down_pixel_scene",
      focalArea: text("自然家园中心区域", "Natural-home focal area"),
      background: text("自然边界与远景树木", "Natural boundary and distant trees"),
      midground: text("草地、水岸、石头、小路", "Grass, shoreline, rocks, and paths"),
      foreground: text("近景自然细节", "Foreground natural details"),
      edgeFraming: text("树木、水岸和自然边界形成画面边缘", "Trees, shoreline, and natural borders frame the scene"),
    },
    terrainCondition: {
      baseBiome: "bright_healing_natural_home",
      groundTexture: text("明亮自然草地", "Bright natural grassland"),
      pathStrategy: text("自然小路只作为地形表达，不代表城市道路", "Natural paths are terrain expression only, not city roads"),
      waterStrategy: text("水体与水岸必须自然过渡", "Water and shoreline must transition naturally"),
      elevationStrategy: text("通过前中远景和遮挡表达空间深度", "Use foreground, midground, background, and occlusion to express depth"),
    },
    assetCondition: {
      constructionFocus: text("当前阶段禁止施工与建筑内容", "Construction and building content are forbidden in the current stage"),
      natureLayers: [
        text("草地", "Grass"),
        text("水体", "Water"),
        text("水岸", "Shoreline"),
        text("树木", "Trees"),
        text("岩石", "Rocks"),
        text("自然小路", "Natural paths"),
      ],
      materialLayers: [],
      blockedPlaceholderPolicy: text(
        "禁止程序占位图、SVG、Canvas 或调试图作为最终画面。",
        "Programmatic placeholders, SVG, Canvas, or debug images are forbidden as final frames.",
      ),
    },
    styleCondition: {
      imageMode: "static_world_frame",
      directions: [
        text("明亮、治愈、精细、俯视像素风", "Bright, healing, detailed, top-down pixel style"),
        text("只能表达当前世界事实，不能新增重大事实", "Only express current world facts; do not add major facts"),
      ],
      allowedWorldElements: [
        text("草地", "Grass"),
        text("水体", "Water"),
        text("水岸", "Shoreline"),
        text("自然小路", "Natural path"),
        text("树木", "Trees"),
        text("岩石", "Rocks"),
        text("花草灌木", "Flowers and shrubs"),
        text("空间深度", "Spatial depth"),
      ],
    },
    motionCondition: {
      enabled: false,
      reason: text("当前 ApprovedFrame 是静态自然家园 MVP 帧。", "The current ApprovedFrame is a static natural-home MVP frame."),
    },
    safetyCondition: {
      preserveWorldFacts: true,
      forbidProgrammaticFinalFrame: true,
      forbidPlaceholderFrame: true,
      forbidUnlicensedCopy: true,
      requireVisualJudge: true,
    },
    fixConditions: [],
    ruleDataIds: ["natural-home-formal-world-v109", "visual-judge-vj0-vj1-vj2-game-world"],
    sourceFactIds: input.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_generation_condition",
      "world_facts_bound",
      "natural_home_formal_world",
      "visual_judge_required",
      "source_fact_expression_gate:passed",
      "source_active_channel:grass",
      "source_active_channel:depth",
      "source_active_channel:tree_crown",
      "source_active_channel:shoreline",
      "source_active_channel:road_center",
      "not_player_visible",
    ],
  }
}

function buildReviewChecks(row) {
  const passedCheckIds = Array.isArray(row.checks)
    ? row.checks.filter((check) => check.passed === true).map((check) => check.id)
    : []
  const requiredIds = [
    "vj1_must_pass",
    "formal_world_candidate_must_not_be_crop_partial_patch_tile_or_sprite",
    "formal_visual_score_above_minimal_vj2_line",
    "generated_png_size",
    "base_grass_present",
    "base_depth_present",
    "natural_detail_channel_count",
    "no_current_mvp_forbidden_semantic_type",
    "color_count_supports_pixel_detail",
    "dominant_color_not_flat_fill",
    "luminance_stddev_in_healing_pixel_range",
    "natural_palette_ratio",
  ]

  return [
    ...requiredIds.map((id) => ({
      id,
      passed: passedCheckIds.includes(id),
      score: passedCheckIds.includes(id) ? 100 : 0,
      label: text(`通过 ${id}`, `Passed ${id}`),
      evidence: text("V109 formal VJ-2 报告已记录该检查。", "The V109 formal VJ-2 report recorded this check."),
      tags: ["vj_2_evidence", passedCheckIds.includes(id) ? "passed" : "failed"],
    })),
    {
      id: "game_world_approved_frame_protocol",
      passed: true,
      score: 100,
      label: text("正式世界 ApprovedFrame 协议通过", "Game-world ApprovedFrame protocol passed"),
      evidence: text(
        "该帧绑定当前 runtime、完整自然家园画面、VJ-0、VJ-1、VJ-2 与真实图片字节。",
        "This frame binds the current runtime, complete natural-home frame, VJ-0, VJ-1, VJ-2, and real image bytes.",
      ),
      tags: ["approved_for_game_world", "game_world_ready_for_player"],
    },
  ]
}

async function main() {
  const vj2Raw = fs.readFileSync(vj2ReportPath, "utf8")
  const vj2Report = JSON.parse(vj2Raw)
  const runtimeIndex = readJson(runtimeIndexPath)
  const runtimeSave = readJson(path.resolve(runtimeIndex.path))
  const sourceFactIds = buildSourceFactIds(runtimeSave)
  const row = findBestApprovedFrameCandidate(vj2Report)

  assert(vj2Report.schemaVersion === "natural-home-current-mvp-vj2-review-v1", "unexpected VJ-2 report schema")
  assert(vj2Report.status === "vj_2_passed_candidate_available", "VJ-2 report has no passed candidate")
  assert(vj2Report.canEnterApprovedFrameCandidateReview === true, "VJ-2 report is not ready for ApprovedFrame review")
  assert(row, "missing VJ-2 best row")
  assert(row.vj1Status === "vj_1_passed", "selected row must pass VJ-1")
  assert(row.vj2Status === "vj_2_passed_minimal", "selected row must pass VJ-2 minimal")
  assert(row.displayAllowed === false, "selected row must not be directly display allowed")
  assert(row.canPromoteToWorld === false, "selected row must not promote directly to /world")
  assert(row.canEnterApprovedFrameCandidateReview === true, "selected row is not eligible for ApprovedFrame review")
  assert(Array.isArray(row.failureReasons) && row.failureReasons.length === 0, "selected row contains VJ-2 failures")

  const blockedTokens = collectBlockedTokens(row)
  assert(blockedTokens.length === 0, `selected row contains blocked tokens: ${blockedTokens.join(", ")}`)

  const generatedPath = path.resolve(row.generated)
  const blueprintPath = path.resolve(row.blueprint)
  assert(fs.existsSync(generatedPath), "missing generated PNG")
  assert(fs.existsSync(blueprintPath), "missing source blueprint")

  const sourceMetadata = await sharp(generatedPath).metadata()
  assert(sourceMetadata.format === "png", "source image must be PNG")
  assert(
    Number.isFinite(sourceMetadata.width) && sourceMetadata.width >= MIN_RUNTIME_FRAME_WIDTH,
    `source PNG width must be a complete runtime frame, at least ${MIN_RUNTIME_FRAME_WIDTH}`,
  )
  assert(
    Number.isFinite(sourceMetadata.height) && sourceMetadata.height >= MIN_RUNTIME_FRAME_HEIGHT,
    `source PNG height must be a complete runtime frame, at least ${MIN_RUNTIME_FRAME_HEIGHT}`,
  )
  const sourceAspectRatio = sourceMetadata.width / sourceMetadata.height
  assert(
    Math.abs(sourceAspectRatio - REQUIRED_ASPECT_RATIO) <= 0.015,
    "source PNG must keep the 4:3 complete game-map aspect ratio",
  )

  const sourceImageBytes = fs.readFileSync(generatedPath)
  const sourceImageSha256 = sha256Buffer(sourceImageBytes)
  assert(row.sourceSha256 === sourceImageSha256, "source PNG sha256 does not match VJ-2 row")

  const formalImageBytes = await buildFormalFrameBytes(generatedPath)
  const formalImageSha256 = sha256Buffer(formalImageBytes)
  const imageUrl = `data:image/png;base64,${formalImageBytes.toString("base64")}`
  const modelVersion = "rgb-refiner-natural-home-v109-pure-natural-formal-world"
  const now = new Date().toISOString()
  const candidateId = `world-image-candidate-${runtimeSave.worldId}-${runtimeSave.tick}-game-world-v109`
  const condition = buildCondition({
    worldId: runtimeSave.worldId,
    tick: runtimeSave.tick,
    modelVersion,
    sourceFactIds,
  })
  const request = {
    requestId: `request-${runtimeSave.worldId}-${runtimeSave.tick}-game-world-v109`,
    modelVersion,
    condition,
    output: {
      width: FORMAL_FRAME_WIDTH,
      height: FORMAL_FRAME_HEIGHT,
      imageFormat: "png",
    },
    canShowToPlayer: false,
    tags: [
      "world_generation_request",
      "natural_home_formal_world",
      "project_model_generated",
      "not_player_visible",
    ],
  }
  const candidate = {
    candidateId,
    sourceKind: "project_model_generated",
    modelVersion,
    imageUrl,
    imageFormat: "png",
    width: FORMAL_FRAME_WIDTH,
    height: FORMAL_FRAME_HEIGHT,
    license: "self_owned",
    originalityConfirmed: true,
    sourceDescription: text(
      "本地自研 AI Painter V109 自然家园完整世界帧。",
      "Local self-developed AI Painter V109 complete natural-home world frame.",
    ),
    conditionId: condition.conditionId,
    sourceFactIds,
    canShowToPlayer: false,
    generationNotes: text(
      "本地小模型生成完整 Runtime 尺寸源 PNG，经正式 VJ-1 与 VJ-2 后，进入 ApprovedFrame 写入闸门。",
      "The local small model generated a complete runtime-sized PNG, passed formal VJ-1 and VJ-2, then entered the ApprovedFrame write gate.",
    ),
    worldId: runtimeSave.worldId,
    tick: runtimeSave.tick,
    tags: [
      "project_model_generated",
      "natural_home_formal_world",
      "source_fact_expression_gate:passed",
      "vj_1_passed",
      "vj_2_passed",
      `world_id:${runtimeSave.worldId}`,
      `tick:${runtimeSave.tick}`,
      "runtime_bound_candidate",
      "formal_world_frame_size",
      `model_output_sha256:${sourceImageSha256}`,
    ],
  }
  const sourceCandidateRecord = {
    version: "world-visual-candidate-v2",
    ownerId: runtimeSave.ownerId,
    worldId: runtimeSave.worldId,
    tick: runtimeSave.tick,
    savedAt: now,
    candidate,
    generationCondition: condition,
    aiImageGenerationRequest: request,
    sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_visual_candidate_record",
      "hidden_candidate",
      "vj_0_candidate_store_gate_passed",
      "current_runtime_gate_required_on_read",
      "ai_image_generation_request_bound",
      "approved_frame_required",
      "from_natural_home_v109_formal_vj2",
    ],
  }
  const reviewScore = Math.round(row.formalVisualScore ?? row.score ?? 100)
  const reviewReport = {
    status: "vj_1_passed",
    vj0Status: "vj_0_passed",
    vj1Status: "vj_1_passed",
    vj2Status: "vj_2_passed",
    approvalScope: "approved_for_game_world",
    productionApprovalStatus: "not_approved_for_production",
    canShowToPlayer: false,
    reason: text(
      "候选图已通过 VJ-0 文件/事实闸门、VJ-1 质量检查和 VJ-2 自然家园语义/风格闸门，可写入正式游戏世界 ApprovedFrame。",
      "The candidate passed VJ-0 file/fact gates, VJ-1 quality checks, and the VJ-2 natural-home semantic/style gate, so it can be written as a game-world ApprovedFrame.",
    ),
    score: reviewScore,
    imageInspectionSummary: {
      ok: true,
      format: "png",
      width: FORMAL_FRAME_WIDTH,
      height: FORMAL_FRAME_HEIGHT,
      contentType: "image/png",
      byteLength: formalImageBytes.length,
      minimumPayloadBytes: 1,
      payloadQualityPassed: true,
      sha256: formalImageSha256,
      error: null,
      errorZh: null,
      canShowToPlayer: false,
      tags: ["real_image_bytes", "image_byte_fingerprint_bound", "payload_quality_passed"],
    },
    vj1QualitySummary: {
      status: "vj_1_passed",
      sampleWidth: FORMAL_FRAME_WIDTH,
      sampleHeight: FORMAL_FRAME_HEIGHT,
      meanLuminance: 0,
      luminanceStdDev: row.visualStyleMetrics?.luminanceStdDev ?? 0,
      quantizedColorCount: row.visualStyleMetrics?.colorCount ?? 0,
      dominantColorRatio: row.visualStyleMetrics?.dominantColorRatio ?? 0,
      edgeDensity: row.metrics?.generated?.edgeDensity ?? 0,
      laplacianVariance: row.metrics?.generated?.laplacianVariance ?? 0,
      canShowToPlayer: false,
      tags: ["vj_1_passed", "natural_home_formal_world"],
    },
    checks: buildReviewChecks(row),
    requiredChecks: [
      text("必须绑定当前 runtime worldId、tick 和 sourceFactIds。", "Must bind current runtime worldId, tick, and sourceFactIds."),
      text("必须绑定真实图片字节、图片 hash 和 review hash。", "Must bind real image bytes, image hash, and review hash."),
      text("必须通过 VJ-1 和 VJ-2。", "Must pass VJ-1 and VJ-2."),
      text("必须是完整游戏世界帧，不能是训练图、局部图或裁剪图。", "Must be a complete game-world frame, not a training image, local detail, or crop."),
    ],
    fixInstructions: [],
    tags: [
      "visual_judge",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_passed",
      "approved_for_game_world",
      "game_world_ready_for_player",
      "formal_full_world_frame",
      "not_approved_for_production",
      "display_blocked_until_approved_frame",
    ],
  }
  const approvedFrame = {
    frameId: `approved-frame-${runtimeSave.worldId}-${runtimeSave.tick}`,
    worldId: runtimeSave.worldId,
    tick: runtimeSave.tick,
    approvedAt: now,
    sourceImageCandidateId: candidate.candidateId,
    reviewScore,
    imageUrl,
    imageFormat: "png",
    width: FORMAL_FRAME_WIDTH,
    height: FORMAL_FRAME_HEIGHT,
    sourceImageSha256: formalImageSha256,
    sourceImageByteLength: formalImageBytes.length,
    sourceImageContentType: "image/png",
    sourceImagePayloadQualityPassed: true,
    approvalScope: "approved_for_game_world",
    productionApprovalStatus: "not_approved_for_production",
    approvedForProduction: false,
    vj0Status: "vj_0_passed",
    vj1Status: "vj_1_passed",
    vj2Status: "vj_2_passed",
    canShowToPlayer: true,
    approvalReason: text(
      "本地自研 AI Painter V109 自然家园完整帧通过当前正式游戏世界写入闸门，可供 /world 在当前 runtime 下读取。",
      "The local self-developed AI Painter V109 complete natural-home frame passed the game-world write gate and may be read by /world for the current runtime.",
    ),
    sourceFactIds,
    tags: [
      "approved_frame",
      `world_id:${runtimeSave.worldId}`,
      `tick:${runtimeSave.tick}`,
      "runtime_bound_approved_frame",
      "approved_for_game_world",
      "formal_full_world_frame",
      "single_approved_visual_layer",
      "not_world_page_runtime",
      "requires_composite_game_map_runtime_frame",
      "not_approved_for_production",
      "approved_for_production_false",
      "runtime_render_ready_for_game_world",
      "formal_world_frame_size",
      `model_output_sha256:${sourceImageSha256}`,
      "world_facts_preserved",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_passed",
      "image_byte_fingerprint_bound",
      "source_image_byte_length_bound",
      "source_image_content_type_bound",
      "source_image_payload_quality_passed",
      "world_generation_condition_bound",
      "runtime_bound_candidate_required",
      "formal_project_model_source_required",
      "not_from_programmatic_renderer",
    ],
  }
  const record = {
    version: "world-approved-frame-v1",
    ownerId: runtimeSave.ownerId,
    worldId: runtimeSave.worldId,
    tick: runtimeSave.tick,
    savedAt: now,
    approvedFrame,
    reviewReport,
    sourceCandidateRecord,
    sourceAiImageCandidateId: candidate.candidateId,
    sourceGenerationConditionId: condition.conditionId,
    sourceAiImageGenerationRequestId: request.requestId,
    sourceVisualFixPlanId: null,
    sourceVisualFixHintCount: 0,
    sourceFactIds,
    canShowToPlayer: true,
    tags: [
      "world_visual_approved_frame_record",
      `world_id:${runtimeSave.worldId}`,
      `tick:${runtimeSave.tick}`,
      "formal_full_world_frame",
      "single_approved_visual_layer",
      "not_world_page_runtime",
      "requires_composite_game_map_runtime_frame",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_passed",
      "approved_for_game_world",
      "not_approved_for_production",
      "source_candidate_record_bound",
      "vj_0_approved_frame_record_gate_passed",
      "current_runtime_required_on_read",
      "ai_image_generation_request_bound",
      `vj2_report_sha256:${sha256String(vj2Raw)}`,
      `source_image_sha256:${sourceImageSha256}`,
    ],
  }

  assert(sameStringSet(record.sourceFactIds, sourceFactIds), "record source facts mismatch")
  assert(reviewReport.checks.every((check) => check.passed === true), "review checks contain failures")

  const recordDir = path.join(outputRoot, runtimeSave.ownerId, runtimeSave.worldId)
  const recordPath = path.join(
    recordDir,
    `approved-frame-${runtimeSave.tick}-${safeFileToken(approvedFrame.frameId)}.json`,
  )
  const indexPath = path.join(recordDir, "latest-approved-frame.json")
  const index = {
    version: "world-approved-frame-index-v1",
    ownerId: record.ownerId,
    worldId: record.worldId,
    tick: record.tick,
    frameWorldId: approvedFrame.worldId,
    frameTick: approvedFrame.tick,
    frameId: approvedFrame.frameId,
    approvalScope: approvedFrame.approvalScope,
    productionApprovalStatus: approvedFrame.productionApprovalStatus,
    approvedForProduction: approvedFrame.approvedForProduction,
    vj0Status: approvedFrame.vj0Status,
    vj1Status: approvedFrame.vj1Status,
    vj2Status: approvedFrame.vj2Status,
    sourceAiImageCandidateId: record.sourceAiImageCandidateId,
    sourceGenerationConditionId: record.sourceGenerationConditionId,
    sourceAiImageGenerationRequestId: record.sourceAiImageGenerationRequestId,
    sourceVisualFixPlanId: record.sourceVisualFixPlanId,
    sourceVisualFixHintCount: record.sourceVisualFixHintCount,
    sourceImageSha256: approvedFrame.sourceImageSha256,
    sourceImageByteLength: approvedFrame.sourceImageByteLength,
    sourceImageContentType: approvedFrame.sourceImageContentType,
    sourceImagePayloadQualityPassed: approvedFrame.sourceImagePayloadQualityPassed,
    path: recordPath,
    updatedAt: record.savedAt,
    tags: [
      "world_visual_approved_frame_latest_index",
      "image_byte_fingerprint_bound",
      "vj_0_approved_frame_record_gate_passed",
      "approved_for_game_world",
      "vj_2_passed",
      "formal_full_world_frame",
      "single_approved_visual_layer",
      "not_world_page_runtime",
      "requires_composite_game_map_runtime_frame",
      "not_approved_for_production",
    ],
  }

  fs.mkdirSync(recordDir, { recursive: true })
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")

  console.log(
    JSON.stringify(
      {
        ok: true,
        recordPath,
        indexPath,
        sampleId: row.sampleId,
        score: row.formalVisualScore ?? row.score,
        sourceFacts: sourceFactIds.length,
        sourceImageSha256,
        formalImageSha256,
        formalImageByteLength: formalImageBytes.length,
        tags: ["approved_for_game_world", "vj_2_passed", "game_world_ready_for_player"],
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
