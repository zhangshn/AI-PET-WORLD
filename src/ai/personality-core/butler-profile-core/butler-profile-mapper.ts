/**
 * 当前文件负责：根据用户出生信息与映射模式生成管家人格核心。
 */

import {
  buildLifePersonalityProfile,
} from "../life-profile-core/life-profile-gateway"

import type {
  LifePersonalityProfileBundle,
} from "../life-profile-core/life-profile-gateway"

import type {
  GenderAwareBehaviorBias,
  GenderPerspective,
} from "../personality-interpretation-core/interpretation-gateway"

import type {
  ButlerBirthTimeMode,
  ButlerBoundaryStyle,
  ButlerBuildStyle,
  ButlerCareStyle,
  ButlerMappingMode,
  ButlerOpportunityStyle,
  ButlerProfile,
  ButlerProfileBias,
  ButlerProfileBirthInput,
  ButlerProfileInput,
} from "./butler-profile-schema"

const DEFAULT_BUTLER_GENDER_PERSPECTIVE: GenderPerspective = "male"

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 50
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveBirthTimeMode(
  birth: ButlerProfileBirthInput
): ButlerBirthTimeMode {
  if (
    typeof birth.hour === "number" &&
    typeof birth.minute === "number"
  ) {
    return "full_datetime"
  }

  return "date_only"
}

function buildSeedFromBirth(birth: ButlerProfileBirthInput): number {
  const hour = birth.hour ?? 12
  const minute = birth.minute ?? 0

  return (
    birth.year * 37 +
    birth.month * 41 +
    birth.day * 43 +
    hour * 47 +
    minute * 53
  )
}

function buildBaseBias(birth: ButlerProfileBirthInput): ButlerProfileBias {
  const seed = buildSeedFromBirth(birth)

  return {
    carePriority: clampScore(45 + (seed % 31)),
    constructionDrive: clampScore(40 + ((seed >> 1) % 36)),
    observationPatience: clampScore(42 + ((seed >> 2) % 34)),
    boundarySensitivity: clampScore(38 + ((seed >> 3) % 40)),
    opportunityInitiative: clampScore(40 + ((seed >> 4) % 38)),
  }
}

function buildButlerLifeProfile(
  input: ButlerProfileInput
): LifePersonalityProfileBundle {
  const hasBirthHour = typeof input.birth.hour === "number"
  const genderPerspective =
    input.genderPerspective ?? DEFAULT_BUTLER_GENDER_PERSPECTIVE

  return buildLifePersonalityProfile({
    subjectType: "butler",
    birthInput: {
      year: input.birth.year,
      month: input.birth.month,
      day: input.birth.day,
      hour: input.birth.hour ?? null,
      minute: input.birth.minute ?? null,
    },
    genderPerspective,
    hasBirthHour,
  })
}

function buildBiasFromLifeProfile(input: {
  lifeProfile: LifePersonalityProfileBundle
  birth: ButlerProfileBirthInput
}): ButlerProfileBias {
  const butlerBias =
    input.lifeProfile.genderAwareBehaviorBias.butlerBehaviorBias
  const seedFlavor = buildBaseBias(input.birth)

  return {
    carePriority: clampScore(
      butlerBias.carePriority + (seedFlavor.carePriority - 50) * 0.04
    ),
    constructionDrive: clampScore(
      butlerBias.constructionDrive +
        (seedFlavor.constructionDrive - 50) * 0.04
    ),
    observationPatience: clampScore(
      butlerBias.routinePreference * 0.55 +
        butlerBias.carePriority * 0.25 +
        (100 - butlerBias.riskTolerance) * 0.15
    ),
    boundarySensitivity: clampScore(
      (100 - butlerBias.riskTolerance) * 0.45 +
        butlerBias.routinePreference * 0.25 +
        butlerBias.carePriority * 0.2
    ),
    opportunityInitiative: clampScore(
      butlerBias.responseSpeed * 0.45 +
        butlerBias.carePriority * 0.25 +
        butlerBias.constructionDrive * 0.15
    ),
  }
}

function applyMappingModeBias(
  base: ButlerProfileBias,
  mappingMode: ButlerMappingMode
): ButlerProfileBias {
  if (mappingMode === "self_projection") {
    return {
      carePriority: clampScore(base.carePriority + 2),
      constructionDrive: clampScore(base.constructionDrive),
      observationPatience: clampScore(base.observationPatience + 3),
      boundarySensitivity: clampScore(base.boundarySensitivity),
      opportunityInitiative: clampScore(base.opportunityInitiative),
    }
  }

  return {
    carePriority: clampScore(100 - base.carePriority * 0.35),
    constructionDrive: clampScore(base.constructionDrive + 8),
    observationPatience: clampScore(100 - base.observationPatience * 0.25),
    boundarySensitivity: clampScore(base.boundarySensitivity + 6),
    opportunityInitiative: clampScore(base.opportunityInitiative + 10),
  }
}

