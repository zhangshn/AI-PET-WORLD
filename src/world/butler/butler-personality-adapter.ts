/**
 * 当前文件职责：把玩家出生输入映射为 MVP 管家人格档案。
 */

import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type { ButlerProfile } from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"

import type {
  ButlerMvpBirthInput,
  ButlerMvpBuildResult,
  ButlerMvpProfile,
} from "./butler-mvp-schema"

export function buildButlerMvpProfileFromLifeCore(input: {
  playerId: string
  ownerId: string
  worldId: string
  butlerProfile: ButlerProfile
  constructionStyle: ButlerConstructionStyleVector
  tags: string[]
}): ButlerMvpBuildResult {
  const birthHour = input.butlerProfile.birth.hour
  const profile: ButlerMvpProfile = {
    playerId: input.playerId,
    ownerId: input.ownerId,
    worldId: input.worldId,
    butlerId: `butler:${input.ownerId}`,
    displayName: input.butlerProfile.identity.displayName,
    constructionStyle: input.constructionStyle,
    lifeRhythmBias:
      typeof birthHour === "number" ? buildLifeRhythmBias(birthHour) : "balanced",
    adoptionIntentBias:
      input.constructionStyle.protectiveKeeper >=
      input.constructionStyle.warmCaretaker
        ? "consider"
        : "wait",
    explanationTone: buildExplanationTone(input.constructionStyle),
    visualTendency: buildVisualTendency(input.constructionStyle),
    tags: [
      "butler_runtime_profile",
      "life_profile_core_driven",
      "mvp_executor_compatibility_layer",
      "no_default_adoption_entry",
    ],
  }

  return {
    input: {
      playerId: input.playerId,
      ownerId: input.ownerId,
      worldId: input.worldId,
      birthYear: input.butlerProfile.birth.year,
      birthMonth: input.butlerProfile.birth.month,
      birthDay: input.butlerProfile.birth.day,
      birthHour: birthHour ?? -1,
      timezone: "Asia/Shanghai",
      seed: input.worldId,
      tags: input.tags,
    },
    profile,
    messages: ["管家运行时人格已从正式人格核心快照派生。"],
    tags: [
      "butler_mvp_build_result",
      "life_profile_core_driven",
      "mvp_executor_compatibility_layer",
      ...input.tags,
    ],
  }
}

export function buildButlerMvpProfile(
  input: ButlerMvpBirthInput
): ButlerMvpBuildResult {
  const constructionStyle = buildConstructionStyle(input)
  const profile: ButlerMvpProfile = {
    playerId: input.playerId,
    ownerId: input.ownerId,
    worldId: input.worldId,
    butlerId: `butler:${input.ownerId}`,
    displayName: "管家",
    constructionStyle,
    lifeRhythmBias: buildLifeRhythmBias(input.birthHour),
    adoptionIntentBias:
      constructionStyle.protectiveKeeper >= constructionStyle.warmCaretaker
        ? "consider"
        : "wait",
    explanationTone: buildExplanationTone(constructionStyle),
    visualTendency: buildVisualTendency(constructionStyle),
    tags: [
      "butler_mvp_profile",
      "player_life_projection_manager",
      "not_direct_pet_caretaker_script",
      "no_default_adoption_entry",
    ],
  }

  return {
    input,
    profile,
    messages: ["管家人格档案已根据玩家输入生成。"],
    tags: [
      "butler_mvp_build_result",
      "deterministic_profile_mapping",
      ...input.tags,
    ],
  }
}

function buildConstructionStyle(
  input: ButlerMvpBirthInput
): ButlerConstructionStyleVector {
  const source = [
    input.playerId,
    input.ownerId,
    input.worldId,
    input.seed,
    String(input.birthYear),
    String(input.birthMonth),
    String(input.birthDay),
    String(input.birthHour),
    input.timezone,
  ].join("|")

  return {
    structuredBuilder: buildStyleValue(source, "structuredBuilder"),
    warmCaretaker: buildStyleValue(source, "warmCaretaker"),
    protectiveKeeper: buildStyleValue(source, "protectiveKeeper"),
    aestheticOrganizer: buildStyleValue(source, "aestheticOrganizer"),
    quietMaintainer: buildStyleValue(source, "quietMaintainer"),
    adaptivePlanner: buildStyleValue(source, "adaptivePlanner"),
  }
}

function buildStyleValue(source: string, salt: string): number {
  const unit = hashToUnit(`${source}:${salt}`)

  return Number((0.32 + unit * 0.56).toFixed(3))
}

function buildLifeRhythmBias(
  birthHour: number
): ButlerMvpProfile["lifeRhythmBias"] {
  if (birthHour >= 5 && birthHour < 11) return "morning"
  if (birthHour >= 11 && birthHour < 17) return "day"
  if (birthHour >= 17 && birthHour < 22) return "evening"
  if (birthHour >= 0 && birthHour < 5) return "night"

  return "balanced"
}

function buildExplanationTone(
  style: ButlerConstructionStyleVector
): ButlerMvpProfile["explanationTone"] {
  const entries: Array<{
    tone: ButlerMvpProfile["explanationTone"]
    value: number
  }> = [
    { tone: "structured", value: style.structuredBuilder },
    { tone: "warm", value: style.warmCaretaker },
    { tone: "protective", value: style.protectiveKeeper },
    { tone: "calm", value: style.quietMaintainer },
  ]

  return entries.sort((left, right) => right.value - left.value)[0].tone
}

function buildVisualTendency(
  style: ButlerConstructionStyleVector
): ButlerMvpProfile["visualTendency"] {
  if (style.protectiveKeeper >= 0.72) return "protective"
  if (style.quietMaintainer >= 0.72) return "quiet"
  if (style.warmCaretaker >= 0.72) return "warmNatural"

  return "ordered"
}

function hashToUnit(value: string): number {
  return hashText(value) / 0xffffffff
}

function hashText(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
