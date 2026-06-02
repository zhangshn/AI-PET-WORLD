/**
 * 当前文件负责：由 ButlerProfile / 八字管家人格解释关系事实与机会反馈。
 */

import type { ButlerProfile } from "@/ai/ai-system-gateway"

import type { ButlerMemoryState } from "./butler-memory"
import type { ButlerRelationState } from "./butler-relation"

export type ButlerRelationTaskTuning = {
  carePriorityOffset: number
  constructionDriveOffset: number
  foodSensitivityOffset: number
  restSensitivityOffset: number
  approachSensitivityOffset: number
  observationBiasOffset: number
}

export type ButlerExperienceMode =
  | "profile_led"
  | "relation_fact_only"

export type ButlerDominantInterpretation =
  | "none"
  | "quiet_maintenance"
  | "need_based_support"
  | "active_support"
  | "boundary_respect"
  | "protective_observation"
  | "environment_adjustment"
  | "gentle_approach"
  | "structured_management"

export type ButlerSuggestedPosture =
  | "none"
  | "observe_softly"
  | "maintain_environment"
  | "offer_need_based_support"
  | "offer_gentle_support"
  | "hold_boundary"
  | "approach_gently"
  | "reorganize_tasks"

export type ButlerExperienceInterpreterInput = {
  relation: ButlerRelationState | null | undefined
  profile: ButlerProfile | null | undefined
  memory?: ButlerMemoryState | null | undefined
}

export type ButlerExperienceInterpretation = {
  mode: ButlerExperienceMode
  profileSource: string
  dominantInterpretation: ButlerDominantInterpretation
  suggestedPosture: ButlerSuggestedPosture
  interpretationTags: string[]
  tuning: ButlerRelationTaskTuning
  reasons: string[]
  boundary: {
    relationControlsBehavior: false
    feedbackControlsBehavior: false
    profileInterpretsFacts: true
  }
}

const DEFAULT_TUNING: ButlerRelationTaskTuning = {
  carePriorityOffset: 0,
  constructionDriveOffset: 0,
  foodSensitivityOffset: 0,
  restSensitivityOffset: 0,
  approachSensitivityOffset: 0,
  observationBiasOffset: 0,
}

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-14, Math.min(14, Math.round(value)))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function getBiasLevel(value: number): number {
  return clamp01(value / 100)
}

function getTrustLevel(relation: ButlerRelationState): number {
  return clamp01(relation.trustEstimate / 80)
}

function getFamiliarityLevel(relation: ButlerRelationState): number {
  return clamp01(relation.familiarity / 70)
}

function getSuccessLevel(relation: ButlerRelationState): number {
  return clamp01(relation.successfulOffers / 8)
}

function getRejectionLevel(relation: ButlerRelationState): number {
  return clamp01(relation.rejectedOffers / 5)
}

function addTuning(
  base: ButlerRelationTaskTuning,
  delta: Partial<ButlerRelationTaskTuning>
): ButlerRelationTaskTuning {
  return {
    carePriorityOffset:
      base.carePriorityOffset + (delta.carePriorityOffset ?? 0),
    constructionDriveOffset:
      base.constructionDriveOffset + (delta.constructionDriveOffset ?? 0),
    foodSensitivityOffset:
      base.foodSensitivityOffset + (delta.foodSensitivityOffset ?? 0),
    restSensitivityOffset:
      base.restSensitivityOffset + (delta.restSensitivityOffset ?? 0),
    approachSensitivityOffset:
      base.approachSensitivityOffset + (delta.approachSensitivityOffset ?? 0),
    observationBiasOffset:
      base.observationBiasOffset + (delta.observationBiasOffset ?? 0),
  }
}

