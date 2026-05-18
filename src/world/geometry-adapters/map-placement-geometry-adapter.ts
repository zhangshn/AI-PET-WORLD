/**
 * 当前文件职责：将地图 placement 转换为规则世界的实体几何描述。
 */

import type { MapPlacement, MapPlacementLayer } from "@/world/map-state/home-map-state-schema"
import type {
  EntityGeometry,
  Point2D,
  Polygon2D,
  SpatialShape,
} from "@/world/spatial/spatial-gateway"

export type BuildEntityGeometryFromPlacementInput = {
  placement: MapPlacement
  tileSize?: number
}

type LayerFootprintSize = {
  width: number
  height: number
}

const DEFAULT_TILE_SIZE = 1

const LAYER_FOOTPRINT_SIZE: Record<MapPlacementLayer, LayerFootprintSize> = {
  ground: { width: 1, height: 1 },
  path: { width: 1, height: 1 },
  edge: { width: 1, height: 1 },
  zone: { width: 1, height: 1 },
  "surface-decoration": { width: 0.5, height: 0.5 },
  nature: { width: 1.2, height: 1.2 },
  facility: { width: 1, height: 1 },
  structure: { width: 2, height: 2 },
  actor: { width: 0.8, height: 0.8 },
  atmosphere: { width: 1, height: 1 },
}

const COLLISION_LAYERS = new Set<MapPlacementLayer>([
  "structure",
  "facility",
  "actor",
  "nature",
])

const SUPPORT_LAYERS = new Set<MapPlacementLayer>([
  "structure",
  "facility",
  "actor",
])

export function buildEntityGeometryFromPlacement(
  input: BuildEntityGeometryFromPlacementInput
): EntityGeometry {
  const { placement } = input
  const tileSize = input.tileSize ?? DEFAULT_TILE_SIZE
  const anchor: Point2D = {
    x: placement.x,
    y: placement.y,
  }
  const footprint = buildFootprintShape(placement, tileSize)

  return {
    id: placement.id,
    anchor,
    footprint,
    collision: buildCollisionShape(placement, footprint, tileSize),
    support: SUPPORT_LAYERS.has(placement.layer) ? footprint : undefined,
    influence: buildInfluenceShape(placement, tileSize),
    tags: buildGeometryTags(placement),
  }
}

function buildFootprintShape(
  placement: MapPlacement,
  tileSize: number
): SpatialShape {
  const baseSize = LAYER_FOOTPRINT_SIZE[placement.layer]
  return {
    kind: "polygon",
    polygon: buildRectanglePolygon({
      anchor: { x: placement.x, y: placement.y },
      width: baseSize.width * tileSize * placement.scale,
      height: baseSize.height * tileSize * placement.scale,
    }),
  }
}

function buildCollisionShape(
  placement: MapPlacement,
  footprint: SpatialShape,
  tileSize: number
): SpatialShape | undefined {
  if (!COLLISION_LAYERS.has(placement.layer)) {
    return undefined
  }

  if (placement.layer !== "nature") {
    return footprint
  }

  const baseSize = LAYER_FOOTPRINT_SIZE[placement.layer]
  return {
    kind: "polygon",
    polygon: buildRectanglePolygon({
      anchor: { x: placement.x, y: placement.y },
      width: baseSize.width * tileSize * placement.scale * 0.75,
      height: baseSize.height * tileSize * placement.scale * 0.75,
    }),
  }
}

function buildInfluenceShape(
  placement: MapPlacement,
  tileSize: number
): SpatialShape | undefined {
  if (
    placement.layer !== "nature" &&
    placement.layer !== "facility" &&
    placement.layer !== "actor"
  ) {
    return undefined
  }

  const baseSize = LAYER_FOOTPRINT_SIZE[placement.layer]
  const influenceScale = placement.layer === "nature" ? 1.5 : 1.25

  return {
    kind: "polygon",
    polygon: buildRectanglePolygon({
      anchor: { x: placement.x, y: placement.y },
      width: baseSize.width * tileSize * placement.scale * influenceScale,
      height: baseSize.height * tileSize * placement.scale * influenceScale,
    }),
  }
}

function buildRectanglePolygon(input: {
  anchor: Point2D
  width: number
  height: number
}): Polygon2D {
  const halfWidth = input.width / 2
  const halfHeight = input.height / 2

  return {
    points: [
      { x: input.anchor.x - halfWidth, y: input.anchor.y - halfHeight },
      { x: input.anchor.x + halfWidth, y: input.anchor.y - halfHeight },
      { x: input.anchor.x + halfWidth, y: input.anchor.y + halfHeight },
      { x: input.anchor.x - halfWidth, y: input.anchor.y + halfHeight },
    ],
  }
}

function buildGeometryTags(placement: MapPlacement): string[] {
  return [
    ...placement.tags,
    `placement_layer:${placement.layer}`,
    `asset:${placement.assetId}`,
    `source:${placement.source}`,
  ]
}
