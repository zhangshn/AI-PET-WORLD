/**
 * ======================================================
 * AI-PET-WORLD
 * Autonomy Core Gateway
 * ======================================================
 *
 * 当前文件负责：
 * 1. 作为 autonomy-core 统一出口
 * 2. 提供规则读取与校验辅助函数
 * ======================================================
 */

import {
  WORLD_AUTONOMY_RULESET,
} from "./autonomy-rules"

import type {
  AutonomousEntityType,
  BehaviorOpportunityType,
  EntityAutonomyPolicy,
  OpportunityRule,
  WorldAutonomyRuleset,
} from "./autonomy-types"

export function getWorldAutonomyRuleset(): WorldAutonomyRuleset {
  return WORLD_AUTONOMY_RULESET
}

export function getEntityAutonomyPolicy(
  entityType: AutonomousEntityType
): EntityAutonomyPolicy | undefined {
  return WORLD_AUTONOMY_RULESET.entityPolicies.find(
    (policy) => policy.entityType === entityType
  )
}

export function getOpportunityRule(
  opportunityType: BehaviorOpportunityType
): OpportunityRule | undefined {
  return WORLD_AUTONOMY_RULESET.opportunityRules.find(
    (rule) => rule.opportunityType === opportunityType
  )
}

export function entityOwnsFinalDecision(
  entityType: AutonomousEntityType
): boolean {
  return getEntityAutonomyPolicy(entityType)?.ownsFinalDecision ?? false
}

export function opportunityRequiresSelfAcceptance(
  opportunityType: BehaviorOpportunityType
): boolean {
  return getOpportunityRule(opportunityType)?.requiresSelfAcceptance ?? true
}

export function opportunityCanDirectlyResolveOutcome(
  opportunityType: BehaviorOpportunityType
): boolean {
  return getOpportunityRule(opportunityType)?.canDirectlyResolveOutcome ?? false
}

export type {
  AutonomousEntityType,
  AutonomyConstraint,
  AutonomyConstraintCode,
  AutonomyDecisionStage,
  AutonomousBehaviorChainRule,
  BehaviorOpportunityType,
  EntityAutonomyPolicy,
  OpportunityRule,
  WorldAutonomyRuleset,
} from "./autonomy-types"