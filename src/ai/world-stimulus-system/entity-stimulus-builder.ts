/**
 * 当前文件负责：根据世界实体生成实体来源的世界刺激。
 */

import { createWorldStimulus } from "./stimulus-builder"

import type {
  BuildWorldStimuliInput,
  WorldStimulus,
  WorldStimulusIntensity,
  WorldStimulusType,
} from "./stimulus-types"
import type { WorldRuntimeEntity } from "@/world/runtime/entity-runtime"

export type EntityStimulusBuildInput = BuildWorldStimuliInput & {
  existingStimuli: WorldStimulus[]
}

type EntityStimulusTemplate = {
  type: WorldStimulusType
  intensity: WorldStimulusIntensity
  durationTick: number
  summary: string
  tags: string[]
}

export function buildEntityDrivenStimuli(
  input: EntityStimulusBuildInput
): WorldStimulus[] {
  const runtime = input.worldRuntime

  if (!runtime) return []

  const entities = runtime.entities.entities.filter((entity) => {
    if (!entity.active) return false

    return (
      entity.type === "tree" ||
      entity.type === "flower" ||
      entity.type === "water" ||
      entity.type === "butterfly"
    )
  })

  const results: WorldStimulus[] = []

  for (const entity of entities) {
    if (hasActiveStimulusFromEntity(input.existingStimuli, entity.id)) {
      continue
    }

    if (!shouldGenerateEntityStimulus(entity, input.tick)) {
      continue
    }

    const template = getEntityStimulusTemplate(entity)

    if (!template) continue

    results.push(
      createWorldStimulus({
        type: template.type,
        category: "entity",
        tick: input.tick,
        day: input.time.day,
        hour: input.time.hour,
        period: input.time.period,
        intensity: template.intensity,
        durationTick: template.durationTick,
        summary: template.summary,
        tags: template.tags,
        worldPosition: {
          x: entity.position.x,
          y: entity.position.y,
        },
        spatialRadius: readEntityStimulusRadius(entity),
        source: {
          kind: "world_entity",
          id: entity.id,
          type: entity.type,
          name: entity.name,
        },
      })
    )
  }

  return results
}

function getEntityStimulusTemplate(
  entity: WorldRuntimeEntity
): EntityStimulusTemplate | null {
  if (entity.type === "tree") {
    return {
      type: "tree_presence",
      intensity: "low",
      durationTick: 3,
      summary: "附近的树影安静地落在地面上。",
      tags: ["tree", "shade", "safe", "observation"],
    }
  }

  if (entity.type === "flower") {
    return {
      type: "flower_scent",
      intensity: "low",
      durationTick: 2,
      summary: "空气里有一点很轻的花香。",
      tags: ["flower", "scent", "curiosity", "gentle"],
    }
  }

  if (entity.type === "water") {
    return {
      type: "water_sound",
      intensity: "medium",
      durationTick: 3,
      summary: "浅水附近传来细小的水声。",
      tags: ["water", "sound", "cool", "resource"],
    }
  }

  if (entity.type === "butterfly") {
    return {
      type: "entity_motion",
      intensity: "medium",
      durationTick: 2,
      summary: "一只蝴蝶在视线附近轻轻移动。",
      tags: ["butterfly", "movement", "visual", "curiosity"],
    }
  }

  return null
}

function shouldGenerateEntityStimulus(
  entity: WorldRuntimeEntity,
  tick: number
): boolean {
  const baseRate = getEntityStimulusRate(entity)

  if (baseRate <= 0) return false

  const seed = createEntityStimulusSeed(entity.id, entity.type, tick)
  const normalized = (seed % 1000) / 1000

  return normalized < baseRate
}

function getEntityStimulusRate(entity: WorldRuntimeEntity): number {
  if (entity.type === "tree") return 0.08
  if (entity.type === "flower") return 0.12
  if (entity.type === "water") return 0.14
  if (entity.type === "butterfly") return 0.18

  return 0
}

function hasActiveStimulusFromEntity(
  stimuli: WorldStimulus[],
  entityId: string
): boolean {
  return stimuli.some((stimulus) => stimulus.source?.id === entityId)
}

function readEntityStimulusRadius(entity: WorldRuntimeEntity): number {
  const stimulus = entity.metadata?.stimulus

  if (typeof stimulus !== "object" || stimulus === null) {
    return 4
  }

  const record = stimulus as Record<string, unknown>
  const radius = record.radius

  return typeof radius === "number" && Number.isFinite(radius) ? radius : 4
}

function createEntityStimulusSeed(
  entityId: string,
  entityType: string,
  tick: number
): number {
  let seed = tick * 131 + entityType.length * 17

  for (let index = 0; index < entityId.length; index += 1) {
    seed += entityId.charCodeAt(index) * (index + 3)
  }

  return Math.abs(seed)
}