function pickCareStyle(bias: ButlerProfileBias): ButlerCareStyle {
  if (bias.boundarySensitivity >= 72) return "protective_guardian"
  if (bias.carePriority >= 70) return "active_supporter"
  if (bias.observationPatience >= 70) return "gentle_observer"
  if (bias.constructionDrive >= 70) return "structured_manager"

  return "quiet_maintainer"
}

function pickBuildStyle(bias: ButlerProfileBias): ButlerBuildStyle {
  if (bias.constructionDrive >= 72 && bias.boundarySensitivity >= 65) {
    return "protective_builder"
  }

  if (bias.constructionDrive >= 72) return "steady_builder"
  if (bias.observationPatience >= 70) return "adaptive_builder"
  if (bias.carePriority >= 70) return "aesthetic_builder"

  return "minimal_builder"
}

function pickBoundaryStyle(bias: ButlerProfileBias): ButlerBoundaryStyle {
  if (bias.boundarySensitivity >= 75) return "clear_boundary"
  if (bias.observationPatience >= 70) return "watchful_boundary"
  if (bias.boundarySensitivity <= 40) return "soft_boundary"

  return "balanced_boundary"
}

function pickOpportunityStyle(
  bias: ButlerProfileBias
): ButlerOpportunityStyle {
  if (bias.opportunityInitiative >= 75) return "offer_actively"
  if (bias.observationPatience >= 70) return "offer_after_observation"
  if (bias.carePriority >= 68) return "offer_gently"

  return "offer_when_needed"
}

function buildIdentitySummary(input: {
  mappingMode: ButlerMappingMode
  birthTimeMode: ButlerBirthTimeMode
}): string {
  if (input.mappingMode === "self_projection") {
    return input.birthTimeMode === "full_datetime"
      ? "管家以用户完整出生时间为基础，更接近用户在这个世界中的自我投影。"
      : "管家以用户出生日期为基础，形成接近用户现实气质的日期模式自我投影。"
  }

  return input.birthTimeMode === "full_datetime"
    ? "管家以用户完整出生时间为基础，生成一个被平行世界重新塑造的自我分身。"
    : "管家以用户出生日期为基础，生成一个偏向平行世界补足与偏移的自我分身。"
}

function buildPublicSummary(input: {
  mappingMode: ButlerMappingMode
  careStyle: ButlerCareStyle
  buildStyle: ButlerBuildStyle
  boundaryStyle: ButlerBoundaryStyle
  opportunityStyle: ButlerOpportunityStyle
}): string {
  const modeText =
    input.mappingMode === "self_projection"
      ? "映射自己"
      : "平行世界"

  return [
    `当前管家采用「${modeText}」模式。`,
    `照护风格：${input.careStyle}。`,
    `建设风格：${input.buildStyle}。`,
    `边界风格：${input.boundaryStyle}。`,
    `机会提供方式：${input.opportunityStyle}。`,
  ].join("")
}

export function buildButlerProfile(
  input: ButlerProfileInput
): ButlerProfile {
  const birthTimeMode = resolveBirthTimeMode(input.birth)
  const lifeProfile = buildButlerLifeProfile(input)
  const behaviorBias: GenderAwareBehaviorBias =
    lifeProfile.genderAwareBehaviorBias
  const baseBias = buildBiasFromLifeProfile({
    lifeProfile,
    birth: input.birth,
  })
  const bias = applyMappingModeBias(baseBias, input.mappingMode)

  const careStyle = pickCareStyle(bias)
  const buildStyle = pickBuildStyle(bias)
  const boundaryStyle = pickBoundaryStyle(bias)
  const opportunityStyle = pickOpportunityStyle(bias)

  const identity = {
    displayName: input.displayName?.trim() || "管家",
    mappingMode: input.mappingMode,
    birthTimeMode,
    identitySummary: buildIdentitySummary({
      mappingMode: input.mappingMode,
      birthTimeMode,
    }),
  }

  return {
    identity,
    birth: input.birth,
    lifeProfile,
    behaviorBias,
    source: {
      sourceType: "player_birth_data",
      algorithm: "life_profile_core",
    },
    careStyle,
    buildStyle,
    boundaryStyle,
    opportunityStyle,
    bias,
    publicSummary: buildPublicSummary({
      mappingMode: input.mappingMode,
      careStyle,
      buildStyle,
      boundaryStyle,
      opportunityStyle,
    }),
    internalNotes: [
      "管家不是普通 NPC，而是用户生命数据映射 / 平行世界人格投射。",
      "管家创建时有先天人格，但没有世界经历记忆；经历必须在世界运行中逐步形成。",
      "管家拥有自主判断，承担照看、教育、引导、保护、解释和环境管理职责。",
      "管家不能替宠物做决定；对宠物的照护、靠近、食物、休息和互动必须以机会或环境条件进入宠物自己的判断链。",
      "管家可以提供机会、保持距离、保护性回应、记录经验、调整照看方式，但不是只能维护环境或提供机会的工具。",
    ],
  }
}
