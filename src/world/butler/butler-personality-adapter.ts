/**
 * 当前文件职责：把正式管家人格核心快照转换为 runtime 执行器需要的管家档案。
 */

import type { ButlerProfile } from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

import type {
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
      "runtime_executor_compatibility_layer",
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
      "butler_runtime_profile_build_result",
      "life_profile_core_driven",
      "runtime_executor_compatibility_layer",
      ...input.tags,
    ],
  }
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