function finalizeTuning(
  tuning: ButlerRelationTaskTuning
): ButlerRelationTaskTuning {
  return {
    carePriorityOffset: clampOffset(tuning.carePriorityOffset),
    constructionDriveOffset: clampOffset(tuning.constructionDriveOffset),
    foodSensitivityOffset: clampOffset(tuning.foodSensitivityOffset),
    restSensitivityOffset: clampOffset(tuning.restSensitivityOffset),
    approachSensitivityOffset: clampOffset(tuning.approachSensitivityOffset),
    observationBiasOffset: clampOffset(tuning.observationBiasOffset),
  }
}

function createBoundary() {
  return {
    relationControlsBehavior: false as const,
    feedbackControlsBehavior: false as const,
    profileInterpretsFacts: true as const,
  }
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}

function buildProfileSource(profile: ButlerProfile | null | undefined): string {
  if (!profile) return "no_profile"

  return [
    profile.careStyle,
    profile.buildStyle,
    profile.boundaryStyle,
    profile.opportunityStyle,
  ].join(" / ")
}

function buildRelationFactOnlyInterpretation(
  relation: ButlerRelationState | null | undefined
): ButlerExperienceInterpretation {
  if (!relation) {
    return {
      mode: "relation_fact_only",
      profileSource: "no_profile",
      dominantInterpretation: "none",
      suggestedPosture: "none",
      interpretationTags: [
        "no_profile",
        "no_relation",
        "fact_only",
      ],
      tuning: DEFAULT_TUNING,
      reasons: [
        "没有 ButlerProfile，也没有可解释的关系事实；RelationTuning 保持为 0。",
      ],
      boundary: createBoundary(),
    }
  }

  let tuning = {
    ...DEFAULT_TUNING,
  }

  if (relation.tone === "unfamiliar") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
      approachSensitivityOffset: -1,
    })
  }

  if (relation.tone === "observing") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
    })
  }

  if (relation.tone === "familiar") {
    tuning = addTuning(tuning, {
      approachSensitivityOffset: 1,
    })
  }

  if (relation.tone === "trusted") {
    tuning = addTuning(tuning, {
      carePriorityOffset: 1,
      approachSensitivityOffset: 1,
    })
  }

  if (relation.tone === "guarded") {
    tuning = addTuning(tuning, {
      observationBiasOffset: 1,
      approachSensitivityOffset: -1,
    })
  }

  return {
    mode: "relation_fact_only",
    profileSource: "no_profile",
    dominantInterpretation: "none",
    suggestedPosture: "observe_softly",
    interpretationTags: [
      "no_profile",
      "fact_only",
      `relation_tone_${relation.tone}`,
    ],
    tuning: finalizeTuning(tuning),
    reasons: [
      "当前缺少 ButlerProfile，因此 Relation 只能提供极弱事实偏移。",
      "没有 Profile 时，rejectedOffers / accepted feedback 不允许直接强控制管家行为。",
    ],
    boundary: createBoundary(),
  }
}

