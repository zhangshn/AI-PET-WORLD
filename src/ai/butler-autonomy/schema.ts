/**
 * 当前文件职责：定义 AI 管家自主意识核心的公开类型。
 */

import type { ButlerProfile } from "@/ai/personality-core/butler-profile-core/butler-profile-gateway"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { WorldEcologyState } from "@/world/ecology/world-ecology-state"
import type { ConstructionSafeApplyResult } from "@/world/construction/construction-schema"

export type ButlerSoulSource =
  | "ziwei_life_profile"
  | "fallback_life_profile"
  | "butler_profile_adapter"

export type ButlerRhythmBias =
  | "morning"
  | "daytime"
  | "evening"
  | "night"
  | "balanced"

export type ButlerExplanationTone =
  | "calm"
  | "practical"
  | "warm"
  | "reserved"
  | "protective"

export type ButlerConsciousFocus =
  | "observing"
  | "waiting"
  | "building"
  | "maintaining"
  | "recording"
  | "protecting"
  | "recovering"

export type ButlerEmotionalTone =
  | "calm"
  | "focused"
  | "cautious"
  | "uncertain"
  | "protective"
  | "frustrated"

export type ButlerMotivationKind =
  | "safety"
  | "care"
  | "order"
  | "resource_prudence"
  | "ecology_respect"
  | "exploration"
  | "waiting"
  | "explanation"

export type ButlerGoalKind =
  | "observe_world"
  | "wait_and_record"
  | "prepare_resources"
  | "maintain_boundary"
  | "stabilize_shelter"
  | "organize_storage"
  | "prepare_care"
  | "preserve_quiet_space"
  | "explain_to_player"

export type ButlerAutonomousIntentKind = ButlerGoalKind

export type ButlerAutonomyConsumer =
  | "construction_planner"
  | "memory_only"
  | "event_log"
  | "p_phone"

export type ButlerMemoryEventKind =
  | "observation"
  | "intent_selected"
  | "construction_attempt"
  | "safe_apply_accepted"
  | "safe_apply_rejected"
  | "resource_blocked"
  | "waiting_decision"
  | "player_explanation"

export type ButlerMemoryEmotionalMark =
  | "neutral"
  | "satisfied"
  | "concerned"
  | "frustrated"
  | "protective"

export type ButlerAutonomyAuditSeverity = "info" | "warning" | "blocking"

export type ButlerAutonomyAuditWarning = {
  id: string
  severity: ButlerAutonomyAuditSeverity
  message: string
  tags: string[]
}

export type ButlerSoulProfile = {
  soulId: string
  source: ButlerSoulSource
  riskSensitivity: number
  orderPreference: number
  careDrive: number
  explorationDrive: number
  boundaryDrive: number
  resourcePrudence: number
  socialWarmth: number
  patience: number
  rhythmBias: ButlerRhythmBias
  explanationTone: ButlerExplanationTone
  sourceButlerProfile: Pick<
    ButlerProfile,
    "careStyle" | "buildStyle" | "boundaryStyle" | "opportunityStyle" | "bias"
  >
  summary: string
  tags: string[]
}

export type ButlerWorldPerception = {
  worldId: string
  observedAt: number
  resourcePressure: number
  ecologicalStability: number
  spacePressure: number
  constructionDebt: number
  shelterNeed: number
  careNeed: number
  storageNeed: number
  quietSpaceNeed: number
  boundaryMaintenanceNeed: number
  companionReadinessConcern: number
  perceivedFacts: string[]
  risks: string[]
  opportunities: string[]
  tags: string[]
}

export type ButlerConsciousState = {
  stateId: string
  focus: ButlerConsciousFocus
  emotionalTone: ButlerEmotionalTone
  attentionLevel: number
  cautionLevel: number
  confidenceLevel: number
  recoveryPressure: number
  reason: string
  tags: string[]
}

export type ButlerMotivation = {
  motivationId: string
  kind: ButlerMotivationKind
  intensity: number
  sourceSoulFactors: string[]
  sourceWorldFactors: string[]
  sourceMemoryFactors: string[]
  reason: string
  tags: string[]
}

export type ButlerGoal = {
  goalId: string
  kind: ButlerGoalKind
  priority: number
  confidence: number
  constructionAllowed: boolean
  sourceMotivationIds: string[]
  reason: string
  tags: string[]
}

export type ButlerAutonomousIntent = {
  intentId: string
  kind: ButlerAutonomousIntentKind
  priority: number
  confidence: number
  constructionAllowed: boolean
  emotionalTone: ButlerEmotionalTone
  sourceMotivations: string[]
  perceivedWorldFacts: string[]
  memoryReferences: string[]
  reason: string
  nextExpectedConsumer: ButlerAutonomyConsumer
  tags: string[]
}

export type ButlerMemoryEvent = {
  eventId: string
  occurredAt: number
  kind: ButlerMemoryEventKind
  summary: string
  worldFacts: string[]
  emotionalMark: ButlerMemoryEmotionalMark
  learningTags: string[]
}

export type ButlerMemoryLearnedPreferences = {
  shelterBias: number
  careBias: number
  storageBias: number
  boundaryBias: number
  waitingBias: number
  resourceCautionBias: number
}

export type ButlerMemoryState = {
  memoryId: string
  recentEvents: ButlerMemoryEvent[]
  learnedPreferences: ButlerMemoryLearnedPreferences
  unresolvedConcerns: string[]
  tags: string[]
}

export type ButlerMemoryEffect = {
  effectId: string
  targetPreference: keyof ButlerMemoryLearnedPreferences
  delta: number
  reason: string
  tags: string[]
}

export type ButlerAutonomyAudit = {
  stableAutonomyFingerprint: string
  checkedIntentId: string
  warnings: ButlerAutonomyAuditWarning[]
  tags: string[]
}

export type ButlerAutonomyExplanation = {
  id: string
  title: string
  body: string
  tags: string[]
}

export type ButlerAutonomyInput = {
  worldId: string
  ownerId: string
  now: number
  worldDay: number
  homeMapState: HomeMapState
  ecologyState?: WorldEcologyState
  butlerProfile: ButlerProfile
  butlerSoulProfile?: ButlerSoulProfile
  butlerMemoryState?: ButlerMemoryState
  recentSafeApplyResult?: ConstructionSafeApplyResult
  tags: string[]
}

export type ButlerAutonomyResult = {
  soulProfile: ButlerSoulProfile
  perception: ButlerWorldPerception
  consciousState: ButlerConsciousState
  motivations: ButlerMotivation[]
  candidateGoals: ButlerGoal[]
  selectedIntent: ButlerAutonomousIntent
  memoryEffects: ButlerMemoryEffect[]
  audit: ButlerAutonomyAudit
  explanations: ButlerAutonomyExplanation[]
  tags: string[]
}
