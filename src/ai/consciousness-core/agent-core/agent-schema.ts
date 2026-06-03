/**
 * 褰撳墠鏂囦欢璐熻矗锛氬畾涔夎嚜涓绘剰璇嗕富浣撶殑閫氱敤缁撴瀯銆? */

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

  /**
   * 0 - 100銆?   * 琛ㄧず杩欎釜淇″彿瀵逛富浣撳綋鍓嶇姸鎬佺殑鏄捐憲绋嬪害銆?   */
  intensity: number

  /**
   * 瀹㈣鎻忚堪锛屼笉鍐欎富浣撹В閲娿€?   * 渚嬪锛氶檮杩戞湁鏍戝奖绉诲姩銆佹按澹板彉寮恒€佺収鎶ょ偣绋冲畾搴︿笅闄嶃€?   */
  summary: string

  /**
   * 鍙€夛細涓栫晫瀵硅薄銆佸尯鍩熴€佷簨浠躲€佹椂闂寸瓑鏉ユ簮鏍囪銆?   */
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
   * 涓讳綋娉ㄦ剰鍒颁簡浠€涔堛€?   * 杩欐槸涓讳綋鍐呴儴鎰熺煡锛屼笉鏄笘鐣屽瑙備簨瀹炴湰韬€?   */
  focus: AgentPerceptionFocus

  /**
   * 0 - 100銆?   * 琛ㄧず涓讳綋瀵硅淇″彿鎶曞叆鐨勬敞鎰忓姏銆?   */
  attention: number

  /**
   * 涓讳綋濡備綍鍒濇鐞嗚В杩欎釜淇″彿銆?   */
  perceivedMeaning: string

  /**
   * 鎰熺煡褰㈡垚鐨勫師鍥犮€?   * 渚嬪锛氬綋鍓嶇敓鍛借秼鍚戙€佽蹇嗐€佽韩浣撶姸鎬併€佸叧绯荤姸鎬併€?   */
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
   * 0 - 100銆?   * 涓讳綋瀵硅繖涓В閲婄殑纭俊搴︺€?   */
  confidence: number

  /**
   * 涓讳綋瑙ｉ噴鍚庣殑鍐呴儴璇█銆?   * 涓嶆槸 UI 鏂囨锛屼笉瑕佹眰缁欑敤鎴风洿鎺ュ睍绀恒€?   */
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
   * 0 - 100銆?   * 琛ㄧず杩欎釜鎰忓浘褰撳墠寮哄害銆?   */
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
   * 鍐呴儴鎰忓浘銆?   * 渚嬪 explore / observe / maintain / offer_opportunity銆?   */
  internalIntent: AgentIntentionType | string

  /**
   * 鍙琛ㄨ揪銆?   * 瀹犵墿鍙互鏄?observing / resting銆?   * 绠″鍙互鏄?observing_home / preparing_food_opportunity銆?   */
  visibleExpression: string

  mode: AgentExpressionMode

  /**
   * 0 - 100銆?   * 琛ㄧず杩欎釜琛ㄨ揪鍜屽唴閮ㄦ剰鍥剧殑涓€鑷寸▼搴︺€?   */
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
   * -100 鍒?100銆?   * 姝ｆ暟琛ㄧず澧炲己锛岃礋鏁拌〃绀哄墛寮便€?   */
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