function interpretToneByProfile(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}) {
  const { relation, profile } = input
  const trust = getTrustLevel(relation)
  const familiarity = getFamiliarityLevel(relation)
  const success = getSuccessLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }
  const reasons: string[] = []
  const tags: string[] = [
    `relation_tone_${relation.tone}`,
  ]

  if (relation.tone === "unfamiliar") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        profile.bias.observationPatience >= 55 ? 2 : 1,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 60 ? -2 : -1,
    })

    tags.push("tone_unfamiliar_profile_interpreted")
    reasons.push(
      "关系事实为 unfamiliar；由 Profile 的观察耐心和边界敏感度解释为初期谨慎观察。"
    )
  }

  if (relation.tone === "observing") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        profile.bias.observationPatience >= 60 ? 2 : 1,
      approachSensitivityOffset:
        familiarity >= 0.35 && trust >= 0.25 ? 1 : 0,
    })

    tags.push("tone_observing_profile_interpreted")
    reasons.push(
      "关系事实为 observing；是否靠近不由 Relation 决定，而由 trust/familiarity 与 Profile 边界共同解释。"
    )
  }

  if (relation.tone === "familiar") {
    tuning = addTuning(tuning, {
      carePriorityOffset:
        profile.bias.carePriority >= 55 ? 1 : 0,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 70 ? 0 : 1 + success,
      restSensitivityOffset:
        profile.bias.carePriority >= 60 ? 1 : 0,
    })

    tags.push("tone_familiar_profile_interpreted")
    reasons.push(
      "关系事实为 familiar；Profile 会决定这是转向靠近、照护还是继续维持边界。"
    )
  }

  if (relation.tone === "trusted") {
    tuning = addTuning(tuning, {
      carePriorityOffset: 1 + Math.max(0, trust - 0.65) * 3,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 70
          ? 1
          : 2 + success * 2,
      foodSensitivityOffset:
        profile.bias.carePriority >= 60 ? 1 : 0,
      restSensitivityOffset:
        profile.bias.carePriority >= 60 ? 1 : 0,
    })

    tags.push("tone_trusted_profile_interpreted")
    reasons.push(
      "关系事实为 trusted；只有在成功反馈足够、信任足够、Profile 允许时才提高靠近或照护倾向。"
    )
  }

  if (relation.tone === "guarded") {
    tuning = addTuning(tuning, {
      observationBiasOffset:
        profile.bias.boundarySensitivity >= 50 ? 2 : 1,
      approachSensitivityOffset:
        profile.bias.boundarySensitivity >= 60 ? -3 : -1,
    })

    tags.push("tone_guarded_profile_interpreted")
    reasons.push(
      "关系事实为 guarded；是否后退由 Profile 的 boundaryStyle / boundarySensitivity 解释，而不是 rejectedOffers 直接控制。"
    )
  }

  return {
    tuning,
    reasons,
    tags,
  }
}

