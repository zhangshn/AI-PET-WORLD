/**
 * ======================================================
 * AI-PET-WORLD
 * Autonomy Core Types
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义自主规则层的核心类型
 * 2. 为全世界主体提供统一的“自主行为宪法”结构
 *
 * 说明：
 * - autonomy-core 不是直接执行行为的系统
 * - autonomy-core 是所有行为系统都必须遵守的外部规则层
 * - 后续 butler / pet / npc / future player projection
 *   都应共享这一层
 * ======================================================
 */

export type AutonomousEntityType =
  | "pet"
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
  | "BUTLER_CANNOT_REPLACE_PET_MIND"
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

  /**
   * 主体是否拥有最终行为决定权
   */
  ownsFinalDecision: boolean

  /**
   * 外部输入是否只能以“机会/提议”的形式进入
   */
  acceptsExternalInputAsOfferOnly: boolean

  /**
   * 外部主体是否允许直接改写其内部意图
   */
  allowExternalIntentOverride: boolean

  /**
   * 外部主体是否允许直接结算其行为结果
   */
  allowExternalResultOverride: boolean

  /**
   * 行为是否必须经过完整自主链
   */
  requiresAutonomousBehaviorChain: boolean

  /**
   * 行为结果是否必须写回记忆
   */
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
   * 此类机会是否可以直接结算结果
   * 在自主世界里，默认应该为 false
   */
  canDirectlyResolveOutcome: boolean

  /**
   * 此类机会是否必须交给主体自行判断接受与否
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