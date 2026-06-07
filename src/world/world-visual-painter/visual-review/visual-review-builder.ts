import { Buffer } from "node:buffer"

import type {
  WorldVisualAiImageCandidate,
  WorldVisualFactManifest,
  WorldVisualReviewCheck,
  WorldVisualReviewReport,
} from "../world-visual-painter-schema"
import { WORLD_VISUAL_MVP_TARGET_POLICY } from "../visual-target-policy"

const MIN_IMAGE_WIDTH = 1024
const MIN_IMAGE_HEIGHT = 768
const MIN_IMAGE_BYTES = 24 * 1024
const MIN_IMAGE_BYTES_PER_MEGAPIXEL = 12 * 1024
const MAX_IMAGE_BYTES = 16 * 1024 * 1024
const FETCH_TIMEOUT_MS = 8000

const REQUIRED_STYLE_QUALITY_TAGS = [
  "bright_healing_detailed_top_down_pixel_style",
  "clear_world_focal_point",
] as const

const REQUIRED_WORLD_STRUCTURE_TAGS = [
  "terrain_layer_depth",
  "path_logic",
  "natural_boundary",
  "material_construction_relation",
] as const

const REQUIRED_ARTIFACT_REJECTION_TAGS = [
  "no_placeholder_blocks",
  "no_dirty_paths",
  "no_random_scatter",
  "no_garbled_text",
  "no_watermark",
  "no_ui_card",
] as const

const REQUIRED_FACT_AND_RIGHTS_TAGS = [
  "no_added_world_facts",
  "copyright_safe",
] as const

type ImageInspectionResult = {
  ok: boolean
  format: WorldVisualAiImageCandidate["imageFormat"] | null
  width: number | null
  height: number | null
  contentType: string | null
  byteLength: number
  error: string | null
  errorZh: string | null
}

export async function buildWorldVisualReviewReport(input: {
  factManifest: WorldVisualFactManifest
  aiImageCandidate: WorldVisualAiImageCandidate | null
}): Promise<WorldVisualReviewReport> {
  const inspection = await inspectCandidateImage(input.aiImageCandidate)
  const checks = buildReviewChecks({ ...input, inspection })
  const score = Math.round(
    checks.reduce((sum, check) => sum + check.score, 0) / checks.length
  )
  const status = checks.every((check) => check.passed)
    ? "passed_candidate"
    : "failed"

  return {
    status,
    canShowToPlayer: false,
    reason:
      status === "passed_candidate"
        ? {
            zh: "AI 位图候选图通过视觉审核，可进入 ApprovedFrame 构建；在 ApprovedFrame 生成前仍禁止展示。",
            en: "The AI bitmap candidate passed Visual Judge and may enter ApprovedFrame building. It remains hidden until ApprovedFrame exists.",
          }
        : {
            zh: "视觉审核未通过：候选图缺失、图片本体无效、格式伪装、尺寸不合格、事实链缺失、授权不合格或缺少正式视觉质量证明，因此禁止展示。",
            en: "Visual review failed: the candidate is missing, the image bytes are invalid, the format is spoofed, the size is invalid, fact links are incomplete, license confirmation is missing, or formal visual quality proof is incomplete.",
          },
    score,
    checks,
    requiredChecks: [
      {
        zh: "必须有 AI 图像生成模型或授权导入流程产出的 PNG/WebP/JPG 位图候选图。",
        en: "A PNG/WebP/JPG bitmap candidate from an AI image model or authorized import flow is required.",
      },
      {
        zh: "候选图必须能读取真实图片本体，禁止 SVG、HTML、JSON、文本或格式伪装文件。",
        en: "The candidate must expose real image bytes. SVG, HTML, JSON, text, and spoofed files are forbidden.",
      },
      {
        zh: "候选图图片本体必须达到基础有效载荷体量，禁止极低字节量的空白图、占位图或伪装压缩图。",
        en: "The candidate image payload must be substantial enough. Tiny blank images, placeholders, or spoofed compressed images are forbidden.",
      },
      {
        zh: "候选图必须符合明亮、治愈、精细、俯视像素风，并具有清晰世界主焦点。",
        en: "The candidate must match a bright, healing, detailed top-down pixel style with a clear world focal point.",
      },
      {
        zh: "候选图必须具备地形层次、路径逻辑、自然边界、材料/施工关系。",
        en: "The candidate must include terrain layering, path logic, natural boundaries, and material/construction relationships.",
      },
      {
        zh: "候选图不得出现占位块、脏路径、随机散点、乱码、水印或 UI 卡片。",
        en: "The candidate must not contain placeholder blocks, dirty paths, random scatter, garbled text, watermarks, or UI cards.",
      },
      {
        zh: "候选图不能新增世界事实，不能复制未授权第三方作品，只能使用授权数据或抽象设计原则。",
        en: "The candidate must not add world facts or copy unlicensed third-party work, and may only use licensed data or abstract design principles.",
      },
      WORLD_VISUAL_MVP_TARGET_POLICY.displayGate,
    ],
    fixInstructions: buildFixInstructions(checks),
    tags: [
      "visual_review",
      status,
      "real_image_bytes_required",
      "visual_quality_assertions_required",
      "ai_bitmap_candidate_required",
      "display_blocked_until_approved_frame",
      "no_programmatic_renderer",
    ],
  }
}

