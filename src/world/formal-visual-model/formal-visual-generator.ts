/**
 * 当前文件职责：从 RenderableWorldSnapshot 纯函数生成 FormalVisualModel。
 */

import type { RenderableWorldSnapshot } from "@/world/rendering/renderer-gateway"

import { buildFormalActorModels } from "./formal-actor-model-builder"
import { buildFormalCanvasModel } from "./formal-canvas-model-builder"
import { buildFormalEnvironmentModel } from "./formal-environment-model-builder"
import { buildFormalHudSummary } from "./formal-hud-summary-builder"
import {
  FORMAL_VISUAL_MODEL_VERSION,
  type FormalVisualAuditSummary,
  type FormalVisualModel,
  type FormalVisualModelInput,
} from "./formal-visual-model-schema"
import { buildFormalWorldObjectModels } from "./formal-world-object-model-builder"

export function buildFormalVisualModelFromSnapshot(
  snapshot: RenderableWorldSnapshot
): FormalVisualModel {
  return buildFormalVisualModel(buildFormalVisualModelInput(snapshot))
}

export function buildFormalVisualModel(
  input: FormalVisualModelInput
): FormalVisualModel {
  const { snapshot, visualState, placements, actorGeometryProjections } = input
  const objects = buildFormalWorldObjectModels(visualState, placements)
  const actors = buildFormalActorModels(visualState, actorGeometryProjections)
  const audit = buildFormalVisualAuditSummary(input)

  return {
    version: FORMAL_VISUAL_MODEL_VERSION,
    worldId: visualState.worldId,
    canvas: buildFormalCanvasModel(visualState),
    objects,
    actors,
    environment: buildFormalEnvironmentModel(visualState),
    hudSummary: buildFormalHudSummary({
      visualState,
      actorModels: actors,
      objectModels: objects,
    }),
    audit,
    auditTags: [
      "formal_visual_model_v0",
      "formal_visual_generator_pure_function",
      ...snapshot.tags.map((tag) => `snapshot_tag:${tag}`),
    ],
  }
}

function buildFormalVisualModelInput(
  snapshot: RenderableWorldSnapshot
): FormalVisualModelInput {
  const visualState = snapshot.visualState

  return {
    snapshot,
    visualState,
    placements: visualState.placements,
    actorGeometryProjections: visualState.actorGeometryProjections,
  }
}

function buildFormalVisualAuditSummary(
  input: FormalVisualModelInput
): FormalVisualAuditSummary {
  const { snapshot, visualState, placements, actorGeometryProjections } = input

  return {
    source: "renderable_world_snapshot",
    worldId: visualState.worldId,
    visualPlacementCount: placements.length,
    visualActorProjectionCount: actorGeometryProjections.length,
    visualTerrainCellCount: visualState.terrainCells.length,
    drawCommandCount: snapshot.drawCommands.length,
    warnings: buildFormalVisualWarnings(input),
    auditTags: [
      "formal_visual_audit_v0",
      "source:renderable_world_snapshot",
    ],
  }
}

function buildFormalVisualWarnings(input: FormalVisualModelInput): string[] {
  const warnings: string[] = []

  if (input.placements.length === 0) {
    warnings.push("visual_placements_empty")
  }

  if (input.visualState.actorGeometryProjections.length === 0) {
    warnings.push("actor_geometry_projections_empty")
  }

  const nonProjectableActorCount =
    input.visualState.actorGeometryProjections.filter(
      (projection) => !projection.canProject || !projection.geometryProjection
    ).length

  if (nonProjectableActorCount > 0) {
    warnings.push(`actor_projection_skipped:${nonProjectableActorCount}`)
  }

  return warnings
}
