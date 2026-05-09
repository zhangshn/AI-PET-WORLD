/**
 * 当前文件负责：导出自主意识主体核心的公开入口。
 */

import type {
  AgentCycleTrace,
  AgentExpression,
  AgentExpressionMode,
  AgentInterpretation,
  AgentInterpretationType,
  AgentIntention,
  AgentIntentionSource,
  AgentIntentionType,
  AgentMemoryImpact,
  AgentMemoryImpactType,
  AgentPerception,
  AgentPerceptionFocus,
  AgentSignal,
  AgentSignalCategory,
  AgentSignalPolarity,
  AgentSignalSource,
  AutonomousAgentId,
  AutonomousAgentKind,
} from "./agent-schema"

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

function clampDelta(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(-100, Math.min(100, value))
}

export function buildAgentSignal(input: {
  id: string
  source: AgentSignalSource
  category: AgentSignalCategory
  polarity?: AgentSignalPolarity
  intensity: number
  summary: string
  sourceRef?: AgentSignal["sourceRef"]
  tags?: string[]
}): AgentSignal {
  return {
    id: input.id,
    source: input.source,
    category: input.category,
    polarity: input.polarity ?? "unknown",
    intensity: clampScore(input.intensity),
    summary: input.summary,
    sourceRef: input.sourceRef,
    tags: input.tags ?? [],
  }
}

export function buildAgentPerception(input: {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  signalId: string
  focus: AgentPerceptionFocus
  attention: number
  perceivedMeaning: string
  reasons?: string[]
}): AgentPerception {
  return {
    agentKind: input.agentKind,
    agentId: input.agentId,
    signalId: input.signalId,
    focus: input.focus,
    attention: clampScore(input.attention),
    perceivedMeaning: input.perceivedMeaning,
    reasons: input.reasons ?? [],
  }
}

export function buildAgentInterpretation(input: {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  signalId: string
  type: AgentInterpretationType
  confidence: number
  internalSummary: string
  reasons?: string[]
}): AgentInterpretation {
  return {
    agentKind: input.agentKind,
    agentId: input.agentId,
    signalId: input.signalId,
    type: input.type,
    confidence: clampScore(input.confidence),
    internalSummary: input.internalSummary,
    reasons: input.reasons ?? [],
  }
}

export function buildAgentIntention(input: {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  type: AgentIntentionType
  source: AgentIntentionSource
  strength: number
  summary: string
  reasons?: string[]
}): AgentIntention {
  return {
    agentKind: input.agentKind,
    agentId: input.agentId,
    type: input.type,
    source: input.source,
    strength: clampScore(input.strength),
    summary: input.summary,
    reasons: input.reasons ?? [],
  }
}

export function buildAgentExpression(input: {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  internalIntent: AgentIntentionType | string
  visibleExpression: string
  mode: AgentExpressionMode
  confidence: number
  reason: string
}): AgentExpression {
  return {
    agentKind: input.agentKind,
    agentId: input.agentId,
    internalIntent: input.internalIntent,
    visibleExpression: input.visibleExpression,
    mode: input.mode,
    confidence: clampScore(input.confidence),
    reason: input.reason,
  }
}

export function buildAgentMemoryImpact(input: {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  type: AgentMemoryImpactType
  delta: number
  summary: string
  sourceSignalId?: string
  sourceIntentionType?: AgentIntentionType
}): AgentMemoryImpact {
  return {
    agentKind: input.agentKind,
    agentId: input.agentId,
    type: input.type,
    delta: clampDelta(input.delta),
    summary: input.summary,
    sourceSignalId: input.sourceSignalId,
    sourceIntentionType: input.sourceIntentionType,
  }
}

export function buildAgentCycleTrace(input: {
  agentKind: AutonomousAgentKind
  agentId: AutonomousAgentId
  tick: number
  signal?: AgentSignal
  perception?: AgentPerception
  interpretation?: AgentInterpretation
  intention?: AgentIntention
  expression?: AgentExpression
  memoryImpact?: AgentMemoryImpact
}): AgentCycleTrace {
  return {
    agentKind: input.agentKind,
    agentId: input.agentId,
    tick: input.tick,
    signal: input.signal,
    perception: input.perception,
    interpretation: input.interpretation,
    intention: input.intention,
    expression: input.expression,
    memoryImpact: input.memoryImpact,
    chain: [
      "signal",
      "perception",
      "interpretation",
      "intention",
      "expression",
      "memory",
    ],
  }
}

export type {
  AgentCycleTrace,
  AgentExpression,
  AgentExpressionMode,
  AgentInterpretation,
  AgentInterpretationType,
  AgentIntention,
  AgentIntentionSource,
  AgentIntentionType,
  AgentMemoryImpact,
  AgentMemoryImpactType,
  AgentPerception,
  AgentPerceptionFocus,
  AgentSignal,
  AgentSignalCategory,
  AgentSignalPolarity,
  AgentSignalSource,
  AutonomousAgentId,
  AutonomousAgentKind,
} from "./agent-schema"