function buildReviewChecks(input: {
  factManifest: WorldVisualFactManifest
  aiImageCandidate: WorldVisualAiImageCandidate | null
  inspection: ImageInspectionResult
}): WorldVisualReviewCheck[] {
  const candidate = input.aiImageCandidate
  const hasCandidateMetadata =
    Boolean(candidate) &&
    candidate?.canShowToPlayer === false &&
    candidate.width >= MIN_IMAGE_WIDTH &&
    candidate.height >= MIN_IMAGE_HEIGHT &&
    ["png", "webp", "jpg"].includes(candidate.imageFormat)
  const candidateHasAllowedLicense =
    candidate === null
      ? false
      : candidate.originalityConfirmed &&
        ["self_owned", "cc0", "commercial_license"].includes(candidate.license)
  const candidateKeepsFactLinks =
    candidate === null
      ? false
      : candidate.promptPackageId.length > 0 &&
        candidate.sourceFactIds.length === input.factManifest.sourceFactIds.length
  const imageBytesAreValid = input.inspection.ok
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
  const styleQuality = buildTagGroupResult(
    candidate,
    REQUIRED_STYLE_QUALITY_TAGS
  )
  const worldStructureQuality = buildTagGroupResult(
    candidate,
    REQUIRED_WORLD_STRUCTURE_TAGS
  )
  const artifactRejectionQuality = buildTagGroupResult(
    candidate,
    REQUIRED_ARTIFACT_REJECTION_TAGS
  )
  const factAndRightsQuality = buildTagGroupResult(
    candidate,
    REQUIRED_FACT_AND_RIGHTS_TAGS
  )

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
        ? `已读取真实图片本体，格式 ${input.inspection.format}，尺寸 ${input.inspection.width}x${input.inspection.height}。`
        : input.inspection.errorZh ?? "无法读取真实图片本体。",
      imageBytesAreValid
        ? `Real image bytes were read as ${input.inspection.format}, ${input.inspection.width}x${input.inspection.height}.`
        : input.inspection.error ?? "Real image bytes could not be read."
    ),
    check(
      "image_metadata_matches_bytes",
      imageMatchesMetadata,
      imageMatchesMetadata ? 92 : 0,
      "图片声明与本体一致",
      "Image metadata matches bytes",
      imageMatchesMetadata
        ? "候选图声明的格式和尺寸与图片本体一致。"
        : "候选图声明的格式或尺寸与图片本体不一致，可能是伪装文件或错误结果。",
      imageMatchesMetadata
        ? "The declared format and dimensions match the actual image bytes."
        : "The declared format or dimensions do not match the actual image bytes, which may indicate spoofing or a bad result."
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
      "图片本体基础质量",
      "Bitmap payload quality",
      bitmapPayloadIsSubstantial
        ? `图片本体有效载荷达到基础质量门槛：${input.inspection.byteLength} bytes。`
        : `图片本体有效载荷过低：${input.inspection.byteLength} bytes，最低要求 ${minimumPayloadBytes} bytes。可能是空白图、占位图或伪装压缩图。`,
      bitmapPayloadIsSubstantial
        ? `The image payload passes the baseline quality gate: ${input.inspection.byteLength} bytes.`
        : `The image payload is too small: ${input.inspection.byteLength} bytes, minimum ${minimumPayloadBytes} bytes. It may be a blank image, placeholder, or spoofed compressed result.`
    ),
    check(
      "candidate_fact_link",
      candidateKeepsFactLinks,
      candidateKeepsFactLinks ? 90 : 0,
      "候选图事实链",
      "Candidate fact links",
      candidateKeepsFactLinks
        ? "候选图保留了世界事实和 Prompt Package 来源链。"
        : "候选图缺少世界事实或 Prompt Package 来源链。",
      candidateKeepsFactLinks
        ? "The candidate keeps world fact and prompt package links."
        : "The candidate lacks world fact or prompt package links."
    ),
    check(
      "candidate_license",
      candidateHasAllowedLicense,
      candidateHasAllowedLicense ? 95 : 0,
      "候选图授权",
      "Candidate license",
      candidateHasAllowedLicense
        ? "候选图已确认自有、CC0 或商业授权，并确认不是直接复制未授权作品。"
        : "候选图缺少允许使用的授权确认，不能进入 ApprovedFrame。",
      candidateHasAllowedLicense
        ? "The candidate is confirmed as self-owned, CC0, or commercially licensed, and not a direct copy of an unlicensed work."
        : "The candidate lacks allowed license confirmation and cannot enter ApprovedFrame."
    ),
    check(
      "visual_style_quality",
      styleQuality.passed,
      styleQuality.passed ? 88 : 0,
      "视觉风格质量",
      "Visual style quality",
      styleQuality.passed
        ? "候选图声明满足明亮、治愈、精细、俯视像素风，并具有清晰世界主焦点。"
        : `候选图缺少视觉风格质量证明：${styleQuality.missingTags.join(", ")}。`,
      styleQuality.passed
        ? "The candidate declares bright, healing, detailed top-down pixel style and a clear world focal point."
        : `The candidate is missing visual style quality proof: ${styleQuality.missingTags.join(", ")}.`
    ),
    check(
      "world_structure_quality",
      worldStructureQuality.passed,
      worldStructureQuality.passed ? 88 : 0,
      "世界结构质量",
      "World structure quality",
      worldStructureQuality.passed
        ? "候选图声明具备地形层次、路径逻辑、自然边界、材料/施工关系。"
        : `候选图缺少世界结构质量证明：${worldStructureQuality.missingTags.join(", ")}。`,
      worldStructureQuality.passed
        ? "The candidate declares terrain layering, path logic, natural boundaries, and material/construction relationships."
        : `The candidate is missing world structure quality proof: ${worldStructureQuality.missingTags.join(", ")}.`
    ),
    check(
      "visual_artifact_rejection",
      artifactRejectionQuality.passed,
      artifactRejectionQuality.passed ? 90 : 0,
      "视觉污染排除",
      "Visual artifact rejection",
      artifactRejectionQuality.passed
        ? "候选图声明没有占位块、脏路径、随机散点、乱码、水印或 UI 卡片。"
        : `候选图缺少视觉污染排除证明：${artifactRejectionQuality.missingTags.join(", ")}。`,
      artifactRejectionQuality.passed
        ? "The candidate declares no placeholder blocks, dirty paths, random scatter, garbled text, watermarks, or UI cards."
        : `The candidate is missing visual artifact rejection proof: ${artifactRejectionQuality.missingTags.join(", ")}.`
    ),
    check(
      "fact_and_rights_quality",
      factAndRightsQuality.passed,
      factAndRightsQuality.passed ? 92 : 0,
      "事实与版权安全",
      "Fact and rights safety",
      factAndRightsQuality.passed
        ? "候选图声明没有新增世界事实，并满足版权安全要求。"
        : `候选图缺少事实与版权安全证明：${factAndRightsQuality.missingTags.join(", ")}。`,
      factAndRightsQuality.passed
        ? "The candidate declares no added world facts and satisfies copyright safety requirements."
        : `The candidate is missing fact and rights safety proof: ${factAndRightsQuality.missingTags.join(", ")}.`
    ),
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
      "候选图不是可识别的 PNG、JPG 或 WebP 位图，可能是 SVG、HTML、JSON、文本或伪装文件。",
      "Candidate is not a recognized PNG, JPG, or WebP bitmap. It may be SVG, HTML, JSON, text, or a spoofed file.",
      bytesResult.contentType,
      bytesResult.byteLength
    )
  }

  if (!isAllowedContentType(bytesResult.contentType, parsed.format)) {
    return failedInspection(
      `候选图 Content-Type 不合格：${bytesResult.contentType ?? "unknown"}。`,
      `Candidate Content-Type is not allowed: ${bytesResult.contentType ?? "unknown"}.`,
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
    error: null,
    errorZh: null,
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
  if (imageUrl.startsWith("data:")) {
    return readDataUrlBytes(imageUrl)
  }

  let url: URL
  try {
    url = new URL(imageUrl)
  } catch {
    return failedInspection(
      "候选图 imageUrl 不是有效 URL。",
      "Candidate imageUrl is not a valid URL."
    )
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return failedInspection(
      "候选图只允许 http、https 或 data:image URL，禁止本地文件路径。",
      "Candidate image URL may only use http, https, or data:image. Local file paths are forbidden."
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
    if (contentType && isForbiddenContentType(contentType)) {
      return failedInspection(
        `候选图 Content-Type 被禁止：${contentType}。`,
        `Candidate Content-Type is forbidden: ${contentType}.`,
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
  if (!contentType || isForbiddenContentType(contentType)) {
    return Promise.resolve(
      failedInspection(
        `候选图 data URL Content-Type 被禁止：${contentType ?? "unknown"}。`,
        `Candidate data URL Content-Type is forbidden: ${contentType ?? "unknown"}.`,
        contentType
      )
    )
  }

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
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) {
    return null
  }

  return {
    width: readUint32Be(bytes, 16),
    height: readUint32Be(bytes, 20),
  }
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
  if (
    bytes.length < 30 ||
    readAscii(bytes, 0, 4) !== "RIFF" ||
    readAscii(bytes, 8, 4) !== "WEBP"
  ) {
    return null
  }

  const chunk = readAscii(bytes, 12, 4)
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + readUint24Le(bytes, 24),
      height: 1 + readUint24Le(bytes, 27),
    }
  }

  if (chunk === "VP8 " && bytes.length >= 30) {
    return {
      width: readUint16Le(bytes, 26) & 0x3fff,
      height: readUint16Le(bytes, 28) & 0x3fff,
    }
  }

  if (chunk === "VP8L" && bytes.length >= 25) {
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

function isAllowedContentType(
  contentType: string | null,
  format: WorldVisualAiImageCandidate["imageFormat"]
): boolean {
  if (!contentType) return true
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
    error,
    errorZh,
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

function buildTagGroupResult(
  candidate: WorldVisualAiImageCandidate | null,
  requiredTags: readonly string[]
): { passed: boolean; missingTags: string[] } {
  const candidateTags = new Set(candidate?.tags ?? [])
  const missingTags = requiredTags.filter((tag) => !candidateTags.has(tag))

  return {
    passed: missingTags.length === 0,
    missingTags,
  }
}

function buildFixInstructions(
  checks: WorldVisualReviewCheck[]
): WorldVisualReviewReport["fixInstructions"] {
  return checks
    .filter((check) => !check.passed)
    .map((check) => {
      if (check.id === "ai_image_candidate_metadata") {
        return {
          zh: "接入 AI 图像生成模型或授权导入流程，并要求返回完整候选图元数据。",
          en: "Connect an AI image model or authorized import flow and require complete candidate metadata.",
        }
      }

      if (check.id === "real_image_bytes") {
        return {
          zh: "重新生成或导入真实 PNG/WebP/JPG 位图，禁止 SVG、HTML、JSON、文本或占位结果。",
          en: "Regenerate or import a real PNG/WebP/JPG bitmap. SVG, HTML, JSON, text, and placeholder results are forbidden.",
        }
      }

      if (check.id === "image_metadata_matches_bytes") {
        return {
          zh: "修正图像生成模型返回值，确保声明的格式和尺寸与图片本体一致。",
          en: "Fix the image generation model response so declared format and dimensions match the actual image bytes.",
        }
      }

      if (check.id === "mvp_image_size") {
        return {
          zh: `重新生成至少 ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT} 的静态世界画面。`,
          en: `Regenerate a static world frame of at least ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}.`,
        }
      }

      if (check.id === "bitmap_payload_quality") {
        return {
          zh: "重新生成真实、有细节、有足够信息量的 PNG/WebP/JPG 位图，禁止极低字节量空白图、占位图或伪装压缩图。",
          en: "Regenerate a real, detailed PNG/WebP/JPG bitmap with enough information payload. Tiny blank images, placeholders, and spoofed compressed results are forbidden.",
        }
      }

      if (check.id === "candidate_fact_link") {
        return {
          zh: "候选图必须绑定 sourceFactIds 和 promptPackageId，不能脱离世界事实。",
          en: "The candidate must bind sourceFactIds and promptPackageId, and must not detach from world facts.",
        }
      }

      if (check.id === "candidate_license") {
        return {
          zh: "候选图必须确认来源为自有、CC0 或商业授权，并确认没有直接复制未授权第三方作品。",
          en: "The candidate must be confirmed as self-owned, CC0, or commercially licensed, and must not directly copy unlicensed third-party work.",
        }
      }

      if (check.id === "visual_style_quality") {
        return {
          zh: "候选图必须补齐明亮治愈、精细俯视像素风、清晰世界主焦点等视觉风格质量证明。",
          en: "The candidate must provide proof for bright healing detailed top-down pixel style and clear world focal point.",
        }
      }

      if (check.id === "world_structure_quality") {
        return {
          zh: "候选图必须补齐地形层次、路径逻辑、自然边界、材料/施工关系等世界结构质量证明。",
          en: "The candidate must provide proof for terrain layering, path logic, natural boundaries, and material/construction relationships.",
        }
      }

      if (check.id === "visual_artifact_rejection") {
        return {
          zh: "候选图必须补齐无占位块、无脏路径、无随机散点、无乱码、无水印、无 UI 卡片等污染排除证明。",
          en: "The candidate must provide proof that it has no placeholder blocks, dirty paths, random scatter, garbled text, watermarks, or UI cards.",
        }
      }

      if (check.id === "fact_and_rights_quality") {
        return {
          zh: "候选图必须补齐无新增世界事实与版权安全证明。",
          en: "The candidate must provide proof of no added world facts and copyright safety.",
        }
      }

      return {
        zh: `修正 ${check.label.zh}：${check.evidence.zh}`,
        en: `Fix ${check.label.en}: ${check.evidence.en}`,
      }
    })
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