function interpretFeedbackByProfile(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}) {
  const { relation, profile } = input
  const latest = relation.latestOpportunityFeedback
  const care = getBiasLevel(profile.bias.carePriority)
  const construction = getBiasLevel(profile.bias.constructionDrive)
  const patience = getBiasLevel(profile.bias.observationPatience)
  const boundary = getBiasLevel(profile.bias.boundarySensitivity)
  const initiative = getBiasLevel(profile.bias.opportunityInitiative)
  const rejection = getRejectionLevel(relation)
  const success = getSuccessLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }
  const reasons: string[] = []
  const tags: string[] = []

  if (!latest) {
    tags.push("no_latest_feedback")
    reasons.push("当前没有 latestOpportunityFeedback，Profile 只解释长期关系事实。")
    return {
      tuning,
      reasons,
      tags,
    }
  }

  tags.push(`latest_feedback_${latest.type}`)
  tags.push(latest.accepted ? "latest_feedback_accepted" : "latest_feedback_rejected")

  if (latest.accepted) {
    reasons.push(
      `最近机会 ${latest.type} 被宠物自主接受；这是事实，不直接控制行为，由 Profile 解释。`
    )

    if (profile.careStyle === "active_supporter") {
      tuning = addTuning(tuning, {
        carePriorityOffset: 1 + care,
        foodSensitivityOffset:
          latest.type === "food_offer" ? 1 : 0,
        restSensitivityOffset:
          latest.type === "rest_offer" ? 1 : 0,
      })

      tags.push("active_support_acceptance")
      reasons.push("active_supporter 会把接受反馈解释为照护方式有效，轻微增强照护机会。")
    }

    if (profile.careStyle === "quiet_maintainer") {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1,
        restSensitivityOffset:
          latest.type === "rest_offer" ? 1 : 0,
      })

      tags.push("quiet_maintenance_acceptance")
      reasons.push("quiet_maintainer 会把接受反馈解释为安静维护有效，而不是突然激进靠近。")
    }

    if (profile.careStyle === "gentle_observer") {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1,
        restSensitivityOffset:
          latest.type === "rest_offer" ? 1 : 0,
      })

      tags.push("gentle_observer_acceptance")
      reasons.push("gentle_observer 会保留观察倾向，只轻微增强被接受过的温和机会。")
    }

    if (profile.opportunityStyle === "offer_actively") {
      tuning = addTuning(tuning, {
        carePriorityOffset: initiative >= 0.55 ? 1 : 0,
        approachSensitivityOffset:
          latest.type === "approach_offer" && boundary < 0.7 ? 1 : 0,
      })

      tags.push("active_opportunity_after_acceptance")
      reasons.push("offer_actively 会更愿意继续提供机会，但仍受 boundarySensitivity 约束。")
    }

    if (profile.opportunityStyle === "offer_when_needed") {
      tuning = addTuning(tuning, {
        foodSensitivityOffset:
          latest.type === "food_offer" ? 1 : 0,
        restSensitivityOffset:
          latest.type === "rest_offer" ? 1 : 0,
      })

      tags.push("need_based_acceptance")
      reasons.push("offer_when_needed 只增强被证明有效的需求型机会。")
    }

    if (profile.opportunityStyle === "offer_after_observation") {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1,
        approachSensitivityOffset:
          success >= 0.4 && relation.trustEstimate >= 30 ? 1 : 0,
      })

      tags.push("observe_after_acceptance")
      reasons.push("offer_after_observation 即使收到接受反馈，也会继续通过观察确认下一步。")
    }
  }

  if (!latest.accepted) {
    reasons.push(
      `最近机会 ${latest.type} 未被宠物接受；这是事实，不直接代表管家必须保守。`
    )

    if (profile.careStyle === "active_supporter") {
      tuning = addTuning(tuning, {
        carePriorityOffset: care >= 0.7 ? 1 : 0,
        foodSensitivityOffset: care >= 0.65 ? 1 : 0,
        restSensitivityOffset: care >= 0.65 ? 1 : 0,
        approachSensitivityOffset:
          latest.type === "approach_offer" && boundary >= 0.55 ? -1 : 0,
      })

      tags.push("active_support_reinterprets_rejection")
      reasons.push(
        "active_supporter 会把拒绝解释为当前方式不合适，而不是停止照护；它会转向更温和的需求型支持。"
      )
    }

    if (profile.careStyle === "quiet_maintainer") {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1,
        observationBiasOffset: patience >= 0.55 ? 1 : 0,
      })

      tags.push("quiet_maintenance_rejection")
      reasons.push("quiet_maintainer 会把拒绝解释为暂时少打扰，并转向环境维护。")
    }

    if (profile.careStyle === "protective_guardian") {
      tuning = addTuning(tuning, {
        carePriorityOffset: 1,
        observationBiasOffset: 1 + boundary,
        approachSensitivityOffset:
          latest.type === "approach_offer" ? -1 - boundary : 0,
      })

      tags.push("protective_boundary_rejection")
      reasons.push("protective_guardian 会更重视边界与安全，尤其减少被拒绝的靠近方式。")
    }

    if (profile.careStyle === "structured_manager") {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1,
        observationBiasOffset: 1,
      })

      tags.push("structured_replanning_rejection")
      reasons.push("structured_manager 会把拒绝解释为需要重新安排管理节奏。")
    }

    if (profile.boundaryStyle === "watchful_boundary") {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1 + boundary,
        approachSensitivityOffset:
          latest.type === "approach_offer" ? -2 - rejection : -1,
      })

      tags.push("watchful_boundary_rejection")
      reasons.push("watchful_boundary 会更明显尊重拒绝反馈，并提高观察。")
    }

    if (profile.boundaryStyle === "balanced_boundary") {
      tuning = addTuning(tuning, {
        observationBiasOffset:
          relation.rejectedOffers > relation.successfulOffers ? 1 : 0,
        approachSensitivityOffset:
          latest.type === "approach_offer" ? -1 : 0,
      })

      tags.push("balanced_boundary_rejection")
      reasons.push("balanced_boundary 只做中等修正，不会因为一次拒绝彻底改变管家。")
    }

    if (profile.boundaryStyle === "soft_boundary") {
      tuning = addTuning(tuning, {
        approachSensitivityOffset:
          latest.type === "approach_offer" && boundary >= 0.75 ? -1 : 0,
      })

      tags.push("soft_boundary_rejection")
      reasons.push("soft_boundary 对拒绝反馈的反应较轻，除非边界敏感度很高。")
    }

    if (profile.opportunityStyle === "offer_after_observation") {
      tuning = addTuning(tuning, {
        observationBiasOffset: 2,
      })

      tags.push("observe_after_rejection")
      reasons.push("offer_after_observation 会把未接受反馈解释为需要更多观察。")
    }

    if (profile.opportunityStyle === "offer_when_needed") {
      tuning = addTuning(tuning, {
        observationBiasOffset: 1,
        foodSensitivityOffset:
          latest.type !== "food_offer" && care >= 0.7 ? 1 : 0,
        restSensitivityOffset:
          latest.type !== "rest_offer" && care >= 0.7 ? 1 : 0,
      })

      tags.push("need_based_rejection")
      reasons.push("offer_when_needed 会避免重复同一种不合适机会，转向明确需求。")
    }

    if (profile.buildStyle === "adaptive_builder") {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1 + construction,
      })

      tags.push("adaptive_environment_after_rejection")
      reasons.push("adaptive_builder 会把未接受反馈解释为环境还需要调整。")
    }

    if (profile.buildStyle === "protective_builder") {
      tuning = addTuning(tuning, {
        constructionDriveOffset: 1,
        observationBiasOffset: 1,
      })

      tags.push("protective_environment_after_rejection")
      reasons.push("protective_builder 会通过空间维护回应边界反馈。")
    }
  }

  return {
    tuning,
    reasons,
    tags,
  }
}

