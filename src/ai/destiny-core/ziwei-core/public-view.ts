/**
 * 当前文件负责：将紫微原始人格资料转换为公开展示视图。
 */

import type { PersonalityProfile } from "./schema"

export type PublicPersonalityView = {
  innateTemperament: string
  currentPhase: string
  visibleTraits: string[]
  behaviorTendencies: string[]
  summary: string
}

function resolveInnateTemperament(profile: PersonalityProfile): string {
  return profile.tags[0] ?? "均衡气质"
}

function resolveCurrentPhase(profile: PersonalityProfile): string {
  if (profile.traits.activity >= 68) {
    return "主动探索期"
  }

  if (profile.traits.restPreference >= 68) {
    return "安静恢复期"
  }

  if (profile.traits.emotionalSensitivity >= 68) {
    return "敏感观察期"
  }

  if (profile.traits.stability >= 68) {
    return "稳定适应期"
  }

  return "自然发展期"
}

function buildVisibleTraits(profile: PersonalityProfile): string[] {
  const traits = profile.tags.slice(0, 5)

  if (traits.length > 0) {
    return traits
  }

  return ["均衡", "观察中", "自然发展"]
}

function buildBehaviorTendencies(profile: PersonalityProfile): string[] {
  const tendencies: string[] = []

  if (profile.traits.activity >= 65) {
    tendencies.push("更容易主动接近环境")
  }

  if (profile.traits.curiosity >= 65) {
    tendencies.push("对新变化更敏感")
  }

  if (profile.traits.caregiving >= 65) {
    tendencies.push("更容易出现照看与守护倾向")
  }

  if (profile.traits.restPreference >= 65) {
    tendencies.push("更偏好安静、舒适和低刺激环境")
  }

  if (profile.traits.stability <= 40) {
    tendencies.push("状态变化较明显，需要更稳定的环境节奏")
  }

  if (tendencies.length > 0) {
    return tendencies
  }

  return ["整体行为倾向较均衡"]
}

export function buildPublicPersonalityView(
  profile: PersonalityProfile
): PublicPersonalityView {
  return {
    innateTemperament: resolveInnateTemperament(profile),
    currentPhase: resolveCurrentPhase(profile),
    visibleTraits: buildVisibleTraits(profile),
    behaviorTendencies: buildBehaviorTendencies(profile),
    summary:
      profile.summaries[0] ??
      "当前人格结构较均衡，行为倾向会更多随环境和状态变化而展开。",
  }
}