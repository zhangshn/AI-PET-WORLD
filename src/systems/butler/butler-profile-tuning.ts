/**
 * 当前文件负责：把管家 Profile 转换成任务选择层可读取的轻量调参。
 */

import type { ButlerProfile } from "@/ai/ai-system-gateway"

export type ButlerProfileTaskTuning = {
  carePriorityOffset: number
  constructionDriveOffset: number
  foodSensitivityOffset: number
  restSensitivityOffset: number
  approachSensitivityOffset: number
  observationBiasOffset: number
}

const DEFAULT_TUNING: ButlerProfileTaskTuning = {
  carePriorityOffset: 0,
  constructionDriveOffset: 0,
  foodSensitivityOffset: 0,
  restSensitivityOffset: 0,
  approachSensitivityOffset: 0,
  observationBiasOffset: 0,
}

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(-20, Math.min(20, Math.round(value)))
}

function applyCareStyleTuning(
  profile: ButlerProfile,
  tuning: ButlerProfileTaskTuning
): ButlerProfileTaskTuning {
  if (profile.careStyle === "active_supporter") {
    return {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 8,
      foodSensitivityOffset: tuning.foodSensitivityOffset + 4,
      restSensitivityOffset: tuning.restSensitivityOffset + 4,
    }
  }

  if (profile.careStyle === "protective_guardian") {
    return {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 6,
      restSensitivityOffset: tuning.restSensitivityOffset + 6,
      observationBiasOffset: tuning.observationBiasOffset + 4,
    }
  }

  if (profile.careStyle === "gentle_observer") {
    return {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 3,
      observationBiasOffset: tuning.observationBiasOffset + 8,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 2,
    }
  }

  if (profile.careStyle === "structured_manager") {
    return {
      ...tuning,
      carePriorityOffset: tuning.carePriorityOffset + 2,
      constructionDriveOffset: tuning.constructionDriveOffset + 6,
    }
  }

  return tuning
}

function applyBuildStyleTuning(
  profile: ButlerProfile,
  tuning: ButlerProfileTaskTuning
): ButlerProfileTaskTuning {
  if (profile.buildStyle === "steady_builder") {
    return {
      ...tuning,
      constructionDriveOffset: tuning.constructionDriveOffset + 8,
    }
  }

  if (profile.buildStyle === "protective_builder") {
    return {
      ...tuning,
      constructionDriveOffset: tuning.constructionDriveOffset + 6,
      restSensitivityOffset: tuning.restSensitivityOffset + 2,
    }
  }

  if (profile.buildStyle === "adaptive_builder") {
    return {
      ...tuning,
      constructionDriveOffset: tuning.constructionDriveOffset + 4,
      observationBiasOffset: tuning.observationBiasOffset + 4,
    }
  }

  if (profile.buildStyle === "aesthetic_builder") {
    return {
      ...tuning,
      constructionDriveOffset: tuning.constructionDriveOffset + 3,
      approachSensitivityOffset: tuning.approachSensitivityOffset + 2,
    }
  }

  if (profile.buildStyle === "minimal_builder") {
    return {
      ...tuning,
      constructionDriveOffset: tuning.constructionDriveOffset - 6,
      observationBiasOffset: tuning.observationBiasOffset + 3,
    }
  }

  return tuning
}

function applyBoundaryStyleTuning(
  profile: ButlerProfile,
  tuning: ButlerProfileTaskTuning
): ButlerProfileTaskTuning {
  if (profile.boundaryStyle === "clear_boundary") {
    return {
      ...tuning,
      restSensitivityOffset: tuning.restSensitivityOffset + 4,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 4,
      observationBiasOffset: tuning.observationBiasOffset + 4,
    }
  }

  if (profile.boundaryStyle === "watchful_boundary") {
    return {
      ...tuning,
      observationBiasOffset: tuning.observationBiasOffset + 6,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 2,
    }
  }

  if (profile.boundaryStyle === "soft_boundary") {
    return {
      ...tuning,
      approachSensitivityOffset: tuning.approachSensitivityOffset + 4,
    }
  }

  return tuning
}

function applyOpportunityStyleTuning(
  profile: ButlerProfile,
  tuning: ButlerProfileTaskTuning
): ButlerProfileTaskTuning {
  if (profile.opportunityStyle === "offer_actively") {
    return {
      ...tuning,
      foodSensitivityOffset: tuning.foodSensitivityOffset + 5,
      restSensitivityOffset: tuning.restSensitivityOffset + 5,
      approachSensitivityOffset: tuning.approachSensitivityOffset + 5,
    }
  }

  if (profile.opportunityStyle === "offer_gently") {
    return {
      ...tuning,
      foodSensitivityOffset: tuning.foodSensitivityOffset + 2,
      restSensitivityOffset: tuning.restSensitivityOffset + 2,
      approachSensitivityOffset: tuning.approachSensitivityOffset + 1,
    }
  }

  if (profile.opportunityStyle === "offer_after_observation") {
    return {
      ...tuning,
      observationBiasOffset: tuning.observationBiasOffset + 8,
      foodSensitivityOffset: tuning.foodSensitivityOffset - 2,
      approachSensitivityOffset: tuning.approachSensitivityOffset - 3,
    }
  }

  return tuning
}

function applyProfileBiasTuning(
  profile: ButlerProfile,
  tuning: ButlerProfileTaskTuning
): ButlerProfileTaskTuning {
  return {
    carePriorityOffset:
      tuning.carePriorityOffset + (profile.bias.carePriority - 50) * 0.16,
    constructionDriveOffset:
      tuning.constructionDriveOffset +
      (profile.bias.constructionDrive - 50) * 0.16,
    foodSensitivityOffset:
      tuning.foodSensitivityOffset +
      (profile.bias.opportunityInitiative - 50) * 0.1,
    restSensitivityOffset:
      tuning.restSensitivityOffset +
      (profile.bias.boundarySensitivity - 50) * 0.08,
    approachSensitivityOffset:
      tuning.approachSensitivityOffset +
      (profile.bias.opportunityInitiative - 50) * 0.08,
    observationBiasOffset:
      tuning.observationBiasOffset +
      (profile.bias.observationPatience - 50) * 0.14,
  }
}

export function buildButlerProfileTaskTuning(
  profile: ButlerProfile | null | undefined
): ButlerProfileTaskTuning {
  if (!profile) {
    return DEFAULT_TUNING
  }

  const withCare = applyCareStyleTuning(profile, DEFAULT_TUNING)
  const withBuild = applyBuildStyleTuning(profile, withCare)
  const withBoundary = applyBoundaryStyleTuning(profile, withBuild)
  const withOpportunity = applyOpportunityStyleTuning(profile, withBoundary)
  const withBias = applyProfileBiasTuning(profile, withOpportunity)

  return {
    carePriorityOffset: clampOffset(withBias.carePriorityOffset),
    constructionDriveOffset: clampOffset(withBias.constructionDriveOffset),
    foodSensitivityOffset: clampOffset(withBias.foodSensitivityOffset),
    restSensitivityOffset: clampOffset(withBias.restSensitivityOffset),
    approachSensitivityOffset: clampOffset(withBias.approachSensitivityOffset),
    observationBiasOffset: clampOffset(withBias.observationBiasOffset),
  }
}