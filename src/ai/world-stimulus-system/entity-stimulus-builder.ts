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

type EntityStimulusCandidate = {
  entity: WorldRuntimeEntity
  template: EntityStimulusTemplate
  score: number
}

const MAX_ENTITY_STIMULI_PER_TICK = 3

const MAX_STIMULI_PER_TYPE_PER_TICK: Partial<
  Record<WorldStimulusType, number>
> = {
  tree_presence: 1,
  flower_scent: 1,
  water_sound: 1,
  entity_motion: 1,
}

const ACTIVE_TYPE_SOFT_LIMIT: Partial<Record<WorldStimulusType, number>> = {
  tree_presence: 2,
  flower_scent: 2,
  water_sound: 1,
  entity_motion: 1,
}

export function buildEntityDrivenStimuli(
  input: EntityStimulusBuildInput
): WorldStimulus[] {
  const runtime = input.worldRuntime

  if (!runtime) return []

  const entities = runtime.entities.entities.filter(isRenderableStimulusEntity)
  const candidates = buildEntityStimulusCandidates({
    entities,
    existingStimuli: input.existingStimuli,
    tick: input.tick,
  })

  const selectedCandidates = selectEntityStimulusCandidates({
    candidates,
    existingStimuli: input.existingStimuli,
  })

  return selectedCandidates.map((candidate) =>
    createWorldStimulus({
      type: candidate.template.type,
      category: "entity",
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      period: input.time.period,
      intensity: candidate.template.intensity,
      durationTick: candidate.template.durationTick,
      summary: candidate.template.summary,
      tags: candidate.template.tags,
      worldPosition: {
        x: candidate.entity.position.x,
        y: candidate.entity.position.y,
      },
      spatialRadius: readEntityStimulusRadius(candidate.entity),
      source: {
        kind: "world_entity",
        id: candidate.entity.id,
        type: candidate.entity.type,
        name: candidate.entity.name,
      },
    })
  )
}

function buildEntityStimulusCandidates(input: {
  entities: WorldRuntimeEntity[]
  existingStimuli: WorldStimulus[]
  tick: number
}): EntityStimulusCandidate[] {
  const candidates: EntityStimulusCandidate[] = []

  for (const entity of input.entities) {
    if (hasActiveStimulusFromEntity(input.existingStimuli, entity.id)) {
      continue
    }

    const template = getEntityStimulusTemplate(entity)

    if (!template) continue

    if (!shouldGenerateEntityStimulus(entity, template.type, input.tick)) {
      continue
    }

    candidates.push({
      entity,
      template,
      score: createEntityStimulusScore(entity.id, entity.type, input.tick),
    })
  }

  return candidates.sort((a, b) => b.score - a.score)
}

function selectEntityStimulusCandidates(input: {
  candidates: EntityStimulusCandidate[]
  existingStimuli: WorldStimulus[]
}): EntityStimulusCandidate[] {
  const selected: EntityStimulusCandidate[] = []
  const selectedTypeCount = new Map<WorldStimulusType, number>()

  for (const candidate of input.candidates) {
    if (selected.length >= MAX_ENTITY_STIMULI_PER_TICK) break

    const type = candidate.template.type
    const activeTypeCount = countActiveStimuliByType(input.existingStimuli, type)
    const softLimit = ACTIVE_TYPE_SOFT_LIMIT[type] ?? 1

    if (activeTypeCount >= softLimit) {
      continue
    }

    const currentSelectedCount = selectedTypeCount.get(type) ?? 0
    const maxPerTick = MAX_STIMULI_PER_TYPE_PER_TICK[type] ?? 1

    if (currentSelectedCount >= maxPerTick) {
      continue
    }

    selected.push(candidate)
    selectedTypeCount.set(type, currentSelectedCount + 1)
  }

  return selected
}

function isRenderableStimulusEntity(entity: WorldRuntimeEntity): boolean {
  if (!entity.active) return false

  return (
    entity.type === "tree" ||
    entity.type === "flower" ||
    entity.type === "water" ||
    entity.type === "butterfly"
  )
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
  stimulusType: WorldStimulusType,
  tick: number
): boolean {
  const baseRate = getEntityStimulusRate(entity, stimulusType)

  if (baseRate <= 0) return false

  const seed = createEntityStimulusSeed(entity.id, entity.type, tick)
  const normalized = (seed % 1000) / 1000

  return normalized < baseRate
}

function getEntityStimulusRate(
  entity: WorldRuntimeEntity,
  stimulusType: WorldStimulusType
): number {
  if (stimulusType === "tree_presence") return 0.07
  if (stimulusType === "flower_scent") return 0.1
  if (stimulusType === "water_sound") return 0.11
  if (stimulusType === "entity_motion") return 0.14

  if (entity.type === "tree") return 0.07
  if (entity.type === "flower") return 0.1
  if (entity.type === "water") return 0.11
  if (entity.type === "butterfly") return 0.14

  return 0
}

function hasActiveStimulusFromEntity(
  stimuli: WorldStimulus[],
  entityId: string
): boolean {
  return stimuli.some((stimulus) => stimulus.source?.id === entityId)
}

function countActiveStimuliByType(
  stimuli: WorldStimulus[],
  type: WorldStimulusType
): number {
  return stimuli.filter((stimulus) => stimulus.type === type).length
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

function createEntityStimulusScore(
  entityId: string,
  entityType: string,
  tick: number
): number {
  let score = tick * 71 + entityType.length * 37

  for (let index = 0; index < entityId.length; index += 1) {
    score += entityId.charCodeAt(index) * (index + 5)
  }

  return Math.abs(score % 10000)
}