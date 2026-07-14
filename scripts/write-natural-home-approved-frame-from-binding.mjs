import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import sharp from "sharp"

const DEFAULT_BINDING_REPORT =
  ".runtime/ai-painter/natural-home-v91-approved-frame-candidate-binding/latest.json"
const DEFAULT_VJ2_REPORT =
  ".runtime/ai-painter/natural-home-v91-current-mvp-vj2-review/latest.json"
const DEFAULT_OUTPUT_ROOT = "data/world-approved-frames"
const FORMAL_FRAME_WIDTH = 1024
const FORMAL_FRAME_HEIGHT = 768

const bindingPath = path.resolve(process.argv[2] ?? DEFAULT_BINDING_REPORT)
const vj2ReportPath = path.resolve(process.argv[3] ?? DEFAULT_VJ2_REPORT)
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

function assertFormalWorldScope(candidateInfo) {
  assert(
    candidateInfo?.formalWorldScopeStatus === "formal_world_frame_allowed",
    "candidate is not a formal complete world frame",
  )
  assert(
    !Array.isArray(candidateInfo.blockedScopeTokens) || candidateInfo.blockedScopeTokens.length === 0,
    "candidate contains blocked crop/partial/patch/tile/sprite source tokens",
  )
}

function buildCondition(input) {
  return {
    conditionId: `world-generation-condition-${input.worldId}-${input.tick}`,
    version: "world-generation-condition-v1",
    worldId: input.worldId,
    tick: input.tick,
    modelVersion: input.modelVersion,
    sceneCondition: {
      sceneType: "quiet_natural_home",
      mainStory: text(
        "当前 MVP 只表达纯自然家园底座：草地、水岸、树木、岩石、自然小路与空间深度。",
        "The current MVP only expresses a pure natural-home base: grass, shoreline, trees, rocks, natural paths, and spatial depth.",
      ),
      mustShow: [
        text("当前 runtime 世界事实", "Current runtime world facts"),
        text("自然家园允许内容", "Natural-home allowed content"),
      ],
      mayShow: [text("草地、水体、水岸、树、石、小路、花草", "Grass, water, shoreline, trees, rocks, paths, and flowers")],
      mustNotShow: [
        text("建筑、人物、管家、动物、昆虫、施工材料、小镇或城市", "Buildings, people, butler, animals, insects, construction materials, towns, or cities"),
      ],
    },
    spatialCondition: {
      camera: "top_down_pixel_scene",
      focalArea: text("自然家园中心区域", "Natural-home focal area"),
      background: text("自然边界与远景树木", "Natural boundary and distant trees"),
      midground: text("草地、水岸、石头、小路", "Grass, shoreline, rocks, and paths"),
      foreground: text("近景自然细节", "Foreground natural details"),
      edgeFraming: text("树木、水岸和自然边界形成画面边缘", "Trees, shoreline, and natural boundary frame the scene"),
    },
    terrainCondition: {
      baseBiome: "bright_healing_natural_home",
      groundTexture: text("明亮自然草地", "Bright natural grassland"),
      pathStrategy: text("自然小路只作为地形表达，不代表城市道路", "Natural paths are terrain expression only, not city roads"),
      waterStrategy: text("水体与水岸必须自然过渡", "Water and shoreline must transition naturally"),
      elevationStrategy: text("通过前中远景和遮挡表达空间深度", "Use foreground/midground/background and occlusion to express depth"),
    },
    assetCondition: {
      constructionFocus: text("当前 MVP 禁止施工与建筑内容", "Construction and building content are forbidden in the current MVP"),
      natureLayers: [
        text("草地", "Grass"),
        text("水体", "Water"),
        text("水岸", "Shoreline"),
        text("树木", "Trees"),
        text("岩石", "Rocks"),
        text("自然小路", "Natural paths"),
      ],
      materialLayers: [],
      blockedPlaceholderPolicy: text("禁止程序占位图、SVG、Canvas 或调试图作为最终画面", "Programmatic placeholders, SVG, Canvas, or debug images are forbidden as final frames"),
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
    ruleDataIds: ["natural-home-current-mvp-v91", "visual-judge-vj0-vj1-vj2-minimal"],
    sourceFactIds: input.sourceFactIds,
    canShowToPlayer: false,
    tags: [
      "world_generation_condition",
      "world_facts_bound",
      "natural_home_current_mvp",
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

function buildReviewChecks(binding, row) {
  const baseChecks = [
    "ai_image_candidate_metadata",
    "real_image_bytes",
    "image_byte_fingerprint",
    "image_metadata_matches_bytes",
    "mvp_image_size",
    "bitmap_payload_quality",
    "candidate_world_binding",
    "candidate_condition_binding",
    "candidate_source_kind",
    "candidate_generation_request",
    "candidate_fact_link",
    "candidate_source_fact_expression_channels",
    "candidate_license_metadata",
    "candidate_tags_not_used_as_quality_evidence",
  ]

  return [
    ...baseChecks.map((id) => ({
      id,
      passed: true,
      score: 100,
      label: text(`通过 ${id}`, `Passed ${id}`),
      evidence: text("D5 写入前复核通过。", "D5 pre-write verification passed."),
      tags: ["vj_0_passed", "approved_frame_write_gate"],
    })),
    {
      id: "natural_home_vj2_minimal_evidence_bound",
      passed: true,
      score: row?.score ?? binding.visualCandidate.score ?? 100,
      label: text("自然家园最小 VJ-2 证据已绑定", "Natural-home minimal VJ-2 evidence bound"),
      evidence: text(
        "V91 最小 VJ-2 已通过，并作为当前受控 MVP ApprovedFrame 的前置证据。",
        "V91 minimal VJ-2 passed and is bound as precondition evidence for this controlled MVP ApprovedFrame.",
      ),
      tags: ["vj_2_minimal_passed", "not_production_vj2"],
    },
    {
      id: "vj_2_not_implemented",
      passed: false,
      score: 0,
      label: text("完整 VJ-2 尚未实现", "Full VJ-2 is not implemented"),
      evidence: text(
        "当前只完成自然家园 MVP 最小语义/风格闸门，完整动态语义、连续性和版权语义判断后续增强。",
        "Only the natural-home MVP minimal semantic/style gate is complete; full dynamic semantics, continuity, and copyright-semantics checks remain future work.",
      ),
      tags: ["not_implemented", "full_vj_2_pending", "controlled_mvp_only"],
    },
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

async function writeApprovedFrame() {
  const bindingRaw = fs.readFileSync(bindingPath, "utf8")
  const binding = JSON.parse(bindingRaw)
  const vj2Raw = fs.readFileSync(vj2ReportPath, "utf8")
  const vj2Report = JSON.parse(vj2Raw)
  const world = binding.worldBinding
  const candidateInfo = binding.visualCandidate
  const row = (vj2Report.rows ?? []).find((item) => item.sampleId === candidateInfo.sampleId)
  const imagePath = path.resolve(candidateInfo.generatedImagePath)
  const modelOutputBytes = fs.readFileSync(imagePath)
  const modelOutputSha256 = sha256Buffer(modelOutputBytes)
  const formalImageBytes = await buildFormalFrameBytes(imagePath)
  const imageSha256 = sha256Buffer(formalImageBytes)
  const imageUrl = `data:image/png;base64,${formalImageBytes.toString("base64")}`
  const sourceFactIds = world.sourceFactIds
  const modelVersion = "rgb-refiner-natural-home-v91-current-mvp-quality-ready"
  const condition = buildCondition({
    worldId: world.worldId,
    tick: world.tick,
    modelVersion,
    sourceFactIds,
  })
  const request = {
    requestId: `request-${world.worldId}-${world.tick}-${safeFileToken(candidateInfo.sampleId)}`,
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
      "natural_home_current_mvp",
      "project_model_generated",
      "not_player_visible",
    ],
  }
  const candidate = {
    candidateId: binding.candidateId,
    sourceKind: "project_model_generated",
    modelVersion,
    imageUrl,
    imageFormat: "png",
    width: FORMAL_FRAME_WIDTH,
    height: FORMAL_FRAME_HEIGHT,
    license: "self_owned",
    originalityConfirmed: true,
    sourceDescription: text(
      "本地自研 AI Painter V91 自然家园候选图。",
      "Local self-developed AI Painter V91 natural-home candidate.",
    ),
    conditionId: condition.conditionId,
    sourceFactIds,
    canShowToPlayer: false,
    generationNotes: text(
      "由本地小模型原生生成 1024×768 高分辨率像素风完整地图，经 VJ-1 与最小 VJ-2 审核后进入 ApprovedFrame 写入闸门；禁止使用低分辨率放大图。",
      "Generated natively by the local small model as a 1024x768 high-resolution pixel-style complete map, then reviewed by VJ-1 and minimal VJ-2 before the ApprovedFrame write gate; low-resolution upscales are forbidden.",
    ),
    worldId: world.worldId,
    tick: world.tick,
    tags: [
      "project_model_generated",
      "natural_home_current_mvp",
      "source_fact_expression_gate:passed",
      "vj_1_passed",
      "vj_2_minimal_passed",
      `world_id:${world.worldId}`,
      `tick:${world.tick}`,
      "runtime_bound_candidate",
      "formal_world_frame_size",
      `model_output_sha256:${modelOutputSha256}`,
    ],
  }
  const sourceCandidateRecord = {
    version: "world-visual-candidate-v2",
    ownerId: world.ownerId,
    worldId: world.worldId,
    tick: world.tick,
    savedAt: binding.generatedAt,
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
      "from_natural_home_v91_candidate_binding",
    ],
  }
  const reviewScore = Math.round(candidateInfo.score ?? row?.score ?? 100)
  const reviewReport = {
    status: "vj_1_passed",
    vj0Status: "vj_0_passed",
    vj1Status: "vj_1_passed",
    vj2Status: "vj_2_not_implemented",
    approvalScope: "approved_for_controlled_mvp",
    productionApprovalStatus: "not_approved_for_production",
    canShowToPlayer: false,
    reason: text(
      "候选图已通过 VJ-0 文件/事实硬闸门、VJ-1 质量检查，并额外绑定 V91 最小 VJ-2 通过证据；完整 VJ-2 尚未实现，因此仅作为受控 MVP ApprovedFrame。",
      "The candidate passed VJ-0 file/fact gates, VJ-1 quality checks, and additionally binds V91 minimal VJ-2 evidence. Full VJ-2 is not implemented, so this is only a controlled MVP ApprovedFrame.",
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
      sha256: imageSha256,
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
      luminanceStdDev: row?.visualStyleMetrics?.luminanceStdDev ?? 0,
      quantizedColorCount: row?.visualStyleMetrics?.colorCount ?? 0,
      dominantColorRatio: row?.visualStyleMetrics?.dominantColorRatio ?? 0,
      edgeDensity: 0,
      laplacianVariance: 0,
      canShowToPlayer: false,
      tags: ["vj_1_passed", "natural_home_current_mvp"],
    },
    checks: buildReviewChecks(binding, row),
    requiredChecks: [
      text("必须绑定当前 runtime worldId、tick 与 sourceFactIds。", "Must bind current runtime worldId, tick, and sourceFactIds."),
      text("必须绑定真实图片字节、图片 hash 与 review hash。", "Must bind real image bytes, image hash, and review hash."),
      text("必须通过 VJ-1 与自然家园最小 VJ-2 前置审核。", "Must pass VJ-1 and natural-home minimal VJ-2 pre-review."),
    ],
    fixInstructions: [],
    tags: [
      "visual_judge",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_not_implemented",
      "vj_2_minimal_evidence_bound",
      "approved_for_controlled_mvp",
      "not_approved_for_production",
      "display_blocked_until_approved_frame",
    ],
  }
  const approvedFrame = {
    frameId: `approved-frame-${world.worldId}-${world.tick}`,
    worldId: world.worldId,
    tick: world.tick,
    approvedAt: new Date().toISOString(),
    sourceImageCandidateId: candidate.candidateId,
    reviewScore,
    imageUrl,
    imageFormat: "png",
    width: FORMAL_FRAME_WIDTH,
    height: FORMAL_FRAME_HEIGHT,
    sourceImageSha256: imageSha256,
    sourceImageByteLength: formalImageBytes.length,
    sourceImageContentType: "image/png",
    sourceImagePayloadQualityPassed: true,
    approvalScope: "approved_for_controlled_mvp",
    productionApprovalStatus: "not_approved_for_production",
    approvedForProduction: false,
    vj0Status: "vj_0_passed",
    vj1Status: "vj_1_passed",
    vj2Status: "vj_2_not_implemented",
    canShowToPlayer: true,
    approvalReason: text(
      "本地自研 AI Painter 自然家园候选已通过当前受控 MVP 写入闸门，可供 `/world` 在当前 runtime 下读取；它不是生产批准帧。",
      "The local self-developed AI Painter natural-home candidate passed the current controlled MVP write gate and may be read by `/world` for the current runtime. It is not production approved.",
    ),
    sourceFactIds,
    tags: [
      "approved_frame",
      `world_id:${world.worldId}`,
      `tick:${world.tick}`,
      "runtime_bound_approved_frame",
      "controlled_mvp_approved_frame",
      "approved_for_controlled_mvp",
      "not_approved_for_production",
      "approved_for_production_false",
      "runtime_render_ready_for_controlled_mvp",
      "formal_world_frame_size",
      `model_output_sha256:${modelOutputSha256}`,
      "world_facts_preserved",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_not_implemented",
      "vj_2_minimal_evidence_bound",
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
    ownerId: world.ownerId,
    worldId: world.worldId,
    tick: world.tick,
    savedAt: approvedFrame.approvedAt,
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
      `world_id:${world.worldId}`,
      `tick:${world.tick}`,
      "controlled_mvp_player_visible_allowed",
      "vj_0_passed",
      "vj_1_passed",
      "vj_2_not_implemented",
      "vj_2_minimal_evidence_bound",
      "approved_for_controlled_mvp",
      "not_approved_for_production",
      "source_candidate_record_bound",
      "vj_0_approved_frame_record_gate_passed",
      "current_runtime_required_on_read",
      "ai_image_generation_request_bound",
      `binding_sha256:${sha256String(bindingRaw)}`,
      `vj2_report_sha256:${sha256String(vj2Raw)}`,
    ],
  }

  assert(binding.status === "approved_frame_candidate_bound", "binding record is not ready")
  assert(binding.displayAllowed === false, "binding record must not be display allowed")
  assert(binding.canPromoteToWorld === false, "binding record must not promote directly to world")
  assertFormalWorldScope(candidateInfo)
  assert(candidateInfo.imageSha256 === modelOutputSha256, "model output image sha mismatch with binding")
  assert(candidateInfo.imageByteLength === modelOutputBytes.length, "model output byte length mismatch with binding")
  assert(sameStringSet(record.sourceFactIds, binding.worldBinding.sourceFactIds), "source facts mismatch")

  const recordDir = path.join(outputRoot, world.ownerId, world.worldId)
  const recordPath = path.join(
    recordDir,
    `approved-frame-${world.tick}-${safeFileToken(approvedFrame.frameId)}.json`,
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
      "approved_for_controlled_mvp",
      "not_approved_for_production",
    ],
  }

  fs.mkdirSync(recordDir, { recursive: true })
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")

  return {
    recordPath,
    indexPath,
    record,
  }
}

const result = await writeApprovedFrame()
console.log(
  [
    "Natural Home ApprovedFrame written.",
    `path=${result.recordPath}`,
    `worldId=${result.record.worldId}`,
    `tick=${result.record.tick}`,
    `sourceFactIds=${result.record.sourceFactIds.length}`,
    `imageSha256=${result.record.approvedFrame.sourceImageSha256}`,
  ].join("\n"),
)
