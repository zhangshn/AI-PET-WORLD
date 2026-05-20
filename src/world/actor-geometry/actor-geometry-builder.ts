/**
 * 当前文件职责：构建管家 / 宠物 actor 的 deterministic 几何投影。
 */

import type {
  Point2D,
  Polygon2D,
  SpatialShape,
} from "@/world/spatial/spatial-gateway"

import type {
  ActorAttentionDirection,
  ActorGeometryKind,
  ActorGeometryPose,
  ActorGeometryProjection,
  ActorGeometrySource,
  BuildActorGeometryProjectionInput,
  BuildButlerActorGeometryProjectionInput,
  BuildPetActorGeometryProjectionInput,
} from "./actor-geometry-schema"

export function buildActorGeometryProjection(
  input: BuildActorGeometryProjectionInput
): ActorGeometryProjection {
  const scale = input.scale ?? 1
  const pose = input.pose ?? "unknown"
  const attentionDirection = input.attentionDirection ?? "unknown"
  const source = input.source ?? "deterministic_placeholder"

  return {
    actorId: input.actorId,
    actorKind: input.actorKind,
    anchor: input.anchor,
    body: buildActorBodyShape({
      actorKind: input.actorKind,
      anchor: input.anchor,
      scale,
    }),
    interactionRadius: buildActorInteractionRadiusShape({
      actorKind: input.actorKind,
      anchor: input.anchor,
      scale,
    }),
    attentionDirection,
    pose,
    source,
    tags: buildActorGeometryTags({
      actorKind: input.actorKind,
      pose,
      attentionDirection,
      source,
      inputTags: input.tags ?? [],
    }),
  }
}

export function buildButlerActorGeometryProjection(
  input: BuildButlerActorGeometryProjectionInput
): ActorGeometryProjection {
  return buildActorGeometryProjection({
    ...input,
    actorKind: "butler",
  })
}

export function buildPetActorGeometryProjection(
  input: BuildPetActorGeometryProjectionInput
): ActorGeometryProjection {
  return buildActorGeometryProjection({
    ...input,
    actorKind: "pet",
  })
}

function buildActorBodyShape(input: {
  actorKind: ActorGeometryKind
  anchor: Point2D
  scale: number
}): SpatialShape {
  const size = getActorBodySize({
    actorKind: input.actorKind,
    scale: input.scale,
  })

  return buildPolygonShape(buildRectanglePolygon({
    center: {
      x: input.anchor.x,
      y: input.anchor.y - size.height / 2,
    },
    width: size.width,
    height: size.height,
  }))
}

function buildActorInteractionRadiusShape(input: {
  actorKind: ActorGeometryKind
  anchor: Point2D
  scale: number
}): SpatialShape {
  const size = getActorInteractionSize({
    actorKind: input.actorKind,
    scale: input.scale,
  })

  return buildPolygonShape(buildRectanglePolygon({
    center: input.anchor,
    width: size.width,
    height: size.height,
  }))
}

function getActorBodySize(input: {
  actorKind: ActorGeometryKind
  scale: number
}): { width: number; height: number } {
  if (input.actorKind === "butler") {
    return {
      width: 0.55 * input.scale,
      height: 0.9 * input.scale,
    }
  }

  return {
    width: 0.7 * input.scale,
    height: 0.55 * input.scale,
  }
}

function getActorInteractionSize(input: {
  actorKind: ActorGeometryKind
  scale: number
}): { width: number; height: number } {
  if (input.actorKind === "butler") {
    return {
      width: 1.6 * input.scale,
      height: 1.6 * input.scale,
    }
  }

  return {
    width: 1.4 * input.scale,
    height: 1.2 * input.scale,
  }
}

function buildRectanglePolygon(input: {
  center: Point2D
  width: number
  height: number
}): Polygon2D {
  const halfWidth = input.width / 2
  const halfHeight = input.height / 2

  return {
    points: [
      {
        x: input.center.x - halfWidth,
        y: input.center.y - halfHeight,
      },
      {
        x: input.center.x + halfWidth,
        y: input.center.y - halfHeight,
      },
      {
        x: input.center.x + halfWidth,
        y: input.center.y + halfHeight,
      },
      {
        x: input.center.x - halfWidth,
        y: input.center.y + halfHeight,
      },
    ],
  }
}

function buildPolygonShape(polygon: Polygon2D): SpatialShape {
  return {
    kind: "polygon",
    polygon,
  }
}

function buildActorGeometryTags(input: {
  actorKind: ActorGeometryKind
  pose: ActorGeometryPose
  attentionDirection: ActorAttentionDirection
  source: ActorGeometrySource
  inputTags: string[]
}): string[] {
  return uniqueTags([
    "actor_geometry_projection_v0",
    `actor_kind:${input.actorKind}`,
    `actor_pose:${input.pose}`,
    `actor_attention:${input.attentionDirection}`,
    `actor_geometry_source:${input.source}`,
    ...input.inputTags,
  ])
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
