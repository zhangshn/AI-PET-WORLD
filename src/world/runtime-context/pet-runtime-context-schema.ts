/**
 * 当前文件职责：定义宠物运行时状态协议与基础校验 helper。
 */

export const PET_RUNTIME_CONTEXT_VERSION = "pet_runtime_context_v0"

export type PetRuntimeLifeStage =
  | "accepted"
  | "young"
  | "adult"
  | "unknown"

export type PetRuntimeMood =
  | "stable"
  | "relaxed"
  | "curious"
  | "excited"
  | "tired"
  | "hungry"
  | "uneasy"
  | "guarded"
  | "low"
  | "unknown"

export type PetRuntimeDrive =
  | "eat"
  | "rest"
  | "approach"
  | "explore"
  | "observe"
  | "avoid"
  | "none"

export type PetRuntimeAction =
  | "sleeping"
  | "resting"
  | "eating"
  | "walking"
  | "exploring"
  | "observing"
  | "approaching"
  | "avoiding"
  | "idle"
  | "unknown"

export type PetRuntimeHealthState =
  | "stable"
  | "recovering"
  | "fragile"
  | "unwell"
  | "unknown"

export type PetRuntimeRelationState =
  | "unformed"
  | "attached"
  | "trusting"
  | "guarded"
  | "distant"
  | "unknown"

export type PetRuntimeNeedType =
  | "food"
  | "rest"
  | "safety"
  | "social_contact"
  | "exploration"
  | "health"
  | "environment"
  | "none"

export type PetRuntimeObservationType =
  | "body_state"
  | "mood_state"
  | "drive_state"
  | "relation_state"
  | "environment_state"
  | "world_state"
  | "unknown"

export type PetRuntimeNeedSignal = {
  id: string
  type: PetRuntimeNeedType
  urgency: "none" | "low" | "medium" | "high" | "critical"
  score: number
  reason: string
  tags: string[]
}

export type PetRuntimeObservation = {
  id: string
  observedAt: number
  type: PetRuntimeObservationType
  message: string
  source: "world_loop" | "runtime" | "manual" | "system"
  tags: string[]
}

export type PetRuntimeLocationState = {
  zoneId?: string
  zoneType?: string
  x?: number
  y?: number
  label: string
  tags: string[]
}

export type PetRuntimeProfileLink = {
  source: "birth_time_profile" | "accepted_adoption_profile" | "runtime_generated"
  profileId?: string
  summary: string
  tags: string[]
}

export type PetRuntimeContext = {
  version: typeof PET_RUNTIME_CONTEXT_VERSION
  petId: string
  worldId: string
  ownerId: string
  tickIndex: number

  lifeStage: PetRuntimeLifeStage
  mood: PetRuntimeMood
  currentDrive: PetRuntimeDrive
  currentAction: PetRuntimeAction
  healthState: PetRuntimeHealthState
  relationState: PetRuntimeRelationState

  energy: number
  hunger: number
  comfort: number
  curiosity: number
  trust: number

  location: PetRuntimeLocationState
  needSignals: PetRuntimeNeedSignal[]
  observations: PetRuntimeObservation[]

  profileLink: PetRuntimeProfileLink

  updatedAt: number
  tags: string[]
}

export type BuildAcceptedAdoptionPetRuntimeContextInput = {
  worldId: string
  ownerId: string
  tickIndex: number
  now: number
  petId?: string
  lifeStage?: PetRuntimeLifeStage
}

export type PetRuntimeContextValidationResult = {
  isValid: boolean
  reasons: string[]
  warnings: string[]
  tags: string[]
}

export type ValidatePetRuntimeContextInput = {
  context: PetRuntimeContext
  expectedWorldId: string
  expectedOwnerId: string
}

export type PetRuntimeContextSummary = {
  petId: string
  worldId: string
  ownerId: string
  tickIndex: number
  lifeStage: PetRuntimeLifeStage
  mood: PetRuntimeMood
  currentDrive: PetRuntimeDrive
  currentAction: PetRuntimeAction
  healthState: PetRuntimeHealthState
  relationState: PetRuntimeRelationState
  energy: number
  hunger: number
  topNeedSignal?: {
    type: PetRuntimeNeedType
    urgency: PetRuntimeNeedSignal["urgency"]
    score: number
    reason: string
  }
  observationCount: number
  needSignalCount: number
  updatedAt: number
  tags: string[]
}

