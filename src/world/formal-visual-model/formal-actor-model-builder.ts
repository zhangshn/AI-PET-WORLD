/**
 * 当前文件职责：把 VisualActorGeometryProjection 纯函数转换为 FormalActorModel。
 */

import type {
  VisualActorGeometryProjection,
  VisualState,
} from "@/world/rendering/renderer-gateway"

import type {
  FormalActorModel,
  FormalActorPoseToken,
  FormalVisualSourceTrace,
  FormalVisualStyleToken,
} from "./formal-visual-model-schema"

type FormalActorPoseInput = NonNullable<
  VisualActorGeometryProjection["geometryProjection"]
>["pose"]

export function buildFormalActorModels(
  visualState: VisualState,
  projections: VisualActorGeometryProjection[]
): FormalActorModel[] {
  return projections
    .filter(canBuildFormalActorModel)
    .map((projection) => buildFormalActorModel(visualState, projection))
}

function canBuildFormalActorModel(
  projection: VisualActorGeometryProjection
): boolean {
  return projection.canProject && Boolean(projection.geometryProjection)
}

function buildFormalActorModel(
  visualState: VisualState,
  projection: VisualActorGeometryProjection
): FormalActorModel {
  const geometryProjection = projection.geometryProjection

  if (!geometryProjection) {
    throw new Error("FormalActorModel requires geometryProjection.")
  }

  return {
    actorId: projection.actorId,
    actorKind: projection.actorKind,
    label: buildFormalActorLabel(projection),
    body: geometryProjection.body,
    aura: geometryProjection.interactionRadius,
    anchor: geometryProjection.anchor,
    poseToken: mapFormalActorPoseToken(geometryProjection.pose),
    styleToken: buildFormalActorStyleToken(projection),
    canRender: true,
    source: buildActorSourceTrace(visualState, projection),
    auditTags: buildActorAuditTags(projection),
  }
}

function buildFormalActorLabel(
  projection: VisualActorGeometryProjection
): string {
  if (projection.actorKind === "butler") return "管家"
  if (projection.actorKind === "pet") return "宠物"

  return "角色"
}

function mapFormalActorPoseToken(
  pose: FormalActorPoseInput
): FormalActorPoseToken {
  if (pose === "idle") return "idle"
  if (pose === "observing") return "observing"
  if (pose === "working") return "working"
  if (pose === "resting") return "resting"
  if (pose === "approaching") return "approaching"

  return "unknown"
}

function buildFormalActorStyleToken(
  projection: VisualActorGeometryProjection
): FormalVisualStyleToken {
  if (projection.actorKind === "butler") return "caretaking"
  if (projection.actorKind === "pet") return "warmNatural"

  return "neutral"
}

function buildActorSourceTrace(
  visualState: VisualState,
  projection: VisualActorGeometryProjection
): FormalVisualSourceTrace {
  return {
    source: "visual_actor_geometry_projection",
    sourceId: projection.actorId,
    worldId: visualState.worldId,
  }
}

function buildActorAuditTags(
  projection: VisualActorGeometryProjection
): string[] {
  return [
    "formal_actor_model_v0",
    "source:visual_actor_geometry_projection",
    `actor_kind:${projection.actorKind}`,
    `projection_status:${projection.status}`,
    `presence:${projection.presence}`,
  ]
}
