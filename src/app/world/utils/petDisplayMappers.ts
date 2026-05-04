/**
 * 当前文件负责：转换 world 页面宠物展示文案。
 */

import type { PetState } from "@/types/pet"

type DimensionDisplayItem = {
  label: string
  score: number
  summary: string
}

type BiasItem = {
  key: string
  label: string
  value: number
  description: string
}

export function getPetGenderPerspectiveLabel(
  genderPerspective?: PetState["genderPerspective"]
): string {
  if (genderPerspective === "male") return "雄性视角"
  if (genderPerspective === "female") return "雌性视角"

  return "未知视角"
}

export function getLifeProfileModeLabel(
  mode?: PetState["lifeProfile"]["mode"]
): string {
  if (mode === "ziwei_primary") return "完整出生信息"
  if (mode === "bazi_primary") return "基础出生信息"

  return "未生成"
}

export function getPetInnateTemperament(pet: PetState): string {
  return (
    pet.publicPersonalityView?.innateTemperament ??
    pet.lifeProfile.publicPersonalityView?.innateTemperament ??
    pet.lifeProfile.personalityInterpretationProfile.fiveDimensionProfile
      .strongestDimensions[0]?.label ??
    "均衡气质"
  )
}

export function getPetCurrentTendency(pet: PetState): string {
  return (
    pet.publicPersonalityView?.currentPhase ??
    pet.lifeProfile.publicPersonalityView?.currentPhase ??
    pet.lifeProfile.personalityInterpretationProfile.fiveDimensionProfile
      .strongestDimensions[0]?.summary ??
    "自然发展中"
  )
}

export function getPetVisibleTraits(pet: PetState): string[] {
  const traits =
    pet.publicPersonalityView?.visibleTraits ??
    pet.lifeProfile.publicPersonalityView?.visibleTraits ??
    []

  if (traits.length > 0) {
    return traits.slice(0, 5)
  }

  return ["观察中", "自然发展", "状态稳定"]
}

export function getPetBehaviorTendencyText(pet: PetState): string {
  const tendencies =
    pet.publicPersonalityView?.behaviorTendencies ??
    pet.lifeProfile.publicPersonalityView?.behaviorTendencies ??
    []

  return tendencies[0] ?? "整体行为会随环境、状态和当前需求自然展开。"
}

export function getTopFiveDimensionItems(
  pet: PetState,
  limit = 3
): DimensionDisplayItem[] {
  const fiveDimensionProfile =
    pet.lifeProfile.personalityInterpretationProfile.fiveDimensionProfile

  const source =
    fiveDimensionProfile.strongestDimensions.length > 0
      ? fiveDimensionProfile.strongestDimensions
      : [...fiveDimensionProfile.dimensions].sort(
          (left, right) => right.score - left.score
        )

  return source.slice(0, limit).map((dimension) => ({
    label: dimension.label,
    score: Math.round(dimension.score),
    summary: dimension.summary,
  }))
}

export function getPetBehaviorBiasItems(pet: PetState): BiasItem[] {
  const bias = pet.lifeProfile.genderAwareBehaviorBias.petBehaviorBias

  return [
    {
      key: "newbornActivity",
      label: "活动启动",
      value: bias.newbornActivity,
      description: "更容易开始行动或回应环境变化",
    },
    {
      key: "observationNeed",
      label: "观察需求",
      value: bias.observationNeed,
      description: "更需要先观察环境再做判断",
    },
    {
      key: "attachmentNeed",
      label: "依附需求",
      value: bias.attachmentNeed,
      description: "更重视安全感、陪伴和稳定关系",
    },
    {
      key: "explorationRange",
      label: "探索范围",
      value: bias.explorationRange,
      description: "更愿意扩大活动范围并接触新区域",
    },
    {
      key: "restNeed",
      label: "恢复需求",
      value: bias.restNeed,
      description: "更需要安静、低刺激和恢复时间",
    },
  ]
}

export function getPetMainBehaviorBias(pet: PetState): BiasItem {
  const items = getPetBehaviorBiasItems(pet)

  return items.reduce((strongest, item) => {
    return item.value > strongest.value ? item : strongest
  }, items[0])
}

export function getPetBehaviorBiasSummary(pet: PetState): string {
  const strongestBias = getPetMainBehaviorBias(pet)

  return `当前更明显的是「${strongestBias.label}」，它的行为会更偏向：${strongestBias.description}。`
}

export function getLifePhaseDisplayLabel(
  phase?: PetState["lifeState"]["phase"]
): string {
  if (!phase) return "适应中"

  if (phase === "newborn") return "初生期"
  if (phase === "adaptation") return "适应期"
  if (phase === "dependent") return "依赖期"
  if (phase === "curious") return "好奇期"
  if (phase === "independent") return "独立期"

  return phase
}