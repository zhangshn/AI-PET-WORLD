/**
 * ======================================================
 * AI-PET-WORLD
 * Autonomy Core Types
 * ======================================================
 *





 */

export type AutonomousEntityType =
  | "butler"
  | "npc"
  | "player_projection"

export type AutonomyDecisionStage =
  | "perceive"
  | "interpret"
  | "goal_select"
  | "accept_or_reject"
  | "intensity_select"
  | "execute"
  | "finish"
  | "memory_writeback"

export type BehaviorOpportunityType =
  | "food_offer"
  | "care_offer"
  | "approach_offer"
  | "rest_offer"
  | "play_offer"
  | "world_event"
  | "environment_shift"
  | "social_contact"

export type AutonomyConstraintCode =
  | "SELF_FINAL_DECISION"
  | "OUTSIDE_CAN_ONLY_OFFER"
  | "BUTLER_CANNOT_REPLACE_OTHER_MIND"
  | "WORLD_IS_REFERENCE_NOT_COMMAND"
  | "ALL_ACTIONS_REQUIRE_AUTONOMOUS_CHAIN"
  | "ACTION_RESULT_MUST_WRITE_TO_MEMORY"
  | "NO_DIRECT_INTERNAL_STATE_OVERRIDE"
  | "INTENTION_BELONGS_TO_SELF"

export type AutonomyConstraint = {
  code: AutonomyConstraintCode
  title: string
  description: string
  isEnabled: boolean
}

export type EntityAutonomyPolicy = {
  entityType: AutonomousEntityType
  ownsFinalDecision: boolean
  acceptsExternalInputAsOfferOnly: boolean
  allowExternalIntentOverride: boolean
  allowExternalResultOverride: boolean
  requiresAutonomousBehaviorChain: boolean
  requiresMemoryWriteback: boolean
}

export type AutonomousBehaviorChainRule = {
  requiredStages: AutonomyDecisionStage[]
  allowStageSkip: boolean
  description: string
}

export type OpportunityRule = {
  opportunityType: BehaviorOpportunityType
  description: string

  /**
   * 此类机会是否可以直接结算结果。
   */
  canDirectlyResolveOutcome: boolean

  /**

   */
  requiresSelfAcceptance: boolean
}

export type WorldAutonomyRuleset = {
  version: string
  title: string
  summary: string

  constraints: AutonomyConstraint[]

  entityPolicies: EntityAutonomyPolicy[]

  behaviorChainRule: AutonomousBehaviorChainRule

  opportunityRules: OpportunityRule[]
}
