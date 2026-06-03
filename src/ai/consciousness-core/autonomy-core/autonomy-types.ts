/**
 * ======================================================
 * AI-PET-WORLD
 * Autonomy Core Types
 * ======================================================
 *
 * 褰撳墠鏂囦欢璐熻矗锛? * 1. 瀹氫箟鑷富瑙勫垯灞傜殑鏍稿績绫诲瀷
 * 2. 涓哄叏涓栫晫涓讳綋鎻愪緵缁熶竴鐨勨€滆嚜涓昏涓哄娉曗€濈粨鏋? *
 * 璇存槑锛? * - autonomy-core 涓嶆槸鐩存帴鎵ц琛屼负鐨勭郴缁? * - autonomy-core 鏄墍鏈夎涓虹郴缁熼兘蹇呴』閬靛畧鐨勫閮ㄨ鍒欏眰
 * - 鍚庣画 butler / npc / future player projection
 *   閮藉簲鍏变韩杩欎竴灞? * ======================================================
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

  /**
   * 涓讳綋鏄惁鎷ユ湁鏈€缁堣涓哄喅瀹氭潈
   */
  ownsFinalDecision: boolean

  /**
   * 澶栭儴杈撳叆鏄惁鍙兘浠モ€滄満浼?鎻愯鈥濈殑褰㈠紡杩涘叆
   */
  acceptsExternalInputAsOfferOnly: boolean

  /**
   * 澶栭儴涓讳綋鏄惁鍏佽鐩存帴鏀瑰啓鍏跺唴閮ㄦ剰鍥?   */
  allowExternalIntentOverride: boolean

  /**
   * 澶栭儴涓讳綋鏄惁鍏佽鐩存帴缁撶畻鍏惰涓虹粨鏋?   */
  allowExternalResultOverride: boolean

  /**
   * 琛屼负鏄惁蹇呴』缁忚繃瀹屾暣鑷富閾?   */
  requiresAutonomousBehaviorChain: boolean

  /**
   * 琛屼负缁撴灉鏄惁蹇呴』鍐欏洖璁板繂
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
   * 姝ょ被鏈轰細鏄惁鍙互鐩存帴缁撶畻缁撴灉
   * 鍦ㄨ嚜涓讳笘鐣岄噷锛岄粯璁ゅ簲璇ヤ负 false
   */
  canDirectlyResolveOutcome: boolean

  /**
   * 姝ょ被鏈轰細鏄惁蹇呴』浜ょ粰涓讳綋鑷鍒ゆ柇鎺ュ彈涓庡惁
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