function interpretLongTermBiasByProfile(input: {
  relation: ButlerRelationState
  profile: ButlerProfile
}) {
  const { relation, profile } = input
  const care = getBiasLevel(profile.bias.carePriority)
  const construction = getBiasLevel(profile.bias.constructionDrive)
  const patience = getBiasLevel(profile.bias.observationPatience)
  const boundary = getBiasLevel(profile.bias.boundarySensitivity)
  const initiative = getBiasLevel(profile.bias.opportunityInitiative)
  const trust = getTrustLevel(relation)
  const familiarity = getFamiliarityLevel(relation)

  let tuning = {
    ...DEFAULT_TUNING,
  }
  const reasons: string[] = []
  const tags: string[] = []

  tuning = addTuning(tuning, {
    carePriorityOffset: Math.max(0, care - 0.55) * 2,
    constructionDriveOffset: Math.max(0, construction - 0.6) * 2,
    observationBiasOffset: Math.max(0, patience - 0.5) * 2,
  })

  if (trust >= 0.35 && familiarity >= 0.35) {
    tuning = addTuning(tuning, {
      approachSensitivityOffset: Math.max(0, initiative - boundary) * 3,
      restSensitivityOffset: Math.max(0, care - 0.55) * 2,
    })

    tags.push("long_term_trust_allows_gentle_adjustment")
  }

  tags.push("profile_bias_interprets_long_term_relation")

  reasons.push(
    "长期关系事实只提供上下文，最终由 carePriority / constructionDrive / observationPatience / boundarySensitivity / opportunityInitiative 解释。"
  )

  return {
    tuning,
    reasons,
    tags,
  }
}

