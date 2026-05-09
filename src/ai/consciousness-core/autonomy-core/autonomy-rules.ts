/**
 * ======================================================
 * AI-PET-WORLD
 * Autonomy Core Rules
 * ======================================================
 *
 * 当前文件负责：
 * 1. 定义 AI-PET-WORLD 的自主行为总规则
 * 2. 作为全世界“主体意识宪法”中心
 *
 * 核心原则：
 * - 管家不是宠物的大脑
 * - 宠物不是被脚本驱动的对象
 * - 世界规则是参照物，不是命令器
 * - 外部输入只能形成机会，不能直接形成主体结果
 * - 一切关键行为都必须经过主体自己的意识链
 * ======================================================
 */

import type {
  WorldAutonomyRuleset,
} from "./autonomy-types"

export const WORLD_AUTONOMY_RULESET: WorldAutonomyRuleset = {
  version: "1.0.0",
  title: "AI-PET-WORLD Autonomous Consciousness Ruleset",
  summary:
    "定义多主体自主意识世界的底层规则。所有主体都拥有自我意识，外部主体只能提供机会，不能替代其最终决策。",

  constraints: [
    {
      code: "SELF_FINAL_DECISION",
      title: "主体拥有最终决定权",
      description:
        "任何主体的最终行为只能由该主体自己做出决定，不能被其他主体直接替代。",
      isEnabled: true,
    },
    {
      code: "OUTSIDE_CAN_ONLY_OFFER",
      title: "外部输入只能形成机会",
      description:
        "投喂、靠近、照料、安抚等都只能形成行为机会，不能直接等于行为结果。",
      isEnabled: true,
    },
    {
      code: "BUTLER_CANNOT_REPLACE_PET_MIND",
      title: "管家不能替宠物做决定",
      description:
        "管家是玩家映射体/平行主体，是管理者与关系主体，不是宠物的大脑。",
      isEnabled: true,
    },
    {
      code: "WORLD_IS_REFERENCE_NOT_COMMAND",
      title: "世界规则是参照物不是命令器",
      description:
        "昼夜、环境、节律、事件、资源状态只能影响主体判断，不能直接强制主体行为。",
      isEnabled: true,
    },
    {
      code: "ALL_ACTIONS_REQUIRE_AUTONOMOUS_CHAIN",
      title: "所有行为必须经过自主链",
      description:
        "主体行为必须经过感知、解释、目标、接受/拒绝、执行强度、执行、结束与记忆回写，而不是直接从条件跳到结果。",
      isEnabled: true,
    },
    {
      code: "ACTION_RESULT_MUST_WRITE_TO_MEMORY",
      title: "结果必须写回记忆",
      description:
        "关键行为结果不能只作为日志存在，必须进入主体记忆并影响后续判断。",
      isEnabled: true,
    },
    {
      code: "NO_DIRECT_INTERNAL_STATE_OVERRIDE",
      title: "不能直接改写他者内部结果",
      description:
        "外部主体不能直接替另一个主体写入吃了、睡了、接受了、喜欢了等内部结果。",
      isEnabled: true,
    },
    {
      code: "INTENTION_BELONGS_TO_SELF",
      title: "意图属于主体自身",
      description:
        "主体当前目标、是否接受机会、行为执行强度与结束条件，都归属于主体自身。",
      isEnabled: true,
    },
  ],

  entityPolicies: [
    {
      entityType: "pet",
      ownsFinalDecision: true,
      acceptsExternalInputAsOfferOnly: true,
      allowExternalIntentOverride: false,
      allowExternalResultOverride: false,
      requiresAutonomousBehaviorChain: true,
      requiresMemoryWriteback: true,
    },
    {
      entityType: "butler",
      ownsFinalDecision: true,
      acceptsExternalInputAsOfferOnly: true,
      allowExternalIntentOverride: false,
      allowExternalResultOverride: false,
      requiresAutonomousBehaviorChain: true,
      requiresMemoryWriteback: true,
    },
    {
      entityType: "npc",
      ownsFinalDecision: true,
      acceptsExternalInputAsOfferOnly: true,
      allowExternalIntentOverride: false,
      allowExternalResultOverride: false,
      requiresAutonomousBehaviorChain: true,
      requiresMemoryWriteback: true,
    },
    {
      entityType: "player_projection",
      ownsFinalDecision: true,
      acceptsExternalInputAsOfferOnly: true,
      allowExternalIntentOverride: false,
      allowExternalResultOverride: false,
      requiresAutonomousBehaviorChain: true,
      requiresMemoryWriteback: true,
    },
  ],

  behaviorChainRule: {
    requiredStages: [
      "perceive",
      "interpret",
      "goal_select",
      "accept_or_reject",
      "intensity_select",
      "execute",
      "finish",
      "memory_writeback",
    ],
    allowStageSkip: false,
    description:
      "任何关键行为都必须经过完整自主链，不能由外部系统直接把条件跳结到行为结果。",
  },

  opportunityRules: [
    {
      opportunityType: "food_offer",
      description:
        "外部主体可以提供食物，但主体自己决定是否接受、吃多少、何时停止。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "care_offer",
      description:
        "外部主体可以提供照料机会，但主体自己决定是否接受该照料。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "approach_offer",
      description:
        "外部主体可以发起靠近机会，但关系主体自己决定是否允许被靠近、如何回应。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "rest_offer",
      description:
        "环境和主体可以形成恢复机会，但最终是否休息、休息多久由主体自己决定。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "play_offer",
      description:
        "玩耍或互动只能作为机会存在，不能直接等于主体已经参与。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "world_event",
      description:
        "世界事件只形成参照与刺激，不直接形成主体最终行为。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "environment_shift",
      description:
        "环境变化只改变判断背景与可行性，不直接替主体决定行为。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
    {
      opportunityType: "social_contact",
      description:
        "社会接触属于关系机会，是否接受和如何回应必须由主体决定。",
      canDirectlyResolveOutcome: false,
      requiresSelfAcceptance: true,
    },
  ],
}