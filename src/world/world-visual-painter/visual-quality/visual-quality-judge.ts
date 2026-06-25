import sharp from "sharp"

import type {
  WorldVisualReviewCheck,
  WorldVisualVj1QualitySummary,
} from "../world-visual-painter-schema"

const SAMPLE_SIZE = 128

const MIN_QUANTIZED_COLOR_COUNT = 120
const MIN_EDGE_DENSITY = 0.12
const MAX_EDGE_DENSITY = 0.72
const MIN_LAPLACIAN_VARIANCE = 220

export async function judgeWorldVisualDeterministicQuality(
  bytes: Uint8Array
): Promise<{ summary: WorldVisualVj1QualitySummary; checks: WorldVisualReviewCheck[] }> {
  try {
    const { data, info } = await sharp(bytes, { failOn: "error" })
      .removeAlpha()
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const metrics = calculateMetrics(data, info.width, info.height, info.channels)
    const checks = buildQualityChecks(metrics)
    const passed = checks.every((check) => check.passed)

    return {
      summary: {
        status: passed ? "vj_1_passed" : "vj_1_failed",
        sampleWidth: info.width,
        sampleHeight: info.height,
        meanLuminance: round(metrics.meanLuminance),
        luminanceStdDev: round(metrics.luminanceStdDev),
        quantizedColorCount: metrics.quantizedColorCount,
        dominantColorRatio: round(metrics.dominantColorRatio),
        edgeDensity: round(metrics.edgeDensity),
        laplacianVariance: round(metrics.laplacianVariance),
        canShowToPlayer: false,
        tags: [
          "vj_1_deterministic_quality",
          passed ? "vj_1_passed" : "vj_1_failed",
          "pixel_bytes_decoded",
          "world_frame_texture_gate",
          "not_player_visible",
        ],
      },
      checks,
    }
  } catch {
    return {
      summary: emptyQualitySummary(),
      checks: [
        qualityCheck(
          "vj_1_pixel_decode",
          false,
          0,
          "像素解码成功",
          "Pixel decoding succeeded",
          "图片无法解码为可计算像素，禁止进入展示链路。",
          "The image could not be decoded into measurable pixels and is blocked from display."
        ),
      ],
    }
  }
}

type QualityMetrics = {
  meanLuminance: number
  luminanceStdDev: number
  quantizedColorCount: number
  dominantColorRatio: number
  edgeDensity: number
  laplacianVariance: number
}

function calculateMetrics(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): QualityMetrics {
  const pixelCount = width * height
  const luminance = new Float64Array(pixelCount)
  const colors = new Map<number, number>()
  let luminanceSum = 0

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * channels
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? red
    const blue = data[offset + 2] ?? red
    const value = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    luminance[index] = value
    luminanceSum += value

    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4)
    colors.set(key, (colors.get(key) ?? 0) + 1)
  }

  const meanLuminance = luminanceSum / pixelCount
  let varianceSum = 0
  for (const value of luminance) varianceSum += (value - meanLuminance) ** 2

  let dominantCount = 0
  for (const count of colors.values()) dominantCount = Math.max(dominantCount, count)

  let edgeCount = 0
  let laplacianSum = 0
  let laplacianSquaredSum = 0
  let interiorCount = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const horizontal = Math.abs(luminance[index + 1] - luminance[index - 1])
      const vertical = Math.abs(luminance[index + width] - luminance[index - width])
      if (Math.sqrt(horizontal ** 2 + vertical ** 2) >= 32) edgeCount += 1

      const laplacian =
        4 * luminance[index] -
        luminance[index - 1] -
        luminance[index + 1] -
        luminance[index - width] -
        luminance[index + width]
      laplacianSum += laplacian
      laplacianSquaredSum += laplacian ** 2
      interiorCount += 1
    }
  }

  const laplacianMean = interiorCount > 0 ? laplacianSum / interiorCount : 0

  return {
    meanLuminance,
    luminanceStdDev: Math.sqrt(varianceSum / pixelCount),
    quantizedColorCount: colors.size,
    dominantColorRatio: dominantCount / pixelCount,
    edgeDensity: interiorCount > 0 ? edgeCount / interiorCount : 0,
    laplacianVariance:
      interiorCount > 0
        ? laplacianSquaredSum / interiorCount - laplacianMean ** 2
        : 0,
  }
}

