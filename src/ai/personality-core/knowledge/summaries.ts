/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge / Summaries
 * ======================================================
 */

import { PersonalityTraits } from "../schema"

export function buildTraitSummaries(traits: PersonalityTraits): string[] {
  const summaries: string[] = []

  if (traits.activity >= 68) summaries.push("行动倾向较强")
  if (traits.restPreference >= 68) summaries.push("更偏好安静与休息")
  if (traits.appetite >= 68) summaries.push("进食欲望较明显")
  if (traits.discipline >= 68) summaries.push("行为节奏较稳定")
  if (traits.curiosity >= 68) summaries.push("对周围变化较敏感")
  if (traits.emotionalSensitivity >= 68) summaries.push("情绪感知较强")
  if (traits.stability >= 68) summaries.push("整体状态较稳定")
  if (traits.caregiving >= 68) summaries.push("照料倾向较强")
  if (traits.buildingPreference >= 68) summaries.push("偏好建设与整理环境")

  if (traits.activity <= 35) summaries.push("行动节奏偏缓")
  if (traits.stability <= 35) summaries.push("状态波动相对明显")
  if (traits.restPreference <= 35) summaries.push("不太愿意长时间静止休息")

  if (summaries.length === 0) {
    summaries.push("整体倾向较均衡")
  }

  return summaries
}

export function mergeUniqueSummaries(items: string[]): string[] {
  const set = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    if (!set.has(item)) {
      set.add(item)
      result.push(item)
    }
  }

  return result
}