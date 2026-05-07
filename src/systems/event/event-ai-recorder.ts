/**
 * 当前文件负责：把世界事件记录进 AI Data Core。
 */

import type { WorldEvent, WorldEventType } from "@/types/event"
import type {
  AiImportance,
  AiUserVisibleChannel,
  AiWorldEventRecord,
} from "@/ai/data-core/ai-data-types"

import { recordAiWorldEvent } from "@/ai/data-core/ai-data-gateway"

const DEBUG_EVENT_SAMPLE_INTERVAL = 6

const WORLD_NOTICE_KEYWORDS = [
  "医院",
  "诊所",
  "社区",
  "小镇",
  "广场",
  "公园",
  "商店",
  "市场",
  "学校",
  "建筑完成",
  "建成",
  "开放",
  "区域开放",
  "设施",
  "公共设施",
  "社区活动",
  "节日",
  "生态变化",
  "天气异常",
]

function isWorldNoticeCandidate(event: WorldEvent): boolean {
  return WORLD_NOTICE_KEYWORDS.some((keyword) =>
    event.message.includes(keyword)
  )
}

function resolveEventVisibility(
  event: WorldEvent
): AiWorldEventRecord["visibility"] {
  if (isWorldNoticeCandidate(event)) {
    return "world_notice"
  }

  if (event.type === "pet_hatched") {
    return "message_candidate"
  }

  if (
    event.type === "interaction" ||
    event.type === "pet_action_narrative" ||
    event.type === "pet_action_end" ||
    event.type === "pet_fortune_phase_changed" ||
    event.type === "pet_trajectory_branch_changed"
  ) {
    return "timeline"
  }

  return "debug_log"
}

function resolveEventImportance(event: WorldEvent): AiImportance {
  if (isWorldNoticeCandidate(event)) return "high"
  if (event.type === "pet_hatched") return "medium"
  if (event.type === "interaction") return "medium"

  return "debug"
}

function resolveUserVisibleChannel(event: WorldEvent): AiUserVisibleChannel {
  const visibility = resolveEventVisibility(event)

  if (visibility === "world_notice") return "p_phone_world_notice"
  if (visibility === "message_candidate") return "p_phone_butler"
  if (visibility === "timeline") return "world_timeline"

  return "hidden"
}

function shouldRecordWorldEvent(event: WorldEvent): boolean {
  const visibility = resolveEventVisibility(event)

  if (visibility !== "debug_log") return true

  if (event.type === "time_period_changed") return true

  return event.tick % DEBUG_EVENT_SAMPLE_INTERVAL === 0
}

function buildEventTags(event: WorldEvent): string[] {
  const tags = ["world-event", `event:${event.type}`]

  const visibility = resolveEventVisibility(event)
  tags.push(`visibility:${visibility}`)

  if (event.petName) {
    tags.push("pet-related")
  }

  if (event.sourceAction) {
    tags.push(`action:${event.sourceAction}`)
  }

  if (event.narrativeType) {
    tags.push(`narrative:${event.narrativeType}`)
  }

  if (visibility === "debug_log") {
    tags.push("sampled-debug")
  }

  return tags
}

function buildEventPayload(event: WorldEvent) {
  return {
    tick: event.tick,
    day: event.day,
    hour: event.hour,
    petName: event.petName ?? null,
    sourceAction: event.sourceAction ?? null,
    narrativeType: event.narrativeType ?? null,
    continuityId: event.continuityId ?? null,
    intensity: event.intensity ?? null,
  }
}

export function recordWorldEventForAiData(event: WorldEvent): void {
  if (!shouldRecordWorldEvent(event)) return

  recordAiWorldEvent({
    id: `ai-world-event-${event.id}`,
    source: "event_system",
    entityType: event.petName ? "pet" : "world",
    entityId: event.petName ?? "world",
    importance: resolveEventImportance(event),
    userVisibleChannel: resolveUserVisibleChannel(event),
    summary: event.message,
    tags: buildEventTags(event),
    eventType: event.type as WorldEventType,
    eventId: event.id,
    visibility: resolveEventVisibility(event),
    payload: buildEventPayload(event),
  })
}