function buildQualityChecks(metrics: QualityMetrics): WorldVisualReviewCheck[] {
  return [
    qualityCheck(
      "vj_1_brightness",
      metrics.meanLuminance >= 24 && metrics.meanLuminance <= 238,
      100,
      "亮度范围正常",
      "Brightness is in range",
      `平均亮度 ${round(metrics.meanLuminance)}，允许范围 24-238。`,
      `Mean luminance ${round(metrics.meanLuminance)}; allowed range is 24-238.`
    ),
    qualityCheck(
      "vj_1_contrast",
      metrics.luminanceStdDev >= 14,
      100,
      "画面对比度足够",
      "Image contrast is sufficient",
      `亮度标准差 ${round(metrics.luminanceStdDev)}，最低要求 14。`,
      `Luminance standard deviation ${round(metrics.luminanceStdDev)}; minimum is 14.`
    ),
    qualityCheck(
      "vj_1_color_range",
      metrics.quantizedColorCount >= MIN_QUANTIZED_COLOR_COUNT,
      100,
      "颜色层次达到世界画面要求",
      "Color range meets world-frame requirements",
      `量化颜色数 ${metrics.quantizedColorCount}，最低要求 ${MIN_QUANTIZED_COLOR_COUNT}。`,
      `Quantized color count ${metrics.quantizedColorCount}; minimum is ${MIN_QUANTIZED_COLOR_COUNT}.`
    ),
    qualityCheck(
      "vj_1_not_solid_color",
      metrics.dominantColorRatio <= 0.9,
      100,
      "不存在大面积单色占满",
      "No dominant solid-color fill",
      `主色占比 ${round(metrics.dominantColorRatio)}，最高允许 0.9。`,
      `Dominant color ratio ${round(metrics.dominantColorRatio)}; maximum is 0.9.`
    ),
    qualityCheck(
      "vj_1_edge_density",
      metrics.edgeDensity >= MIN_EDGE_DENSITY && metrics.edgeDensity <= MAX_EDGE_DENSITY,
      100,
      "世界画面边缘与纹理密度足够",
      "World-frame edge and texture density is sufficient",
      `边缘密度 ${round(metrics.edgeDensity)}，允许范围 ${MIN_EDGE_DENSITY}-${MAX_EDGE_DENSITY}。`,
      `Edge density ${round(metrics.edgeDensity)}; allowed range is ${MIN_EDGE_DENSITY}-${MAX_EDGE_DENSITY}.`
    ),
    qualityCheck(
      "vj_1_sharpness",
      metrics.laplacianVariance >= MIN_LAPLACIAN_VARIANCE,
      100,
      "画面锐度达到世界画面要求",
      "Image sharpness meets world-frame requirements",
      `拉普拉斯方差 ${round(metrics.laplacianVariance)}，最低要求 ${MIN_LAPLACIAN_VARIANCE}。`,
      `Laplacian variance ${round(metrics.laplacianVariance)}; minimum is ${MIN_LAPLACIAN_VARIANCE}.`
    ),
  ]
}

function qualityCheck(
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
    score: passed ? score : 0,
    label: { zh: zhLabel, en: enLabel },
    evidence: { zh: zhEvidence, en: enEvidence },
    tags: [id, passed ? "passed" : "failed", "vj_1_deterministic_quality"],
  }
}

function emptyQualitySummary(): WorldVisualVj1QualitySummary {
  return {
    status: "vj_1_failed",
    sampleWidth: 0,
    sampleHeight: 0,
    meanLuminance: 0,
    luminanceStdDev: 0,
    quantizedColorCount: 0,
    dominantColorRatio: 1,
    edgeDensity: 0,
    laplacianVariance: 0,
    canShowToPlayer: false,
    tags: ["vj_1_deterministic_quality", "vj_1_failed", "pixel_decode_failed"],
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
