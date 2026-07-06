import type {
  HomeMapObjectKind,
  HomeMapPoint,
  HomeMapRect,
  HomeMapTerrainKind,
} from "./home-map-structure-schema"

export type GameMapFrameVersion = "game-map-frame-v1"

export type GameMapLayerRegion = {
  id: string
  sourceId: string
  kind: HomeMapTerrainKind | "walkable_area" | "blocked_area"
  polygon: HomeMapPoint[]
}

export type GameMapObjectLayerItem = {
  id: string
  sourceObjectId: string
  kind: HomeMapObjectKind
  position: HomeMapPoint
  footprint: HomeMapRect
  blocksMovement: boolean
}

export type GameMapInteractionItem = {
  id: string
  sourceObjectId: string
  kind: "inspect"
  bounds: HomeMapRect
}

export type GameMapVisualLayer =
  | {
      status: "not_generated"
      source: "none"
      approvedFrameId: null
      candidateId: null
      imageSha256: null
      imageWidth: null
      imageHeight: null
      imageFormat: null
    }
  | {
      status: "candidate"
      source: "ai_painter_visual_layer"
      candidateId: string
      approvedFrameId: null
      imageSha256: string | null
      imageWidth: number
      imageHeight: number
      imageFormat: "png" | "webp" | "jpg"
    }
  | {
      status: "approved"
      source: "ai_painter_visual_layer"
      candidateId: string
      approvedFrameId: string
      imageUrl: string
      imageSha256: string
      imageWidth: number
      imageHeight: number
      imageFormat: "png" | "webp" | "jpg"
    }
  | {
      status: "structured_fallback"
      source: "structured_fallback_skin"
      candidateId: null
      approvedFrameId: null
      imageSha256: null
      imageWidth: number
      imageHeight: number
      imageFormat: null
    }

export type GameMapFrame = {
  schemaVersion: GameMapFrameVersion
  frameId: string
  structureId: string
  worldId: string
  ownerId: string
  tick: number
  sourceFactIds: string[]
  terrainLayer: {
    regions: GameMapLayerRegion[]
  }
  objectLayer: {
    objects: GameMapObjectLayerItem[]
  }
  walkableLayer: {
    regions: GameMapLayerRegion[]
  }
  collisionLayer: {
    regions: GameMapLayerRegion[]
    blockedObjectIds: string[]
  }
  interactionLayer: {
    items: GameMapInteractionItem[]
  }
  runtimeLayer: {
    phase: "natural_home_static_mvp"
    stateRefs: string[]
  }
  visualLayer: GameMapVisualLayer
  tags: string[]
}

export function isGameMapFrame(value: unknown): value is GameMapFrame {
  if (!isRecord(value)) return false

  return (
    value.schemaVersion === "game-map-frame-v1" &&
    isNonEmptyString(value.frameId) &&
    isNonEmptyString(value.structureId) &&
    isNonEmptyString(value.worldId) &&
    isNonEmptyString(value.ownerId) &&
    Number.isInteger(value.tick) &&
    isArrayOf(value.sourceFactIds, isNonEmptyString) &&
    isRegionLayer(value.terrainLayer) &&
    isObjectLayer(value.objectLayer) &&
    isRegionLayer(value.walkableLayer) &&
    isCollisionLayer(value.collisionLayer) &&
    isInteractionLayer(value.interactionLayer) &&
    isRuntimeLayer(value.runtimeLayer) &&
    isGameMapVisualLayer(value.visualLayer) &&
    isArrayOf(value.tags, isNonEmptyString)
  )
}

function isRegionLayer(value: unknown): value is { regions: GameMapLayerRegion[] } {
  return isRecord(value) && isArrayOf(value.regions, isGameMapLayerRegion)
}

function isObjectLayer(value: unknown): value is { objects: GameMapObjectLayerItem[] } {
  return isRecord(value) && isArrayOf(value.objects, isGameMapObjectLayerItem)
}

function isCollisionLayer(
  value: unknown
): value is { regions: GameMapLayerRegion[]; blockedObjectIds: string[] } {
  return (
    isRecord(value) &&
    isArrayOf(value.regions, isGameMapLayerRegion) &&
    isArrayOf(value.blockedObjectIds, isNonEmptyString)
  )
}

function isInteractionLayer(
  value: unknown
): value is { items: GameMapInteractionItem[] } {
  return isRecord(value) && isArrayOf(value.items, isGameMapInteractionItem)
}

function isRuntimeLayer(
  value: unknown
): value is GameMapFrame["runtimeLayer"] {
  return (
    isRecord(value) &&
    value.phase === "natural_home_static_mvp" &&
    isArrayOf(value.stateRefs, isNonEmptyString)
  )
}

function isGameMapLayerRegion(value: unknown): value is GameMapLayerRegion {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sourceId) &&
    isNonEmptyString(value.kind) &&
    isArrayOf(value.polygon, isPoint) &&
    value.polygon.length >= 3
  )
}

function isGameMapObjectLayerItem(
  value: unknown
): value is GameMapObjectLayerItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sourceObjectId) &&
    isNonEmptyString(value.kind) &&
    isPoint(value.position) &&
    isRect(value.footprint) &&
    typeof value.blocksMovement === "boolean"
  )
}

function isGameMapInteractionItem(value: unknown): value is GameMapInteractionItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sourceObjectId) &&
    value.kind === "inspect" &&
    isRect(value.bounds)
  )
}

function isGameMapVisualLayer(value: unknown): value is GameMapVisualLayer {
  if (!isRecord(value)) return false
  if (value.status === "not_generated") {
    return (
      value.source === "none" &&
      value.approvedFrameId === null &&
      value.candidateId === null &&
      value.imageSha256 === null &&
      value.imageWidth === null &&
      value.imageHeight === null &&
      value.imageFormat === null
    )
  }
  if (value.status === "candidate") {
    return (
      value.source === "ai_painter_visual_layer" &&
      isNonEmptyString(value.candidateId) &&
      value.approvedFrameId === null &&
      (value.imageSha256 === null || isNonEmptyString(value.imageSha256)) &&
      isPositiveInteger(value.imageWidth) &&
      isPositiveInteger(value.imageHeight) &&
      isImageFormat(value.imageFormat)
    )
  }
  if (value.status === "approved") {
    return (
      value.source === "ai_painter_visual_layer" &&
      isNonEmptyString(value.candidateId) &&
      isNonEmptyString(value.approvedFrameId) &&
      isNonEmptyString(value.imageUrl) &&
      isNonEmptyString(value.imageSha256) &&
      isPositiveInteger(value.imageWidth) &&
      isPositiveInteger(value.imageHeight) &&
      isImageFormat(value.imageFormat)
    )
  }
  if (value.status === "structured_fallback") {
    return (
      value.source === "structured_fallback_skin" &&
      value.candidateId === null &&
      value.approvedFrameId === null &&
      value.imageSha256 === null &&
      isPositiveInteger(value.imageWidth) &&
      isPositiveInteger(value.imageHeight) &&
      value.imageFormat === null
    )
  }
  return false
}

function isPoint(value: unknown): value is HomeMapPoint {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  )
}

function isRect(value: unknown): value is HomeMapRect {
  if (!isRecord(value) || !isPoint(value)) return false
  const record = value as Record<string, unknown>

  return (
    typeof record.width === "number" &&
    record.width > 0 &&
    typeof record.height === "number" &&
    record.height > 0
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
