/**
 * ======================================================
 * AI-PET-WORLD
 * Consciousness Types
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义紫微意识核结构
 * 2. 定义意识原型 / 世界解释风格 / 目标倾向
 * 3. 给 goalSystem / petSystem 提供长期意识输入
 * ======================================================
 */

export type ConsciousnessArchetype =
  | "seeker"
  | "guardian"
  | "observer"
  | "harmonizer"
  | "challenger"
  | "wanderer"

export type ConsciousnessCoreDrive =
  | "expand"
  | "stabilize"
  | "understand"
  | "connect"
  | "breakthrough"
  | "drift"

export type ThreatInterpretationStyle =
  | "observe_first"
  | "counter_if_needed"
  | "avoid_first"
  | "stabilize_first"
  | "test_boundary"

export type AttachmentApproachStyle =
  | "slow_confirm_then_approach"
  | "warm_and_open"
  | "selective_distance"
  | "control_then_approach"
  | "relationship_as_anchor"

export type RecoveryResistanceStyle =
  | "rest_when_safe"
  | "delay_rest"
  | "resist_rest_until_low"
  | "prefer_soft_recovery"

export type NoveltyResponseStyle =
  | "pulled_by_novelty"
  | "curious_but_cautious"
  | "prefer_stable_known"
  | "scan_then_enter"

export type OrderResponseStyle =
  | "follow_structure"
  | "selective_acceptance"
  | "challenge_structure"
  | "build_own_order"

export type ConsciousnessBias = {
  restResistance: number
  riskTolerance: number
  attachmentBias: number
  observationBias: number
  comfortSeeking: number
  changeSeeking: number
}

export type ZiweiConsciousnessKernel = {
  archetype: ConsciousnessArchetype
  coreDrive: ConsciousnessCoreDrive

  /**
   * 它如何理解世界
   */
  threatInterpretation: ThreatInterpretationStyle
  attachmentApproach: AttachmentApproachStyle
  recoveryResistance: RecoveryResistanceStyle
  noveltyResponse: NoveltyResponseStyle
  orderResponse: OrderResponseStyle

  /**
   * 给行为层使用的长期偏压
   */
  bias: ConsciousnessBias

  /**
   * 对外摘要
   */
  summaries: string[]
}