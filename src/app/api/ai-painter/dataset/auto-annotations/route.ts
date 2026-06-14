import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const DATASET_ROOT = path.join(process.cwd(), "data", "ai-painter-datasets")
const AUTO_SCENE_ROOT = path.join(DATASET_ROOT, "accepted", "dataset_v1", "scene", "world")
const REQUIRED_JUDGE_VERSION = "annotation-judge-v1.1"
const REQUIRED_GEOMETRY_VERSION = "geometry-deriver-v1.2"
const CHANNELS = new Set([
  "grass", "water_body", "shoreline", "road_center", "road_edge",
  "tree_trunk", "tree_crown", "rock", "shelter_foundation",
  "shelter_wall", "shelter_roof", "construction_material", "walkable", "depth",
])

type JsonObject = Record<string, unknown>

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止访问训练数据。" }, { status: 403 })
  }
  try {
    const directories = (await readdir(AUTO_SCENE_ROOT, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const scenes = (await Promise.all(directories.map(readAutomaticScene))).filter(Boolean)
    if (!scenes.length) {
      return NextResponse.json({ ok: false, message: "当前没有新版模块 D 自动标注 accepted 样本。请重新运行自动标注流水线。", scenes: [] })
    }
    return NextResponse.json({ ok: true, scenes })
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取模块 D 自动标注结果失败。"
    return NextResponse.json({ ok: false, message, scenes: [] }, { status: 200 })
  }
}

async function readAutomaticScene(sampleId: string) {
  const directory = path.join(AUTO_SCENE_ROOT, sampleId)
  const metadataPath = path.join(directory, "metadata.json")
  const blueprintPath = path.join(directory, "blueprint.json")
  const [metadata, rawBlueprint] = await Promise.all([readJson(metadataPath), readJson(blueprintPath)])
  if (metadata.schemaVersion !== "accepted-training-sample-v1") return null
  if (metadata.status !== "accepted" || metadata.trainingEligible !== true) return null
  const judge = isObject(metadata.judge) ? metadata.judge : {}
  const versions = isObject(metadata.versions) ? metadata.versions : {}
  if (judge.status !== "passed") return null
  if (judge.judgeVersion !== REQUIRED_JUDGE_VERSION) return null
  if (versions.geometry !== REQUIRED_GEOMETRY_VERSION) return null
  return {
    sampleId,
    subtype: "module_d_auto_annotation",
    annotationSource: "module_d_auto",
    imageUrl: `/api/ai-painter/dataset/auto-annotations/${sampleId}/image`,
    blueprint: legacyPlaceholder(sampleId),
    blueprintV1: normalizeBlueprint(sampleId, rawBlueprint),
    blueprintV1Hash: await optionalSha256(blueprintPath),
    targetImageHash: typeof metadata.originalSha256 === "string" ? metadata.originalSha256 : null,
    source: isObject(metadata.source) ? metadata.source : {},
    versions,
    judge,
  }
}

function normalizeBlueprint(sampleId: string, raw: JsonObject) {
  const sourceImage = isObject(raw.sourceImage) ? raw.sourceImage : {}
  const structures = Array.isArray(raw.structures) ? raw.structures : []
  return {
    schemaVersion: "world-blueprint-v1",
    sceneId: sampleId,
    width: 256,
    height: 192,
    seed: 0,
    styleId: "module-d-auto-annotation-v1",
    sourceBlueprintVersion: "module-d-auto-annotation",
    sourceBlueprintHash: typeof sourceImage.sha256 === "string" ? sourceImage.sha256 : undefined,
    requiresManualReview: false,
    manualReviewReasons: [],
    structures: structures.map((item, index) => normalizeStructure(item, index)).filter(Boolean),
  }
}

function normalizeStructure(value: unknown, index: number) {
  if (!isObject(value)) return null
  const type = typeof value.type === "string" ? value.type : ""
  if (!CHANNELS.has(type)) return null
  const geometry = normalizeGeometry(value.geometry)
  if (!geometry) return null
  return {
    id: typeof value.id === "string" ? value.id : `${type}-${String(index).padStart(3, "0")}`,
    type,
    geometry,
    layer: typeof value.layer === "number" ? value.layer : index * 10,
    requiresManualReview: false,
    manualReviewReasons: [],
    confidence: typeof value.confidence === "number" ? value.confidence : undefined,
    evidence: isObject(value.evidence) ? value.evidence : undefined,
    depthValue: type === "depth" ? 128 : undefined,
  }
}

function normalizeGeometry(value: unknown) {
  if (!isObject(value)) return null
  if (value.kind === "polygon") {
    const points = normalizePoints(value.points)
    return points.length >= 3 ? { kind: "polygon", points } : null
  }
  if (value.kind === "polyline") {
    const points = normalizePoints(value.points)
    const lineWidth = typeof value.lineWidth === "number" ? value.lineWidth : 6
    return points.length >= 2 ? { kind: "polyline", points, lineWidth } : null
  }
  if (value.kind === "rect") {
    if (Array.isArray(value.rect) && value.rect.length === 4 && value.rect.every((item) => typeof item === "number")) {
      const [x, y, width, height] = value.rect
      return { kind: "rect", x, y, width, height }
    }
    if ([value.x, value.y, value.width, value.height].every((item) => typeof item === "number")) {
      return { kind: "rect", x: value.x, y: value.y, width: value.width, height: value.height }
    }
  }
  return null
}

function normalizePoints(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((point): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every((item) => typeof item === "number"))
    .map((point) => [clamp(Math.round(point[0]), 0, 255), clamp(Math.round(point[1]), 0, 191)] as [number, number])
}

function legacyPlaceholder(sampleId: string) {
  return {
    schemaVersion: "world-blueprint-v0",
    sceneId: sampleId,
    width: 256,
    height: 192,
    seed: 0,
    styleId: "module-d-auto-annotation-v1",
    terrainRegions: [],
    roads: [],
    objects: [],
  }
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as JsonObject
}

async function optionalSha256(file: string) {
  try { return createHash("sha256").update(await readFile(file)).digest("hex") } catch { return null }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
