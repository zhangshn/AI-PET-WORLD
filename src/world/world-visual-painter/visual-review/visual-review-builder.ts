import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"

import type {
  WorldVisualAiImageCandidate,
  WorldVisualAiImageGenerationRequest,
  WorldVisualFactManifest,
  WorldVisualGenerationCondition,
  WorldVisualImageInspectionSummary,
  WorldVisualReviewCheck,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"
import { WORLD_VISUAL_MVP_TARGET_POLICY } from "../visual-target-policy"
import { judgeWorldVisualDeterministicQuality } from "../visual-quality"

const MIN_IMAGE_WIDTH = 1024
const MIN_IMAGE_HEIGHT = 768
const MIN_IMAGE_BYTES = 24 * 1024
const MIN_IMAGE_BYTES_PER_MEGAPIXEL = 12 * 1024
const MAX_IMAGE_BYTES = 16 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8000

type RuntimeBoundCandidate = WorldVisualAiImageCandidate & {
  worldId?: unknown
  tick?: unknown
}

type ImageInspectionResult = {
  ok: boolean
  format: WorldVisualAiImageCandidate["imageFormat"] | null
  width: number | null
  height: number | null
  contentType: string | null
  byteLength: number
  sha256: string | null
  error: string | null
  errorZh: string | null
  bytes: Uint8Array | null
}

export async function buildWorldVisualReviewReport(input: {
  factManifest: WorldVisualFactManifest
  generationCondition: WorldVisualGenerationCondition
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
  aiImageCandidate: WorldVisualAiImageCandidate | null
}): Promise<WorldVisualReviewReport> {
  const inspection = await inspectCandidateImage(input.aiImageCandidate)
  const vj0Checks = buildReviewChecks({ ...input, inspection })
  const vj0Passed = vj0Checks.every((check) => check.passed)
  const vj1Result = vj0Passed && inspection.bytes
    ? await judgeWorldVisualDeterministicQuality(inspection.bytes)
    : {
        summary: {
          status: "vj_1_failed" as const,
          sampleWidth: 0,
          sampleHeight: 0,
          meanLuminance: 0,
          luminanceStdDev: 0,
          quantizedColorCount: 0,
          dominantColorRatio: 1,
          edgeDensity: 0,
          laplacianVariance: 0,
          canShowToPlayer: false as const,
          tags: [
            "vj_1_failed",
            vj0Passed ? "vj_0_image_bytes_unavailable" : "vj_0_prerequisite_failed",
          ],
        },
        checks: [],
      }
  const vj1Passed = vj0Passed && vj1Result.summary.status === "vj_1_passed"
  const reviewChecks = [...vj0Checks, ...vj1Result.checks]
  const score = Math.round(
    reviewChecks.reduce((sum, check) => sum + check.score, 0) /
      Math.max(reviewChecks.length, 1)
  )
  const status: WorldVisualReviewReport["status"] = vj0Passed
    ? vj1Passed
      ? "vj_1_passed"
      : "vj_1_failed"
    : "vj_0_failed"

  return {
    status,
    vj0Status: vj0Passed ? "vj_0_passed" : "vj_0_failed",
    vj1Status: vj1Passed ? "vj_1_passed" : "vj_1_failed",
    vj2Status: "vj_2_not_implemented",
    approvalScope: vj1Passed ? "approved_for_controlled_mvp" : "not_approved",
    productionApprovalStatus: "not_approved_for_production",
    canShowToPlayer: false,
    reason:
      status === "vj_1_passed"
        ? {
            zh: "AI 位图候选图已通过 VJ-0 文件与事实硬闸门，以及 VJ-1 确定性像素质量检查。VJ-2 项目视觉判断模型尚未实现，因此当前只允许进入受控 MVP ApprovedFrame。",
            en: "The AI bitmap candidate passed the VJ-0 file and fact gate and VJ-1 deterministic pixel-quality checks. VJ-2 is not implemented, so it may only enter a controlled MVP ApprovedFrame.",
          }
        : status === "vj_1_failed"
          ? {
              zh: "VJ-1 确定性视觉质量检查未通过，候选图存在亮度、对比度、颜色范围、单色占比、边缘密度或锐度问题，因此禁止展示。",
              en: "VJ-1 deterministic visual-quality review failed due to brightness, contrast, color range, dominant-color ratio, edge density, or sharpness, so display is blocked.",
            }
        : {
            zh: "VJ-0 审核未通过：候选图、图片本体、条件绑定、生成请求、来源、事实链、授权或基础文件质量存在硬闸门问题，因此禁止展示。",
            en: "VJ-0 review failed: the candidate, image bytes, condition binding, generation request, source, fact links, license, or baseline file quality failed the hard gate, so display is blocked.",
          },
    score,
    imageInspectionSummary: buildImageInspectionSummary(inspection),
    vj1QualitySummary: vj1Result.summary,
    checks: [
      ...reviewChecks,
      notImplementedCheck(
        "vj_2_not_implemented",
        "VJ-2 项目视觉判断模型未实现",
        "VJ-2 project visual-judge model is not implemented",
        "尚未判断画面是否真实表达当前世界事实、是否符合项目像素风、构图是否合理、是否存在语义版权风险或连续性问题。",
        "No project visual-judge model has checked fact expression, project pixel style, composition, semantic copyright risk, or continuity."
      ),
    ],
    requiredChecks: [
      {
        zh: "候选图必须是隐藏的 PNG/WebP/JPG 位图候选图，并满足基础尺寸要求。",
        en: "The candidate must be a hidden PNG/WebP/JPG bitmap candidate and meet the baseline size requirement.",
      },
      {
        zh: "候选图必须能读取真实图片本体，生成 sha256 指纹，并且声明格式尺寸与图片本体一致。",
        en: "The candidate must expose real image bytes, produce a sha256 fingerprint, and match declared format and dimensions.",
      },
      {
        zh: "候选图必须绑定当前 WorldGenerationCondition 的 worldId、tick、conditionId 和 sourceFactIds。",
        en: "The candidate must bind to the current WorldGenerationCondition worldId, tick, conditionId, and sourceFactIds.",
      },
      {
        zh: "受控 MVP ApprovedFrame 只允许 project_model_generated，并且必须绑定内部模型版本和生成请求；development_test_asset 不能进入正式 ApprovedFrame。",
        en: "Controlled MVP ApprovedFrame only allows project_model_generated and must bind the internal model version and generation request; development_test_asset cannot enter formal ApprovedFrame.",
      },
      {
        zh: "VJ-0 不接受候选图标签作为视觉质量、风格、无水印、事实呈现或版权语义安全的通过证据。",
        en: "VJ-0 does not accept candidate tags as pass evidence for visual quality, style, watermark absence, fact expression, or semantic copyright safety.",
      },
      {
        zh: "VJ-0 与 VJ-1 均通过后才能生成受控 MVP ApprovedFrame；VJ-2 未实现前不能生成 production approved 帧。",
        en: "Both VJ-0 and VJ-1 must pass before a controlled MVP ApprovedFrame can be created; production approval is forbidden before VJ-2 exists.",
      },
      WORLD_VISUAL_MVP_TARGET_POLICY.displayGate,
    ],
    fixInstructions: buildFixInstructions(reviewChecks),
    tags: [
      "visual_judge",
      "vj_0_hard_gate",
      "vj_1_deterministic_quality",
      status,
      vj1Passed ? "vj_1_passed" : "vj_1_failed",
      "vj_2_not_implemented",
      vj1Passed ? "approved_for_controlled_mvp" : "not_approved",
      "not_approved_for_production",
      "production_approval_blocked_until_vj_2",
      "real_image_bytes_required",
      "image_content_type_required",
      "image_byte_fingerprint_required",
      "world_generation_condition_required",
      "ai_image_generation_request_required",
      "formal_project_model_source_required",
      "candidate_tags_are_metadata_only",
      "no_tag_based_quality_pass",
      "display_blocked_until_controlled_mvp_approved_frame",
      "no_programmatic_renderer",
    ],
  }
}

function buildImageInspectionSummary(
  inspection: ImageInspectionResult
): WorldVisualImageInspectionSummary {
  const minimumPayloadBytes = getMinimumImageByteLength(
    inspection.width,
    inspection.height
  )
  const payloadQualityPassed =
    inspection.ok && inspection.byteLength >= minimumPayloadBytes

  return {
    ok: inspection.ok,
    format: inspection.format,
    width: inspection.width,
    height: inspection.height,
    contentType: inspection.contentType,
    byteLength: inspection.byteLength,
    minimumPayloadBytes,
    payloadQualityPassed,
    sha256: inspection.sha256,
    error: inspection.error,
    errorZh: inspection.errorZh,
    canShowToPlayer: false,
    tags: [
      "image_inspection_summary",
      inspection.ok ? "inspection_ok" : "inspection_failed",
      payloadQualityPassed
        ? "payload_quality_passed"
        : "payload_quality_failed",
      inspection.contentType ? "content_type_present" : "content_type_missing",
      inspection.format ? `format_${inspection.format}` : "format_missing",
      inspection.byteLength > 0 ? "byte_length_present" : "byte_length_empty",
      inspection.sha256 ? "sha256_present" : "sha256_missing",
      "vj_0_file_inspection",
      "not_player_visible",
    ],
  }
}

function buildReviewChecks(input: {
  factManifest: WorldVisualFactManifest
  generationCondition: WorldVisualGenerationCondition
  aiImageGenerationRequest: WorldVisualAiImageGenerationRequest | null
  aiImageCandidate: WorldVisualAiImageCandidate | null
  inspection: ImageInspectionResult
}): WorldVisualReviewCheck[] {
  const candidate = input.aiImageCandidate
  const request = input.aiImageGenerationRequest
  const hasCandidateMetadata =
    candidate !== null &&
    candidate.canShowToPlayer === false &&
    candidate.width >= MIN_IMAGE_WIDTH &&
    candidate.height >= MIN_IMAGE_HEIGHT &&
    isApprovedImageFormat(candidate.imageFormat)
  const imageBytesAreValid = input.inspection.ok
  const imageHasByteFingerprint =
    imageBytesAreValid && typeof input.inspection.sha256 === "string"
  const imageMatchesMetadata =
    candidate !== null &&
    imageBytesAreValid &&
    input.inspection.format === candidate.imageFormat &&
    input.inspection.width === candidate.width &&
    input.inspection.height === candidate.height
  const imageSizeIsAcceptable =
    imageBytesAreValid &&
    (input.inspection.width ?? 0) >= MIN_IMAGE_WIDTH &&
    (input.inspection.height ?? 0) >= MIN_IMAGE_HEIGHT
  const minimumPayloadBytes = getMinimumImageByteLength(
    input.inspection.width,
    input.inspection.height
  )
  const bitmapPayloadIsSubstantial =
    imageBytesAreValid && input.inspection.byteLength >= minimumPayloadBytes
  const candidateWorldBinding = candidateBindsWorld(
    candidate,
    input.generationCondition
  )
  const candidateConditionBinding = candidateBindsGenerationCondition(
    candidate,
    input.generationCondition
  )
  const candidateSourceKind = candidateUsesFormalSourceKind(candidate)
  const candidateGenerationRequest = candidateBindsGenerationRequest(
    candidate,
    input.generationCondition,
    request
  )
  const candidateKeepsFactLinks = candidateBindsFactLinks(
    candidate,
    input.factManifest,
    input.generationCondition
  )
  const candidateSourceChannelsMatchFacts =
    candidateSourceChannelsSatisfyRequiredFacts(
      candidate,
      input.generationCondition
    )
  const candidateHasAllowedLicense =
    candidate !== null &&
    candidate.originalityConfirmed &&
    isApprovedLicense(candidate.license)

  return [
    check(
      "ai_image_candidate_metadata",
      hasCandidateMetadata,
      hasCandidateMetadata ? 90 : 0,
      "AI 位图候选图元数据",
      "AI image candidate metadata",
      hasCandidateMetadata
        ? "候选图元数据存在，并声明为合格尺寸的 PNG/WebP/JPG。"
        : "候选图元数据缺失，或格式/尺寸不符合 MVP 展示要求。",
      hasCandidateMetadata
        ? "Candidate metadata exists and declares a PNG/WebP/JPG at the required size."
        : "Candidate metadata is missing or its format/size does not meet MVP display requirements."
    ),
    check(
      "real_image_bytes",
      imageBytesAreValid,
      imageBytesAreValid ? 94 : 0,
      "真实图片本体",
      "Real image bytes",
      imageBytesAreValid
        ? `已读取真实图片本体，Content-Type ${input.inspection.contentType}，格式 ${input.inspection.format}，尺寸 ${input.inspection.width}x${input.inspection.height}。`
        : input.inspection.errorZh ?? "无法读取真实图片本体。",
      imageBytesAreValid
        ? `Real image bytes were read with Content-Type ${input.inspection.contentType}, as ${input.inspection.format}, ${input.inspection.width}x${input.inspection.height}.`
        : input.inspection.error ?? "Real image bytes could not be read."
    ),
    check(
      "image_byte_fingerprint",
      imageHasByteFingerprint,
      imageHasByteFingerprint ? 92 : 0,
      "图片字节指纹",
      "Image byte fingerprint",
      imageHasByteFingerprint
        ? `已生成图片本体 sha256 指纹：${input.inspection.sha256}。`
        : "无法生成图片本体 sha256 指纹，不能证明审核对象稳定。",
      imageHasByteFingerprint
        ? `Image byte sha256 fingerprint generated: ${input.inspection.sha256}.`
        : "Image byte sha256 fingerprint could not be generated, so the reviewed object cannot be proven stable."
    ),
    check(
      "image_metadata_matches_bytes",
      imageMatchesMetadata,
      imageMatchesMetadata ? 92 : 0,
      "图片声明与本体一致",
      "Image metadata matches bytes",
      imageMatchesMetadata
        ? "候选图声明的格式和尺寸与图片本体一致。"
        : "候选图声明的格式或尺寸与图片本体不一致。",
      imageMatchesMetadata
        ? "The declared format and dimensions match the actual image bytes."
        : "The declared format or dimensions do not match the actual image bytes."
    ),
    check(
      "mvp_image_size",
      imageSizeIsAcceptable,
      imageSizeIsAcceptable ? 90 : 0,
      "MVP 图片尺寸",
      "MVP image size",
      imageSizeIsAcceptable
        ? "图片本体达到 MVP 静态世界画面的最低尺寸要求。"
        : `图片本体必须至少达到 ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}。`,
      imageSizeIsAcceptable
        ? "The image bytes meet the minimum MVP static world frame size."
        : `The image bytes must be at least ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}.`
    ),
    check(
      "bitmap_payload_quality",
      bitmapPayloadIsSubstantial,
      bitmapPayloadIsSubstantial ? 86 : 0,
      "图片本体基础文件质量",
      "Bitmap payload file gate",
      bitmapPayloadIsSubstantial
        ? `图片本体有效载荷达到 VJ-0 文件门槛：${input.inspection.byteLength} bytes。此项不代表画面美观、像素风、构图、水印或语义版权安全通过。`
        : `图片本体有效载荷过低：${input.inspection.byteLength} bytes，最低要求 ${minimumPayloadBytes} bytes。`,
      bitmapPayloadIsSubstantial
        ? `The image payload passes the VJ-0 file gate: ${input.inspection.byteLength} bytes. This does not prove visual beauty, pixel style, composition, watermark absence, or semantic copyright safety.`
        : `The image payload is too small: ${input.inspection.byteLength} bytes, minimum ${minimumPayloadBytes} bytes.`
    ),
    check(
      "candidate_world_binding",
      candidateWorldBinding,
      candidateWorldBinding ? 96 : 0,
      "候选图世界绑定",
      "Candidate world binding",
      candidateWorldBinding
        ? "候选图绑定了当前 worldId 与 tick。"
        : "候选图缺少当前 worldId 或 tick 绑定。",
      candidateWorldBinding
        ? "The candidate binds the current worldId and tick."
        : "The candidate is missing current worldId or tick binding."
    ),
    check(
      "candidate_condition_binding",
      candidateConditionBinding,
      candidateConditionBinding ? 96 : 0,
      "候选图条件绑定",
      "Candidate condition binding",
      candidateConditionBinding
        ? "候选图绑定了当前 WorldGenerationCondition。"
        : "候选图未绑定当前 WorldGenerationCondition，或安全条件不完整。",
      candidateConditionBinding
        ? "The candidate binds the current WorldGenerationCondition."
        : "The candidate does not bind the current WorldGenerationCondition, or the safety condition is incomplete."
    ),
    check(
      "candidate_source_kind",
      candidateSourceKind,
      candidateSourceKind ? 96 : 0,
      "候选图来源类型",
      "Candidate source kind",
      candidateSourceKind
        ? "候选图来源为 project_model_generated，并绑定内部模型版本。"
        : "受控 MVP ApprovedFrame 只允许 project_model_generated，开发测试资产不能进入正式展示。",
      candidateSourceKind
        ? "The candidate source is project_model_generated and binds an internal model version."
        : "Controlled MVP ApprovedFrame only allows project_model_generated; development test assets cannot enter formal display."
    ),
    check(
      "candidate_generation_request",
      candidateGenerationRequest,
      candidateGenerationRequest ? 96 : 0,
      "候选图生成请求",
      "Candidate generation request",
      candidateGenerationRequest
        ? "候选图绑定了内部模型生成请求。"
        : "候选图缺少内部模型生成请求，或请求与候选图不一致。",
      candidateGenerationRequest
        ? "The candidate binds the internal model generation request."
        : "The candidate is missing the internal model generation request, or the request does not match the candidate."
    ),
    check(
      "candidate_fact_link",
      candidateKeepsFactLinks,
      candidateKeepsFactLinks ? 90 : 0,
      "候选图事实链",
      "Candidate fact links",
      candidateKeepsFactLinks
        ? "候选图保留了当前世界事实来源链。"
        : "候选图缺少当前世界事实来源链。",
      candidateKeepsFactLinks
        ? "The candidate keeps the current world fact links."
        : "The candidate lacks the current world fact links."
    ),
    check(
      "candidate_source_fact_expression_channels",
      candidateSourceChannelsMatchFacts,
      candidateSourceChannelsMatchFacts ? 96 : 0,
      "候选图源结构通道",
      "Candidate source fact-expression channels",
      candidateSourceChannelsMatchFacts
        ? "候选图源样本包含当前世界事实所需的结构通道。"
        : "候选图源样本缺少当前世界事实所需的结构通道，不能用自然图或局部图冒充施工/住所世界画面。",
      candidateSourceChannelsMatchFacts
        ? "The candidate source sample includes the structure channels required by current world facts."
        : "The candidate source sample lacks structure channels required by current world facts, so a nature-only or partial image cannot stand in for a construction/home world frame."
    ),
    check(
      "candidate_license_metadata",
      candidateHasAllowedLicense,
      candidateHasAllowedLicense ? 95 : 0,
      "候选图授权元数据",
      "Candidate license metadata",
      candidateHasAllowedLicense
        ? "候选图授权元数据为自有、CC0 或商业授权，并确认原创。此项只证明来源元数据，不证明 VJ-2 语义版权安全。"
        : "候选图缺少允许使用的授权元数据或原创确认。",
      candidateHasAllowedLicense
        ? "The candidate license metadata is self-owned, CC0, or commercially licensed, with originality confirmed. This proves source metadata only, not VJ-2 semantic copyright safety."
        : "The candidate lacks allowed license metadata or originality confirmation."
    ),
    check(
      "candidate_tags_not_used_as_quality_evidence",
      true,
      100,
      "候选图标签不作为质量证据",
      "Candidate tags are not quality evidence",
      "VJ-0 只检查文件、字节、哈希、尺寸、来源和事实绑定；候选图标签仅作为来源元数据，不作为画面美观、像素风、无水印、构图、世界事实呈现或版权语义安全的通过证据。",
      "VJ-0 only checks files, bytes, hash, dimensions, source, and fact binding. Candidate tags are metadata only and are not pass evidence for beauty, pixel style, watermark absence, composition, world-fact expression, or semantic copyright safety."
    ),
  ]
}

function candidateBindsWorld(
  candidate: WorldVisualAiImageCandidate | null,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  if (!candidate) return false

  const runtimeCandidate = candidate as RuntimeBoundCandidate

  return (
    generationCondition.worldId.length > 0 &&
    Number.isInteger(generationCondition.tick) &&
    generationCondition.tick >= 0 &&
    runtimeCandidate.worldId === generationCondition.worldId &&
    runtimeCandidate.tick === generationCondition.tick &&
    candidate.tags.includes(`world_id:${generationCondition.worldId}`) &&
    candidate.tags.includes(`tick:${generationCondition.tick}`) &&
    candidate.tags.includes("runtime_bound_candidate")
  )
}

function candidateBindsGenerationCondition(
  candidate: WorldVisualAiImageCandidate | null,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  return (
    candidate !== null &&
    candidate.conditionId === generationCondition.conditionId &&
    candidate.modelVersion === generationCondition.modelVersion &&
    generationCondition.canShowToPlayer === false &&
    generationCondition.safetyCondition.preserveWorldFacts === true &&
    generationCondition.safetyCondition.requireVisualJudge === true &&
    generationCondition.safetyCondition.forbidProgrammaticFinalFrame === true &&
    generationCondition.safetyCondition.forbidPlaceholderFrame === true &&
    generationCondition.safetyCondition.forbidUnlicensedCopy === true
  )
}

function candidateUsesFormalSourceKind(
  candidate: WorldVisualAiImageCandidate | null
): boolean {
  return (
    candidate !== null &&
    candidate.sourceKind === "project_model_generated" &&
    typeof candidate.modelVersion === "string" &&
    candidate.modelVersion.length > 0 &&
    !candidate.tags.includes("development_test_asset")
  )
}

function candidateBindsGenerationRequest(
  candidate: WorldVisualAiImageCandidate | null,
  generationCondition: WorldVisualGenerationCondition,
  request: WorldVisualAiImageGenerationRequest | null
): boolean {
  return (
    candidate !== null &&
    request !== null &&
    request.canShowToPlayer === false &&
    request.modelVersion === candidate.modelVersion &&
    request.condition.conditionId === generationCondition.conditionId &&
    request.condition.worldId === generationCondition.worldId &&
    request.condition.tick === generationCondition.tick &&
    request.condition.modelVersion === generationCondition.modelVersion &&
    request.condition.canShowToPlayer === false &&
    sameStringSet(request.condition.sourceFactIds, generationCondition.sourceFactIds) &&
    request.output.width === candidate.width &&
    request.output.height === candidate.height &&
    request.output.imageFormat === candidate.imageFormat
  )
}

function candidateBindsFactLinks(
  candidate: WorldVisualAiImageCandidate | null,
  factManifest: WorldVisualFactManifest,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  if (!candidate) return false
  if (factManifest.worldId !== generationCondition.worldId) return false
  if (factManifest.tick !== generationCondition.tick) return false
  if (!sameStringSet(candidate.sourceFactIds, factManifest.sourceFactIds)) return false
  if (!sameStringSet(candidate.sourceFactIds, generationCondition.sourceFactIds)) return false

  return true
}

function candidateSourceChannelsSatisfyRequiredFacts(
  candidate: WorldVisualAiImageCandidate | null,
  generationCondition: WorldVisualGenerationCondition
): boolean {
  if (!candidate) return false

  const requiredGroups = buildRequiredSourceChannelGroups(generationCondition)
  if (requiredGroups.length === 0) return true

  if (!candidate.tags.includes("source_fact_expression_gate:passed")) return false

  const sourceChannels = new Set(
    candidate.tags
      .filter((tag) => tag.startsWith("source_active_channel:"))
      .map((tag) => tag.slice("source_active_channel:".length))
  )

  return requiredGroups.every((group) =>
    group.channels.some((channel) => sourceChannels.has(channel))
  )
}

function buildRequiredSourceChannelGroups(
  generationCondition: WorldVisualGenerationCondition
): Array<{ id: string; channels: string[] }> {
  if (generationCondition.sceneCondition.sceneType !== "forest_construction_clearing") {
    return []
  }

  return [
    { id: "natural_ground", channels: ["grass"] },
    { id: "readable_path", channels: ["road_center", "road_edge", "walkable"] },
    {
      id: "construction_core",
      channels: ["shelter_foundation", "shelter_wall", "shelter_roof"],
    },
    { id: "construction_materials", channels: ["construction_material"] },
  ]
}

function getMinimumImageByteLength(
  width: number | null,
  height: number | null
): number {
  const pixelCount = Math.max(0, width ?? 0) * Math.max(0, height ?? 0)
  const megapixels = pixelCount / 1_000_000
  const scaledMinimum = Math.ceil(megapixels * MIN_IMAGE_BYTES_PER_MEGAPIXEL)

  return Math.max(MIN_IMAGE_BYTES, scaledMinimum)
}

async function inspectCandidateImage(
  candidate: WorldVisualAiImageCandidate | null
): Promise<ImageInspectionResult> {
  if (!candidate) {
    return failedInspection("缺少 AI 位图候选图。", "AI bitmap candidate is missing.")
  }

  const bytesResult = await readCandidateImageBytes(candidate.imageUrl)
  if (!bytesResult.ok) return bytesResult

  if (bytesResult.byteLength <= 0) {
    return failedInspection(
      "候选图片为空字节，不能进入 VisualJudge。",
      "Candidate image has empty bytes and cannot enter VisualJudge.",
      bytesResult.contentType,
      bytesResult.byteLength
    )
  }

  if (bytesResult.byteLength > MAX_IMAGE_BYTES) {
    return failedInspection(
      "候选图片过大，当前 MVP 审核拒绝超过 16MB 的图片。",
      "Candidate image is too large. MVP review rejects images above 16MB.",
      bytesResult.contentType,
      bytesResult.byteLength
    )
  }

  const parsed = parseImageBytes(bytesResult.bytes)
  if (!parsed) {
    return failedInspection(
      "候选图不是可识别的 PNG、JPG 或 WebP 位图。",
      "Candidate is not a recognized PNG, JPG, or WebP bitmap.",
      bytesResult.contentType,
      bytesResult.byteLength
    )
  }

  if (!bytesResult.contentType) {
    return failedInspection(
      "候选图缺少明确的图片 Content-Type。",
      "Candidate image is missing an explicit image Content-Type.",
      null,
      bytesResult.byteLength
    )
  }

  if (!isAllowedContentType(bytesResult.contentType, parsed.format)) {
    return failedInspection(
      `候选图 Content-Type 不合格：${bytesResult.contentType}。`,
      `Candidate Content-Type is not allowed: ${bytesResult.contentType}.`,
      bytesResult.contentType,
      bytesResult.byteLength
    )
  }

  return {
    ok: true,
    format: parsed.format,
    width: parsed.width,
    height: parsed.height,
    contentType: bytesResult.contentType,
    byteLength: bytesResult.byteLength,
    sha256: createHash("sha256").update(bytesResult.bytes).digest("hex"),
    error: null,
    errorZh: null,
    bytes: bytesResult.bytes,
  }
}

async function readCandidateImageBytes(
  imageUrl: string
): Promise<
  | (ImageInspectionResult & { ok: false })
  | {
      ok: true
      bytes: Uint8Array
      contentType: string | null
      byteLength: number
    }
> {
  if (imageUrl.startsWith("data:")) return readDataUrlBytes(imageUrl)

  let url: URL
  try {
    url = new URL(imageUrl)
  } catch {
    return failedInspection(
      "候选图 imageUrl 不是有效 URL。",
      "Candidate imageUrl is not a valid URL."
    )
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return failedInspection(
      "候选图只允许 http、https 或 data:image URL。",
      "Candidate image URL may only use http, https, or data:image."
    )
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      return failedInspection(
        `候选图无法访问，HTTP 状态：${response.status}。`,
        `Candidate image is not reachable. HTTP status: ${response.status}.`
      )
    }

    const contentType = normalizeContentType(response.headers.get("content-type"))
    if (!contentType || isForbiddenContentType(contentType)) {
      return failedInspection(
        `候选图 Content-Type 被禁止：${contentType ?? "unknown"}。`,
        `Candidate Content-Type is forbidden: ${contentType ?? "unknown"}.`,
        contentType
      )
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    return { ok: true, bytes, contentType, byteLength: bytes.byteLength }
  } catch (error) {
    return failedInspection(
      `读取候选图失败：${error instanceof Error ? error.message : String(error)}`,
      `Reading candidate image failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function readDataUrlBytes(
  imageUrl: string
): ReturnType<typeof readCandidateImageBytes> {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(imageUrl)
  if (!match) {
    return Promise.resolve(
      failedInspection("候选图 data URL 格式无效。", "Candidate data URL is invalid.")
    )
  }

  const contentType = normalizeContentType(match[1])
  if (
    !contentType ||
    !contentType.startsWith("image/") ||
    isForbiddenContentType(contentType)
  ) {
    return Promise.resolve(
      failedInspection(
        `候选图 data URL Content-Type 被禁止：${contentType ?? "unknown"}。`,
        `Candidate data URL Content-Type is forbidden: ${contentType ?? "unknown"}.`,
        contentType
      )
    )
  }

  try {
    const encoded = match[3]
    const bytes = match[2]
      ? Buffer.from(encoded, "base64")
      : Buffer.from(decodeURIComponent(encoded), "utf8")

    return Promise.resolve({
      ok: true,
      bytes: new Uint8Array(bytes),
      contentType,
      byteLength: bytes.byteLength,
    })
  } catch {
    return Promise.resolve(
      failedInspection(
        "候选图 data URL 解码失败。",
        "Candidate data URL decoding failed.",
        contentType
      )
    )
  }
}

function parseImageBytes(
  bytes: Uint8Array
): { format: WorldVisualAiImageCandidate["imageFormat"]; width: number; height: number } | null {
  const png = parsePngDimensions(bytes)
  if (png) return { format: "png", ...png }

  const jpg = parseJpegDimensions(bytes)
  if (jpg) return { format: "jpg", ...jpg }

  const webp = parseWebpDimensions(bytes)
  if (webp) return { format: "webp", ...webp }

  return null
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null

  return { width: readUint32Be(bytes, 16), height: readUint32Be(bytes, 20) }
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    const length = readUint16Be(bytes, offset + 2)
    if (length < 2) return null

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: readUint16Be(bytes, offset + 5),
        width: readUint16Be(bytes, offset + 7),
      }
    }

    offset += 2 + length
  }

  return null
}

function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") return null

  const chunk = readAscii(bytes, 12, 4)
  if (chunk === "VP8X") {
    return { width: 1 + readUint24Le(bytes, 24), height: 1 + readUint24Le(bytes, 27) }
  }
  if (chunk === "VP8 ") {
    return { width: readUint16Le(bytes, 26) & 0x3fff, height: readUint16Le(bytes, 28) & 0x3fff }
  }
  if (chunk === "VP8L") {
    const b0 = bytes[21]
    const b1 = bytes[22]
    const b2 = bytes[23]
    const b3 = bytes[24]
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    }
  }

  return null
}

function isApprovedImageFormat(
  imageFormat: WorldVisualAiImageCandidate["imageFormat"]
): boolean {
  return imageFormat === "png" || imageFormat === "webp" || imageFormat === "jpg"
}

function isApprovedLicense(
  license: WorldVisualAiImageCandidate["license"]
): boolean {
  return license === "self_owned" || license === "cc0" || license === "commercial_license"
}

function isAllowedContentType(
  contentType: string | null,
  format: WorldVisualAiImageCandidate["imageFormat"]
): boolean {
  if (!contentType) return false
  if (format === "png") return contentType === "image/png"
  if (format === "jpg") return contentType === "image/jpeg"
  return contentType === "image/webp"
}

function isForbiddenContentType(contentType: string): boolean {
  return (
    contentType.includes("svg") ||
    contentType.startsWith("text/") ||
    contentType.includes("html") ||
    contentType.includes("json") ||
    contentType.includes("xml")
  )
}

function normalizeContentType(contentType: string | null): string | null {
  return contentType?.split(";")[0]?.trim().toLowerCase() || null
}

function failedInspection(
  errorZh: string,
  error: string,
  contentType: string | null = null,
  byteLength = 0
): ImageInspectionResult & { ok: false } {
  return {
    ok: false,
    format: null,
    width: null,
    height: null,
    contentType,
    byteLength,
    sha256: null,
    error,
    errorZh,
    bytes: null,
  }
}

function check(
  id: string,
  passed: boolean,
  score: number,
  zhLabel: string,
  enLabel: string,
  zhEvidence: string,
  enEvidence: string
): WorldVisualReviewCheck {
  return {
    id,
    passed,
    score,
    label: { zh: zhLabel, en: enLabel },
    evidence: { zh: zhEvidence, en: enEvidence },
    tags: [id, passed ? "passed" : "failed"],
  }
}

function notImplementedCheck(
  id: "vj_2_not_implemented",
  zhLabel: string,
  enLabel: string,
  zhEvidence: string,
  enEvidence: string
): WorldVisualReviewCheck {
  return {
    id,
    passed: false,
    score: 0,
    label: { zh: zhLabel, en: enLabel },
    evidence: { zh: zhEvidence, en: enEvidence },
    tags: [id, "not_implemented", "not_production_approval"],
  }
}

function buildFixInstructions(
  checks: WorldVisualReviewCheck[]
): WorldVisualReviewReport["fixInstructions"] {
  return checks
    .filter((check) => !check.passed)
    .map((check) => ({
      zh: `修正 ${check.label.zh}：${check.evidence.zh}`,
      en: `Fix ${check.label.en}: ${check.evidence.en}`,
    }))
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function readUint16Be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint24Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  )
}