export function buildAcceptedAdoptionPetRuntimeContext(
  input: BuildAcceptedAdoptionPetRuntimeContextInput
): PetRuntimeContext {
  const lifeStage = input.lifeStage ?? "accepted"
  const petId = input.petId ?? `pet-${input.worldId}`
  const energy = 60
  const hunger = 35
  const comfort = 55
  const curiosity = 45
  const trust = 30
  const mood: PetRuntimeMood = "stable"
  const currentDrive: PetRuntimeDrive = "observe"
  const currentAction: PetRuntimeAction = "observing"
  const healthState: PetRuntimeHealthState = "stable"
  const relationState: PetRuntimeRelationState = "guarded"

  return {
    version: PET_RUNTIME_CONTEXT_VERSION,
    petId,
    worldId: input.worldId,
    ownerId: input.ownerId,
    tickIndex: input.tickIndex,
    lifeStage,
    mood,
    currentDrive,
    currentAction,
    healthState,
    relationState,
    energy,
    hunger,
    comfort,
    curiosity,
    trust,
    location: {
      label: "已接纳后的家园位置",
      tags: ["accepted_adoption_pet_location", "accepted_adoption_home"],
    },
    needSignals: [
      {
        id: `pet-need-${input.worldId}-${input.tickIndex}`,
        type: "environment",
        urgency: "low",
        score: 30,
        reason: "已接纳宠物正在观察当前家园环境。",
        tags: ["accepted_adoption_pet_need_signal", lifeStage, "accepted_adoption_pet"],
      },
    ],
    observations: [
      {
        id: `pet-observation-${input.worldId}-${input.tickIndex}`,
        observedAt: input.now,
        type: "world_state",
        message: "已接纳宠物进入家园运行态，正在感知周围环境。",
        source: "runtime",
        tags: ["accepted_adoption_pet_observation", lifeStage, "accepted_adoption_pet"],
      },
    ],
    profileLink: {
      source: "accepted_adoption_profile",
      summary:
        "当前使用已接纳宠物的默认运行时画像；后续可接入生命关系事件生成的宠物人格摘要。",
      tags: ["accepted_adoption_pet_profile_link", lifeStage, "accepted_adoption_pet"],
    },
    updatedAt: input.now,
    tags: [
      "pet_runtime_context_v0",
      "accepted_adoption_pet_runtime_context",
      `world:${input.worldId}`,
      `owner:${input.ownerId}`,
      `life_stage:${lifeStage}`,
    ],
  }
}

export function validatePetRuntimeContext(
  input: ValidatePetRuntimeContextInput
): PetRuntimeContextValidationResult {
  const reasons: string[] = []
  const warnings: string[] = []
  const { context } = input

  if (context.version !== PET_RUNTIME_CONTEXT_VERSION) {
    reasons.push("宠物 runtime context 版本不匹配。")
  }

  if (context.worldId !== input.expectedWorldId) {
    reasons.push("宠物 runtime context worldId 不匹配。")
  }

  if (context.ownerId !== input.expectedOwnerId) {
    reasons.push("宠物 runtime context ownerId 不匹配。")
  }

  if (context.tickIndex < 0) {
    reasons.push("宠物 runtime context tickIndex 非法。")
  }

  if (context.petId.trim().length === 0) {
    reasons.push("宠物 runtime context petId 不能为空。")
  }

  if (context.updatedAt < 0) {
    reasons.push("宠物 runtime context updatedAt 非法。")
  }

  if (
    !isPetRuntimeValueInRange(context.energy) ||
    !isPetRuntimeValueInRange(context.hunger) ||
    !isPetRuntimeValueInRange(context.comfort) ||
    !isPetRuntimeValueInRange(context.curiosity) ||
    !isPetRuntimeValueInRange(context.trust)
  ) {
    reasons.push("宠物 runtime context 数值字段必须在 0 到 100 之间。")
  }

  if (
    context.needSignals.some(
      (needSignal) => !isPetRuntimeValueInRange(needSignal.score)
    )
  ) {
    reasons.push("宠物 runtime context need signal score 必须在 0 到 100 之间。")
  }

  if (context.needSignals.length === 0) {
    warnings.push("宠物 runtime context 当前没有 need signal。")
  }

  if (context.observations.length === 0) {
    warnings.push("宠物 runtime context 当前没有 observation。")
  }

  return {
    isValid: reasons.length === 0,
    reasons,
    warnings,
    tags: [
      "pet_runtime_context_validation",
      reasons.length === 0 ? "valid" : "invalid",
    ],
  }
}

export function buildPetRuntimeContextSummary(
  context: PetRuntimeContext
): PetRuntimeContextSummary {
  const topNeedSignal = findTopPetNeedSignal(context.needSignals)

  return {
    petId: context.petId,
    worldId: context.worldId,
    ownerId: context.ownerId,
    tickIndex: context.tickIndex,
    lifeStage: context.lifeStage,
    mood: context.mood,
    currentDrive: context.currentDrive,
    currentAction: context.currentAction,
    healthState: context.healthState,
    relationState: context.relationState,
    energy: context.energy,
    hunger: context.hunger,
    topNeedSignal: topNeedSignal
      ? {
          type: topNeedSignal.type,
          urgency: topNeedSignal.urgency,
          score: topNeedSignal.score,
          reason: topNeedSignal.reason,
        }
      : undefined,
    observationCount: context.observations.length,
    needSignalCount: context.needSignals.length,
    updatedAt: context.updatedAt,
    tags: [
      "pet_runtime_context_summary",
      `life_stage:${context.lifeStage}`,
      `mood:${context.mood}`,
      `drive:${context.currentDrive}`,
      `action:${context.currentAction}`,
    ],
  }
}

export function findTopPetNeedSignal(
  needSignals: PetRuntimeNeedSignal[]
): PetRuntimeNeedSignal | undefined {
  return [...needSignals].sort((leftNeedSignal, rightNeedSignal) => {
    if (rightNeedSignal.score !== leftNeedSignal.score) {
      return rightNeedSignal.score - leftNeedSignal.score
    }

    return (
      getPetNeedUrgencyWeight(rightNeedSignal.urgency) -
      getPetNeedUrgencyWeight(leftNeedSignal.urgency)
    )
  })[0]
}

export function getPetNeedUrgencyWeight(
  urgency: PetRuntimeNeedSignal["urgency"]
): number {
  if (urgency === "critical") return 5
  if (urgency === "high") return 4
  if (urgency === "medium") return 3
  if (urgency === "low") return 2

  return 1
}

export function isPetRuntimeValueInRange(value: number): boolean {
  return value >= 0 && value <= 100
}
