/**
 * 当前文件职责：将 actor runtime projection 只读转换为 actor 几何投影。
 */

import { buildActorGeometryProjection } from "@/world/actor-geometry/actor-geometry-gateway"

import type { ActorGeometrySource } from "@/world/actor-geometry/actor-geometry-gateway"

import type {
  ActorRuntimeGeometryProjectionResult,
  ActorRuntimeProjectionResult,
} from "./actor-runtime-projection-schema"

export function buildActorGeometryProjectionFromRuntime(
  runtimeProjection: ActorRuntimeProjectionResult
): ActorRuntimeGeometryProjectionResult {
  if (!runtimeProjection.canProject) {
    const status = buildSkippedStatus(runtimeProjection)
    const geometrySource = inferActorGeometrySourceFromRuntime(runtimeProjection)

    return {
      actorId: runtimeProjection.actorId,
      actorKind: runtimeProjection.actorKind,
      worldId: runtimeProjection.worldId,
      status,
      canProject: false,
      runtimeProjection,
      geometrySource,
      reason: `Actor geometry projection skipped: ${runtimeProjection.reason}`,
      tags: buildActorRuntimeGeometryProjectionTags({
        runtimeProjection,
        status,
        geometrySource,
      }),
    }
  }

  const geometrySource = inferActorGeometrySourceFromRuntime(runtimeProjection)
  const geometryProjection = buildActorGeometryProjection({
    actorId: runtimeProjection.actorId,
    actorKind: runtimeProjection.actorKind,
    anchor: runtimeProjection.anchor,
    pose: runtimeProjection.pose,
    attentionDirection: runtimeProjection.attentionDirection,
    source: geometrySource,
    scale: runtimeProjection.scale,
    tags: [
      ...runtimeProjection.tags,
      "actor_runtime_to_geometry_adapter_v0",
      `runtime_source:${runtimeProjection.source}`,
      `runtime_presence:${runtimeProjection.presence}`,
    ],
  })

  return {
    actorId: runtimeProjection.actorId,
    actorKind: runtimeProjection.actorKind,
    worldId: runtimeProjection.worldId,
    status: "projected",
    canProject: true,
    runtimeProjection,
    geometryProjection,
    geometrySource,
    reason: `Actor geometry projection created from runtime projection: ${runtimeProjection.reason}`,
    tags: buildActorRuntimeGeometryProjectionTags({
      runtimeProjection,
      status: "projected",
      geometrySource,
    }),
  }
}

function buildSkippedStatus(
  runtimeProjection: ActorRuntimeProjectionResult
): "skipped_not_ready" | "skipped_unknown" {
  if (runtimeProjection.presence === "not_ready") {
    return "skipped_not_ready"
  }

  return "skipped_unknown"
}

function inferActorGeometrySourceFromRuntime(
  runtimeProjection: ActorRuntimeProjectionResult
): ActorGeometrySource {
  if (runtimeProjection.tags.includes("actor_anchor:deterministic_placeholder")) {
    return "deterministic_placeholder"
  }

  if (runtimeProjection.source === "deterministic_placeholder") {
    return "deterministic_placeholder"
  }

  if (
    runtimeProjection.source === "butler_runtime_context" ||
    runtimeProjection.source === "pet_state"
  ) {
    return "runtime_projection"
  }

  return "unknown"
}

function buildActorRuntimeGeometryProjectionTags(input: {
  runtimeProjection: ActorRuntimeProjectionResult
  status: ActorRuntimeGeometryProjectionResult["status"]
  geometrySource: ActorGeometrySource
}): string[] {
  return uniqueTags([
    "actor_runtime_geometry_projection_v0",
    `actor_kind:${input.runtimeProjection.actorKind}`,
    `actor_runtime_geometry_status:${input.status}`,
    `actor_geometry_source:${input.geometrySource}`,
    `actor_presence:${input.runtimeProjection.presence}`,
    `actor_runtime_source:${input.runtimeProjection.source}`,
    ...input.runtimeProjection.tags,
  ])
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