function interpretGoalExecutionMemory(input: {
  memory: ButlerMemoryState | null | undefined
  profile: ButlerProfile
}) {
  const { memory, profile } = input

  let tuning = {
    ...DEFAULT_TUNING,
  }
  const reasons: string[] = []
  const tags: string[] = []

  if (!memory || memory.entries.length === 0) {
    tags.push("no_goal_execution_memory")
    reasons.push("当前没有家园目标执行记忆，不从后天经历调整管家倾向。")

    return {
      tuning,
      reasons,
      tags,
    }
  }

  const recentEntries = memory.entries.slice(0, 12)
  const goalExecutionEntries = recentEntries.filter((entry) =>
    entry.tags.includes("goal_driven_execution")
  )

  if (goalExecutionEntries.length === 0) {
    tags.push("no_recent_goal_execution_memory")
    reasons.push("近期没有 goal_driven_execution 记忆，家园目标经历暂不形成偏移。")

    return {
      tuning,
      reasons,
      tags,
    }
  }

  const homeBuildingCount = goalExecutionEntries.filter(
    (entry) =>
      entry.tags.includes("home_building") ||
      entry.tags.includes("home_goal_build_temporary_shelter") ||
      entry.tags.includes("home_goal_complete_basic_living")
  ).length

  const maintenanceCount = goalExecutionEntries.filter(
    (entry) =>
      entry.tags.includes("home_maintenance") ||
      entry.tags.includes("home_goal_maintain_home_facilities")
  ).length

  const initialCareCount = goalExecutionEntries.filter(
    (entry) =>
      entry.tags.includes("home_maintenance") ||
      entry.tags.includes("home_goal_stabilize_initial_care")
  ).length

  const gardenCount = goalExecutionEntries.filter(
    (entry) =>
      entry.tags.includes("space_tidying") ||
      entry.tags.includes("home_goal_open_garden_area") ||
      entry.tags.includes("home_goal_prepare_future_expansion")
  ).length

  if (homeBuildingCount > 0) {
    tuning = addTuning(tuning, {
      constructionDriveOffset:
        profile.buildStyle === "steady_builder" ? 2 : 1,
      observationBiasOffset:
        profile.careStyle === "quiet_maintainer" ? 1 : 0,
    })

    tags.push("goal_memory_home_building")
    reasons.push("近期存在家园建设目标执行记忆，轻微增强建设倾向。")
  }

  if (maintenanceCount > 0) {
    tuning = addTuning(tuning, {
      constructionDriveOffset: 1,
      observationBiasOffset: 1,
    })

    tags.push("goal_memory_home_maintenance")
    reasons.push("近期存在设施维护目标执行记忆，管家会更重视维护与观察。")
  }

  if (initialCareCount > 0) {
    tuning = addTuning(tuning, {
      carePriorityOffset: 1,
      observationBiasOffset: 1,
    })

    tags.push("goal_memory_initial_care")
    reasons.push("近期存在初始照护或家园维护目标执行记忆，管家会保留基础管理优先级。")
  }

  if (gardenCount > 0) {
    tuning = addTuning(tuning, {
      constructionDriveOffset:
        profile.buildStyle === "adaptive_builder" ? 2 : 1,
      observationBiasOffset: 1,
    })

    tags.push("goal_memory_garden_or_expansion")
    reasons.push("近期存在庭院或未来扩展目标执行记忆，轻微增强空间整理倾向。")
  }

  if (goalExecutionEntries.length >= 4) {
    tuning = addTuning(tuning, {
      constructionDriveOffset: 1,
    })

    tags.push("goal_memory_repeated_execution")
    reasons.push("近期连续出现家园目标执行记忆，说明管家正在形成阶段性管理惯性。")
  }

  return {
    tuning,
    reasons,
    tags,
  }
}

