import type {
  GameMapFrame,
  GameMapInteractionItem,
  GameMapLayerRegion,
  GameMapObjectLayerItem,
} from "./game-map-frame-schema"
import type { GameMapCompositeManifest } from "./game-map-composite-schema"
import { isGameMapCompositeManifest } from "./game-map-composite-schema"

export type GameMapRuntimeFrameVersion = "game-map-runtime-frame-v1"

export type GameMapRuntimeFrame = {
  schemaVersion: GameMapRuntimeFrameVersion
  runtimeFrameId: string
  gameMapFrameId: string
  structureId: string
  worldId: string
  ownerId: string
  tick: number
  sourceFactIds: string[]
  layers: {
    terrain: GameMapLayerRegion[]
    objects: GameMapObjectLayerItem[]
    walkable: GameMapLayerRegion[]
    collision: GameMapLayerRegion[]
    interactions: GameMapInteractionItem[]
  }
  runtimeState: {
    phase: GameMapFrame["runtimeLayer"]["phase"]
    stateRefs: string[]
  }
  composition: GameMapCompositeManifest
  visual: {
    source: "ai_painter_approved_frame" | "structured_fallback_skin"
    approvedFrameId: string | null
    candidateId: string | null
    imageUrl: string | null
    imageSha256: string | null
    imageWidth: number
    imageHeight: number
    imageFormat: "png" | "webp" | "jpg" | null
  }
  worldPageContract: {
    page: "/world"
    mode: "game_runtime"
    canShowInWorld: boolean
    forbiddenPayloads: string[]
  }
  tags: string[]
}

export function isGameMapRuntimeFrame(value: unknown): value is GameMapRuntimeFrame {
  if (!isRecord(value)) return false

  return (
    value.schemaVersion === "game-map-runtime-frame-v1" &&
    isNonEmptyString(value.runtimeFrameId) &&
    isNonEmptyString(value.gameMapFrameId) &&
    isNonEmptyString(value.structureId) &&
    isNonEmptyString(value.worldId) &&
    isNonEmptyString(value.ownerId) &&
    Number.isInteger(value.tick) &&
    isArrayOf(value.sourceFactIds, isNonEmptyString) &&
    isRuntimeLayers(value.layers) &&
    isRuntimeState(value.runtimeState) &&
    isGameMapCompositeManifest(value.composition) &&
    isRuntimeVisual(value.visual) &&
    isWorldPageContract(value.worldPageContract) &&
    isArrayOf(value.tags, isNonEmptyString)
  )
}

function isRuntimeLayers(value: unknown): value is GameMapRuntimeFrame["layers"] {
  return (
    isRecord(value) &&
    Array.isArray(value.terrain) &&
    Array.isArray(value.objects) &&
    Array.isArray(value.walkable) &&
    Array.isArray(value.collision) &&
    Array.isArray(value.interactions)
  )
}

function isRuntimeState(value: unknown): value is GameMapRuntimeFrame["runtimeState"] {
  return (
    isRecord(value) &&
    value.phase === "natural_home_static_mvp" &&
    isArrayOf(value.stateRefs, isNonEmptyString)
  )
}

function isRuntimeVisual(value: unknown): value is GameMapRuntimeFrame["visual"] {
  return (
    isRecord(value) &&
    (value.source === "ai_painter_approved_frame" ||
      value.source === "structured_fallback_skin") &&
    isRuntimeVisualIdentity(value) &&
    isPositiveInteger(value.imageWidth) &&
    isPositiveInteger(value.imageHeight) &&
    (isImageFormat(value.imageFormat) || value.imageFormat === null)
  )
}

function isRuntimeVisualIdentity(value: Record<string, unknown>): boolean {
  if (value.source === "ai_painter_approved_frame") {
    return (
      isNonEmptyString(value.approvedFrameId) &&
      isNonEmptyString(value.candidateId) &&
      isNonEmptyString(value.imageUrl) &&
      isNonEmptyString(value.imageSha256) &&
      value.imageSha256.length === 64 &&
      isImageFormat(value.imageFormat)
    )
  }

  return (
    value.source === "structured_fallback_skin" &&
    value.approvedFrameId === null &&
    value.candidateId === null &&
    value.imageUrl === null &&
    value.imageSha256 === null &&
    value.imageFormat === null
  )
}

function isWorldPageContract(
  value: unknown
): value is GameMapRuntimeFrame["worldPageContract"] {
  return (
    isRecord(value) &&
    value.page === "/world" &&
    value.mode === "game_runtime" &&
    typeof value.canShowInWorld === "boolean" &&
    isArrayOf(value.forbiddenPayloads, isNonEmptyString) &&
    value.forbiddenPayloads.includes("training_image") &&
    value.forbiddenPayloads.includes("candidate_image") &&
    value.forbiddenPayloads.includes("partial_crop_image") &&
    value.forbiddenPayloads.includes("single_model_output_only")
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function isImageFormat(value: unknown): value is "png" | "webp" | "jpg" {
  return value === "png" || value === "webp" || value === "jpg"
}
