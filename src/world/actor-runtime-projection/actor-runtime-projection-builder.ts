/**
 * 当前文件职责：根据轻量 runtime 输入构建 actor runtime projection 结果。
 */

import type {
  ActorAttentionDirection,
  ActorGeometryPose,
} from "@/world/actor-geometry/actor-geometry-gateway"

import type { Point2D } from "@/world/spatial/spatial-gateway"

import type {
  ActorRuntimePresence,
  ActorRuntimeProjectionInput,
  ActorRuntimeProjectionResult,
  ActorRuntimeProjectionSource,
  BuildButlerRuntimeProjectionInput,
  BuildPetRuntimeProjectionInput,
} from "./actor-runtime-projection-schema"

export function buildActorRuntimeProjection(
  input: ActorRuntimeProjectionInput
): ActorRuntimeProjectionResult {
  return {
    actorId: input.actorId,
    actorKind: input.actorKind,
    worldId: input.worldId,
    presence: input.presence,
    canProject: input.presence === "present",
    anchor: input.anchor,
    pose: input.pose,
    attentionDirection: input.attentionDirection,
    source: input.source,
    scale: input.scale,
    reason: input.reason,
    tags: buildActorRuntimeProjectionTags({
      source: input.source,
      presence: input.presence,
      inputTags: input.tags,
    }),
  }
}

export function buildButlerRuntimeProjection(
  input: BuildButlerRuntimeProjectionInput
): ActorRuntimeProjectionResult {
  const anchor = input.anchor ?? buildDefaultButlerAnchor()
  const pose = mapButlerTaskToActorPose(input.currentTask)
  const attentionDirection = mapAttentionTargetToDirection(
    input.attentionTargetType
  )
  const presence: ActorRuntimePresence = "present"

  return buildActorRuntimeProjection({
    actorId: input.butlerId,
    actorKind: "butler",
    worldId: input.worldId,
    anchor,
    presence,
    pose,
    attentionDirection,
    source: "butler_runtime_context",
    scale: 1,
    reason: `管家 runtime projection 来自任务 ${input.currentTask} 与心情 ${input.mood}。未提供 anchor 时使用 deterministic placeholder anchor。`,
    tags: [
      "actor_runtime_projection_v0",
      "actor_kind:butler",
      `butler_task:${input.currentTask}`,
      `butler_mood:${input.mood}`,
      `tick:${input.tickIndex}`,
      input.anchor ? "actor_anchor:input" : "actor_anchor:deterministic_placeholder",
      ...(input.tags ?? []),
    ],
  })
}

export function buildPetRuntimeProjection(
  input: BuildPetRuntimeProjectionInput
): ActorRuntimeProjectionResult {
  if (!input.isBorn) {
    return buildActorRuntimeProjection({
      actorId: input.petId,
      actorKind: "pet",
      worldId: input.worldId,
      anchor: input.anchor ?? buildDefaultPetAnchor(),
      presence: "not_ready",
      pose: "unknown",
      attentionDirection: "unknown",
      source: "pet_state",
      scale: 1,
      reason: "宠物尚未出生，不应进入 actor 几何显示。未提供 anchor 时使用 deterministic placeholder anchor。",
      tags: [
        "actor_runtime_projection_v0",
        "actor_kind:pet",
        "pet_not_born",
        input.anchor ? "actor_anchor:input" : "actor_anchor:deterministic_placeholder",
        ...(input.tags ?? []),
      ],
    })
  }

  const anchor = input.anchor ?? buildDefaultPetAnchor()
  const pose = mapPetActionToActorPose(input.action)
  const attentionDirection = mapPetMoodToAttentionDirection(input.mood)

  return buildActorRuntimeProjection({
    actorId: input.petId,
    actorKind: "pet",
    worldId: input.worldId,
    anchor,
    presence: "present",
    pose,
    attentionDirection,
    source: "pet_state",
    scale: 1,
    reason: `宠物 runtime projection 来自动作 ${input.action}、心情 ${input.mood} 与能量 ${input.energy}。未提供 anchor 时使用 deterministic placeholder anchor。`,
    tags: [
      "actor_runtime_projection_v0",
      "actor_kind:pet",
      `pet_action:${input.action}`,
      `pet_mood:${input.mood}`,
      `pet_energy:${input.energy}`,
      input.anchor ? "actor_anchor:input" : "actor_anchor:deterministic_placeholder",
      ...(input.tags ?? []),
    ],
  })
}

function buildDefaultButlerAnchor(): Point2D {
  return { x: 6, y: 6 }
}

function buildDefaultPetAnchor(): Point2D {
  return { x: 7, y: 6 }
}

function mapButlerTaskToActorPose(task: string): ActorGeometryPose {
  if (task === "maintain_home") return "working"
  if (task === "plan_building") return "working"
  if (task === "care_pet") return "approaching"
  if (task === "inspect_environment") return "observing"
  if (task === "rest") return "resting"
  if (task === "idle") return "idle"

  return "observing"
}

function mapPetActionToActorPose(action: string): ActorGeometryPose {
  if (action === "sleeping") return "resting"
  if (action === "resting") return "resting"
  if (action === "observing") return "observing"
  if (action === "approaching") return "approaching"
  if (action === "walking") return "approaching"
  if (action === "exploring") return "observing"
  if (action === "idle") return "idle"

  return "unknown"
}

function mapAttentionTargetToDirection(
  targetType?: string
): ActorAttentionDirection {
  if (targetType === "pet") return "east"
  if (targetType === "home") return "center"
  if (targetType === "nature") return "west"
  if (targetType === "facility") return "south"

  return "unknown"
}

function mapPetMoodToAttentionDirection(
  mood: string
): ActorAttentionDirection {
  if (mood === "curious") return "east"
  if (mood === "alert") return "north"
  if (mood === "calm") return "center"
  if (mood === "happy") return "east"
  if (mood === "sad") return "west"

  return "unknown"
}

function buildActorRuntimeProjectionTags(input: {
  source: ActorRuntimeProjectionSource
  presence: ActorRuntimePresence
  inputTags: string[]
}): string[] {
  return uniqueTags([
    "actor_runtime_projection_result_v0",
    `actor_runtime_source:${input.source}`,
    `actor_presence:${input.presence}`,
    ...input.inputTags,
  ])
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
