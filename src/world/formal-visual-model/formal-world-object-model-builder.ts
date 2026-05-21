/**
 * 当前文件职责：把 VisualPlacement 纯函数转换为 FormalWorldObjectModel。
 */

import type {
  VisualPlacement,
  VisualState,
} from "@/world/rendering/renderer-gateway"
import type { SpatialShape } from "@/world/spatial/spatial-gateway"

import type {
  FormalVisualLayer,
  FormalVisualSourceTrace,
  FormalVisualStyleToken,
  FormalWorldObjectKind,
  FormalWorldObjectModel,
} from "./formal-visual-model-schema"

export function buildFormalWorldObjectModels(
  visualState: VisualState,
  placements: VisualPlacement[]
): FormalWorldObjectModel[] {
  return placements.map((placement) =>
    buildFormalWorldObjectModel(visualState, placement)
  )
}

function buildFormalWorldObjectModel(
  visualState: VisualState,
  placement: VisualPlacement
): FormalWorldObjectModel {
  return {
    id: placement.placementId,
    kind: mapPlacementToFormalWorldObjectKind(placement),
    label: buildPlayerFacingObjectLabel(placement),
    layer: mapPlacementToFormalLayer(placement),
    geometry: buildFormalObjectGeometry(placement),
    anchor: placement.anchor,
    styleToken: buildFormalObjectStyleToken(placement),
    opacity: placement.alpha,
    source: buildPlacementSourceTrace(visualState, placement),
    auditTags: buildPlacementAuditTags(placement),
  }
}

function buildFormalObjectGeometry(placement: VisualPlacement): SpatialShape {
  if (placement.footprint) {
    return placement.footprint
  }

  return {
    kind: "point",
    point: placement.anchor,
  }
}

function mapPlacementToFormalLayer(
  placement: VisualPlacement
): FormalVisualLayer {
  if (placement.layer === "ground") return "ground"
  if (placement.layer === "path") return "path"
  if (placement.layer === "structure") return "structure"
  if (placement.layer === "facility") return "facility"
  if (placement.layer === "nature") return "nature"
  if (placement.layer === "surface-decoration") return "surfaceDecoration"
  if (placement.layer === "actor") return "actor"
  if (placement.layer === "atmosphere") return "environment"

  return "unknown"
}

function mapPlacementToFormalWorldObjectKind(
  placement: VisualPlacement
): FormalWorldObjectKind {
  if (placement.layer === "ground") return "terrain"
  if (placement.layer === "path") return "path"

  if (placement.layer === "structure") {
    if (hasTagToken(placement.tags, "temporary_shelter")) return "shelter"
    if (hasTagToken(placement.tags, "shelter")) return "shelter"

    return "structure"
  }

  if (placement.layer === "facility") return "facility"

  if (placement.layer === "nature") {
    if (hasTagToken(placement.tags, "bush")) return "bush"

    return "tree"
  }

  if (placement.layer === "surface-decoration") return "surfaceDecoration"
  if (placement.layer === "edge") return "boundary"
  if (placement.layer === "zone") return "boundary"
  if (placement.layer === "atmosphere") return "unknown"
  if (placement.layer === "actor") return "unknown"

  return "unknown"
}

function buildPlayerFacingObjectLabel(placement: VisualPlacement): string {
  if (placement.label.trim().length > 0) {
    return placement.label
  }

  const kind = mapPlacementToFormalWorldObjectKind(placement)

  if (kind === "terrain") return "地面"
  if (kind === "path") return "道路"
  if (kind === "shelter") return "临时住所"
  if (kind === "structure") return "建筑"
  if (kind === "facility") return "设施"
  if (kind === "tree") return "树木"
  if (kind === "bush") return "灌木"
  if (kind === "surfaceDecoration") return "小物"
  if (kind === "resource") return "资源"
  if (kind === "lifeTrace") return "生命痕迹"
  if (kind === "boundary") return "边界"

  return "世界对象"
}

function buildFormalObjectStyleToken(
  placement: VisualPlacement
): FormalVisualStyleToken {
  if (hasTagToken(placement.tags, "protective")) return "protective"
  if (hasTagToken(placement.tags, "ordered")) return "ordered"
  if (hasTagToken(placement.tags, "quiet")) return "quiet"
  if (hasTagToken(placement.tags, "exploratory")) return "exploratory"
  if (hasTagToken(placement.tags, "caretaking")) return "caretaking"
  if (placement.layer === "nature") return "warmNatural"
  if (placement.layer === "path") return "ordered"
  if (placement.layer === "facility") return "caretaking"

  return "neutral"
}

function buildPlacementSourceTrace(
  visualState: VisualState,
  placement: VisualPlacement
): FormalVisualSourceTrace {
  return {
    source: "visual_placement",
    sourceId: placement.placementId,
    worldId: visualState.worldId,
  }
}

function buildPlacementAuditTags(placement: VisualPlacement): string[] {
  const tags = [
    "formal_world_object_v0",
    "source:visual_placement",
    `layer:${placement.layer}`,
    `rule_status:${placement.ruleStatus}`,
  ]

  if (!placement.footprint) {
    tags.push("geometry:fallback_point_from_anchor")
  }

  return tags
}

function hasTagToken(tags: string[], token: string): boolean {
  return tags.some((tag) => tag.includes(token))
}
