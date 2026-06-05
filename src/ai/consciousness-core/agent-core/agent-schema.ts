export type AutonomousAgentKind = "butler" | "npc" | "player_projection"

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


  intensity: number


  summary: string


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


  focus: AgentPerceptionFocus


  attention: number


  perceivedMeaning: string


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


  confidence: number


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


  internalIntent: AgentIntentionType | string


  visibleExpression: string

  mode: AgentExpressionMode


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