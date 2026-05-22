/**
 * 当前文件负责：定义自主意识主体的通用结构。
 */

export type AutonomousAgentKind = "pet" | "butler"

export type AutonomousAgentId = string

export type AgentSignalSource =
  | "world"
  | "body"
  | "memory"
  | "relation"
  | "time"
  | "home"
  | "life_runtime"
  | "cognition"
  | "unknown"

export type AgentSignalCategory =
  | "environment"
  | "physical"
  | "emotional"
  | "relational"
  | "temporal"
  | "spatial"
  | "opportunity"
  | "risk"
  | "resource"
  | "memory_trace"
  | "life_tendency"
  | "unknown"

export type AgentSignalPolarity =
  | "positive"
  | "neutral"
  | "negative"
  | "mixed"
  | "unknown"

export type AgentSignal = {
  id: string
  source: AgentSignalSource
  category: AgentSignalCategory
  polarity: AgentSignalPolarity

  /**
   * 0 - 100。
   * 表示这个信号对主体当前状态的显著程度。
   */
  intensity: number

  /**
   * 客观描述，不写主体解释。
   * 例如：附近有树影移动、水声变强、照护点稳定度下降。
   */
  summary: string

  /**
   * 可选：世界对象、区域、事件、时间等来源标记。
   */
  sourceRef?: {
    kind: string
    id?: string
    name?: string
  }

  tags?: string[]
}

export type AgentPerceptionFocus =
  | "notice"
  | "ignore"
  | "monitor"
  | "approach_consideration"
  | "avoid_consideration"
  | "comfort_check"
  | "resource_check"
  | "relation_check"
  | "unknown"

export type AgentPerception = {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  signalId: string

  /**
   * 主体注意到了什么。
   * 这是主体内部感知，不是世界客观事实本身。
   */
  focus: AgentPerceptionFocus

  /**
   * 0 - 100。
   * 表示主体对该信号投入的注意力。
   */
  attention: number

  /**
   * 主体如何初步理解这个信号。
   */
  perceivedMeaning: string

  /**
   * 感知形成的原因。
   * 例如：当前生命趋向、记忆、身体状态、关系状态。
   */
  reasons: string[]
}

export type AgentInterpretationType =
  | "safe"
  | "interesting"
  | "uncertain"
  | "comforting"
  | "resourceful"
  | "threatening"
  | "demanding"
  | "familiar"
  | "unfamiliar"
  | "irrelevant"
  | "unknown"

export type AgentInterpretation = {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  signalId: string

  type: AgentInterpretationType

  /**
   * 0 - 100。
   * 主体对这个解释的确信度。
   */
  confidence: number

  /**
   * 主体解释后的内部语言。
   * 不是 UI 文案，不要求给用户直接展示。
   */
  internalSummary: string

  reasons: string[]
}

export type AgentIntentionSource =
  | "drive"
  | "goal"
  | "memory"
  | "relationship"
  | "survival"
  | "curiosity"
  | "comfort"
  | "duty"
  | "home"
  | "life_tendency"
  | "unknown"

export type AgentIntentionType =
  | "eat"
  | "rest"
  | "observe"
  | "explore"
  | "approach"
  | "avoid"
  | "protect"
  | "maintain"
  | "build"
  | "offer_opportunity"
  | "watch_over"
  | "wait"
  | "unknown"

export type AgentIntention = {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId

  type: AgentIntentionType
  source: AgentIntentionSource

  /**
   * 0 - 100。
   * 表示这个意图当前强度。
   */
  strength: number

  summary: string
  reasons: string[]
}

export type AgentExpressionMode =
  | "visible_action"
  | "subtle_motion"
  | "attention_shift"
  | "posture_change"
  | "environment_action"
  | "opportunity_action"
  | "verbal_expression"
  | "silent_expression"
  | "none"

export type AgentExpression = {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId

  /**
   * 内部意图。
   * 例如 explore / observe / maintain / offer_opportunity。
   */
  internalIntent: AgentIntentionType | string

  /**
   * 可见表达。
   * 宠物可以是 observing / resting。
   * 管家可以是 observing_home / preparing_food_opportunity。
   */
  visibleExpression: string

  mode: AgentExpressionMode

  /**
   * 0 - 100。
   * 表示这个表达和内部意图的一致程度。
   */
  confidence: number

  reason: string
}

export type AgentMemoryImpactType =
  | "world_impression"
  | "self_impression"
  | "relation_impression"
  | "rhythm_impression"
  | "resource_impression"
  | "safety_impression"
  | "unknown"

export type AgentMemoryImpact = {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId

  type: AgentMemoryImpactType

  /**
   * -100 到 100。
   * 正数表示增强，负数表示削弱。
   */
  delta: number

  summary: string
  sourceSignalId?: string
  sourceIntentionType?: AgentIntentionType
}

export type AgentCycleTrace = {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  tick: number

  signal?: AgentSignal
  perception?: AgentPerception
  interpretation?: AgentInterpretation
  intention?: AgentIntention
  expression?: AgentExpression
  memoryImpact?: AgentMemoryImpact

  chain: [
    "signal",
    "perception",
    "interpretation",
    "intention",
    "expression",
    "memory"
  ]
}