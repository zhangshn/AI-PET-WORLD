/**
 * 当前文件职责：定义 AI-PET-WORLD 自有 AI 数据层的基础类型。
 */

export type AiDataRecordKind =
  | "decision"
  | "world_event"
  | "message"
  | "state_snapshot"
  | "user_feedback"

export type AiDataSource =
  | "world_runtime"
  | "pet_system"
  | "butler_system"
  | "event_system"
  | "p_phone"
  | "message_policy"
  | "unknown"

export type AiEntityType =
  | "pet"
  | "butler"
  | "world"
  | "home"
  | "care_station"
  | "user"
  | "system"

export type AiImportance = "debug" | "low" | "medium" | "high" | "critical"

export type AiUserVisibleChannel =
  | "hidden"
  | "developer_panel"
  | "p_phone_butler"
  | "p_phone_world_notice"
  | "world_timeline"
  | "world_screen"

export type AiScalarValue = string | number | boolean | null

export type AiStateValues = Record<string, AiScalarValue>

export type AiStateSnapshot = {
  label: string
  values: AiStateValues
  tags?: string[]
}

export type AiDecisionCandidate = {
  id: string
  label: string
  score?: number
  blocked?: boolean
  reasons: string[]
}

export type AiDecisionReason = {
  mainReason: string
  drive?: string
  personalityBias?: string
  stateGate?: string
  environmentBias?: string
  notes?: string[]
}

export type AiDataBaseRecord = {
  id: string
  kind: AiDataRecordKind
  source: AiDataSource
  occurredAt: string
  entityType: AiEntityType
  entityId: string
  importance: AiImportance
  userVisibleChannel: AiUserVisibleChannel
  summary: string
  tags: string[]
}

export type AiDecisionRecord = AiDataBaseRecord & {
  kind: "decision"
  beforeState: AiStateSnapshot
  afterState?: AiStateSnapshot
  candidates: AiDecisionCandidate[]
  selectedCandidateId: string
  reason: AiDecisionReason
}

export type AiWorldEventRecord = AiDataBaseRecord & {
  kind: "world_event"
  eventType: string
  eventId?: string
  visibility: "debug_log" | "message_candidate" | "world_notice" | "timeline"
  payload: AiStateValues
}

export type AiMessageRecord = AiDataBaseRecord & {
  kind: "message"
  messageId: string
  messageChannel: "butler" | "world_notice" | "system" | "debug"
  messageText: string
  triggerReason: string
  sourceEventId?: string
  wasReadByUser?: boolean
}

export type AiStateSnapshotRecord = AiDataBaseRecord & {
  kind: "state_snapshot"
  snapshot: AiStateSnapshot
}

export type AiUserFeedbackRecord = AiDataBaseRecord & {
  kind: "user_feedback"
  feedbackType: "read_message" | "open_app" | "click_action" | "manual_input"
  targetId: string
  feedbackValue: AiScalarValue
}

export type AiDataRecord =
  | AiDecisionRecord
  | AiWorldEventRecord
  | AiMessageRecord
  | AiStateSnapshotRecord
  | AiUserFeedbackRecord