function deriveDominantInterpretation(input: {
  profile: ButlerProfile | null | undefined
  tags: string[]
  relation: ButlerRelationState | null | undefined
}): ButlerDominantInterpretation {
  const { profile, tags, relation } = input

  if (!profile) return "none"

  if (
    tags.includes("quiet_maintenance_acceptance") ||
    tags.includes("quiet_maintenance_rejection") ||
    profile.careStyle === "quiet_maintainer"
  ) {
    return "quiet_maintenance"
  }

  if (
    tags.includes("active_support_acceptance") ||
    tags.includes("active_support_reinterprets_rejection") ||
    profile.careStyle === "active_supporter"
  ) {
    return "active_support"
  }

  if (
    tags.includes("protective_boundary_rejection") ||
    tags.includes("watchful_boundary_rejection") ||
    profile.boundaryStyle === "watchful_boundary"
  ) {
    return "boundary_respect"
  }

  if (
    tags.includes("adaptive_environment_after_rejection") ||
    tags.includes("protective_environment_after_rejection") ||
    profile.buildStyle === "adaptive_builder" ||
    profile.buildStyle === "protective_builder"
  ) {
    return "environment_adjustment"
  }

  if (
    profile.opportunityStyle === "offer_when_needed" ||
    tags.includes("need_based_acceptance") ||
    tags.includes("need_based_rejection")
  ) {
    return "need_based_support"
  }

  if (relation?.tone === "trusted") {
     return "gentle_approach"
  }

  if (profile.careStyle === "structured_manager") {
    return "structured_management"
  }

  return "protective_observation"
}

function deriveSuggestedPosture(
  dominant: ButlerDominantInterpretation
): ButlerSuggestedPosture {
  if (dominant === "quiet_maintenance") return "maintain_environment"
  if (dominant === "need_based_support") return "offer_need_based_support"
  if (dominant === "active_support") return "offer_gentle_support"
  if (dominant === "boundary_respect") return "hold_boundary"
  if (dominant === "protective_observation") return "observe_softly"
  if (dominant === "environment_adjustment") return "maintain_environment"
  if (dominant === "gentle_approach") return "approach_gently"
  if (dominant === "structured_management") return "reorganize_tasks"

  return "none"
}

export function buildButlerExperienceInterpretation(
  input: ButlerExperienceInterpreterInput
): ButlerExperienceInterpretation {
  const { relation, profile, memory } = input

  if (!profile) {
    return buildRelationFactOnlyInterpretation(relation)
  }

  if (!relation) {
    return {
      mode: "profile_led",
      profileSource: buildProfileSource(profile),
      dominantInterpretation: "none",
      suggestedPosture: "none",
      interpretationTags: [
        "profile_present",
        "no_relation",
      ],
      tuning: DEFAULT_TUNING,
      reasons: [
        "已存在 ButlerProfile，但暂无 Relation；当前不从关系事实生成调参。",
      ],
      boundary: createBoundary(),
    }
  }

  const tone = interpretToneByProfile({ relation, profile })
  const feedback = interpretFeedbackByProfile({ relation, profile })
  const longTerm = interpretLongTermBiasByProfile({ relation, profile })
  const goalMemory = interpretGoalExecutionMemory({
    memory,
    profile,
  })

  const interpretationTags = uniqueTags([
    "profile_led",
    `care_${profile.careStyle}`,
    `build_${profile.buildStyle}`,
    `boundary_${profile.boundaryStyle}`,
    `opportunity_${profile.opportunityStyle}`,
    ...tone.tags,
    ...feedback.tags,
    ...longTerm.tags,
    ...goalMemory.tags,
  ])

  const dominantInterpretation = deriveDominantInterpretation({
    profile,
    tags: interpretationTags,
    relation,
  })

  const suggestedPosture = deriveSuggestedPosture(dominantInterpretation)

  const tuning = finalizeTuning(
    addTuning(
      addTuning(
        addTuning(tone.tuning, feedback.tuning),
        longTerm.tuning
      ),
      goalMemory.tuning
    )
  )

  return {
    mode: "profile_led",
    profileSource: buildProfileSource(profile),
    dominantInterpretation,
    suggestedPosture,
    interpretationTags,
    tuning,
    reasons: [
      "Relation / OpportunityFeedback / GoalExecutionMemory 只作为事实输入。",
      "ButlerProfile / 八字人格负责解释这些事实。",
      `dominantInterpretation=${dominantInterpretation}。`,
      `suggestedPosture=${suggestedPosture}。`,
      ...tone.reasons,
      ...feedback.reasons,
      ...longTerm.reasons,
      ...goalMemory.reasons,
    ],
    boundary: createBoundary(),
  }
}
