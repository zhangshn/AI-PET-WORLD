/**
 * 当前文件负责：根据性别人格解释结果生成最终行为偏置。
 */

import type {
  BuildGenderAwareBehaviorBiasInput,
  FiveDimensionKey,
  GenderAwareBehaviorBias,
  PersonalityInterpretationProfile,
} from "./interpretation-schema"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function readDimensionScore(
  profile: PersonalityInterpretationProfile,
  key: FiveDimensionKey
): number {
  return (
    profile.fiveDimensionProfile.dimensions.find((item) => item.key === key)
      ?.score ?? 50
  )
}

export function buildGenderAwareBehaviorBias(
  input: BuildGenderAwareBehaviorBiasInput
): GenderAwareBehaviorBias {
  const profile = input.interpretationProfile

  const exploration = readDimensionScore(profile, "exploration")
  const attachment = readDimensionScore(profile, "attachment")
  const stability = readDimensionScore(profile, "stability")
  const execution = readDimensionScore(profile, "execution")
  const caregiving = readDimensionScore(profile, "caregiving")

  const activityBias = clamp(exploration * 0.45 + execution * 0.35 + stability * 0.1)
  const observationBias = clamp(stability * 0.25 + attachment * 0.25 + caregiving * 0.3)
  const riskBias = clamp(exploration * 0.55 + execution * 0.25 + (100 - stability) * 0.15)

  return {
    petBehaviorBias: {
      newbornActivity: activityBias,
      observationNeed: observationBias,
      attachmentNeed: clamp(attachment * 0.65 + caregiving * 0.25),
      explorationRange: clamp(exploration * 0.7 + execution * 0.15),
      restNeed: clamp(stability * 0.55 + attachment * 0.2 + (100 - exploration) * 0.1),
    },
    butlerBehaviorBias: {
      carePriority: clamp(caregiving * 0.55 + attachment * 0.25 + stability * 0.1),
      constructionDrive: clamp(execution * 0.55 + stability * 0.2 + exploration * 0.1),
      routinePreference: clamp(stability * 0.45 + execution * 0.3 + attachment * 0.1),
      riskTolerance: riskBias,
      responseSpeed: clamp(execution * 0.35 + exploration * 0.35 + stability * 0.1),
    },
    buildingBias: {
      expansionPreference: clamp(exploration * 0.55 + execution * 0.2),
      stabilityPreference: clamp(stability * 0.55 + attachment * 0.15 + execution * 0.1),
      comfortPreference: clamp(attachment * 0.35 + caregiving * 0.25 + stability * 0.25),
      orderPreference: clamp(execution * 0.45 + stability * 0.35),
      adaptabilityPreference: clamp(exploration * 0.35 + stability * 0.2 + attachment * 0.15),
    },
    debug: {
      source: "gender_aware_interpretation",
      note: "最终行为偏置由已完成男女映射的五维人格生成，不再使用未分男女的基础人格向量直接决定最终行为。",
    },
  }
}