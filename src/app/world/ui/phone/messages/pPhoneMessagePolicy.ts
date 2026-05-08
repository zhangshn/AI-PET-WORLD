/**
 * 当前文件负责：判断世界事件是否可以转成 P-Phone 短信。
 */

import type { WorldEvent } from "@/types/event"

import { recordAiMessageOnce } from "@/ai/data-core/ai-data-gateway"

export type PPhoneMessageChannel = "butler" | "world-notice" | "silent"

export type PPhoneMessageIntent = {
  id: string
  channel: PPhoneMessageChannel
  senderName: string
  text: string
  timeLabel: string
  sourceEventId: string
  triggerReason: string
}

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

function formatEventTime(event: WorldEvent): string {
  return `${String(event.hour).padStart(2, "0")}:00`
}

function readPayloadString(
  event: WorldEvent,
  key: string
): string | null {
  const value = event.payload?.[key]

  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return null
}

function isBackgroundLogEvent(event: WorldEvent): boolean {
  return (
    event.type === "time_period_changed" ||
    event.type === "incubator_progress_changed" ||
    event.type === "pet_action_changed" ||
    event.type === "pet_mood_changed"
  )
}

function isWorldNoticeEvent(event: WorldEvent): boolean {
  if (event.type === "pet_hatched") return false
  if (isBackgroundLogEvent(event)) return false

  return WORLD_NOTICE_KEYWORDS.some((keyword) =>
    event.message.includes(keyword)
  )
}

function isOfflineCatchupEvent(event: WorldEvent): boolean {
  return (
    event.type === "interaction" &&
    event.payload?.source === "offline_catchup"
  )
}

function isDualAgentInteractionEvent(event: WorldEvent): boolean {
  if (event.type !== "interaction") return false

  const source = readPayloadString(event, "source")
  const interactionKind = readPayloadString(event, "interactionKind")

  return (
    source === "dual_agent_interaction" ||
    source === "pet_excursion" ||
    source === "butler_response" ||
    interactionKind === "dual_agent_interaction" ||
    interactionKind === "pet_short_excursion" ||
    interactionKind === "pet_boundary_observation" ||
    interactionKind === "butler_boundary_response" ||
    interactionKind === "butler_protective_response"
  )
}

function isButlerMessageEvent(event: WorldEvent): boolean {
  return (
    event.type === "pet_hatched" ||
    isOfflineCatchupEvent(event) ||
    isDualAgentInteractionEvent(event)
  )
}

function buildWorldNoticeIntent(event: WorldEvent): PPhoneMessageIntent {
  return {
    id: `world-${event.id}`,
    channel: "world-notice",
    senderName: "World Notice",
    text: event.message,
    timeLabel: formatEventTime(event),
    sourceEventId: event.id,
    triggerReason: "world_notice_event",
  }
}

function buildDualAgentButlerText(event: WorldEvent): string {
  const petGoalType = readPayloadString(event, "petGoalType")
  const butlerResponse = readPayloadString(event, "butlerResponse")
  const reason = readPayloadString(event, "reason")

  if (butlerResponse === "protective_response") {
    return `${event.message} 我记录了这次保护性回应：这不是命令宠物，而是基于当时状态做出的照看判断。`
  }

  if (butlerResponse === "boundary_waiting") {
    return `${event.message} 我没有打断它，只是在边界附近等待，确认它仍然能自主判断方向。`
  }

  if (butlerResponse === "companion_response") {
    return `${event.message} 我选择靠近一些，但保留距离，让它知道家园方向仍然安全。`
  }

  if (petGoalType === "expand_territory") {
    return `${event.message} 我把这次记录为短程探索：它不是被安排过去的，而是在按自己的倾向试探更远的边界。`
  }

  if (petGoalType === "observe_boundary") {
    return `${event.message} 我把这次记录为边界观察：它更像是在确认环境，而不是迷路。`
  }

  if (reason) {
    return `${event.message} 记录原因：${reason}`
  }

  return event.message
}

function buildButlerIntent(
  event: WorldEvent,
  butlerName: string
): PPhoneMessageIntent {
  if (isOfflineCatchupEvent(event)) {
    return {
      id: `butler-offline-${event.id}`,
      channel: "butler",
      senderName: butlerName,
      text: event.message,
      timeLabel: formatEventTime(event),
      sourceEventId: event.id,
      triggerReason: "offline_catchup_report",
    }
  }

  if (isDualAgentInteractionEvent(event)) {
    return {
      id: `butler-dual-agent-${event.id}`,
      channel: "butler",
      senderName: butlerName,
      text: buildDualAgentButlerText(event),
      timeLabel: formatEventTime(event),
      sourceEventId: event.id,
      triggerReason: "dual_agent_interaction_report",
    }
  }

  return {
    id: `butler-${event.id}`,
    channel: "butler",
    senderName: butlerName,
    text: "宠物已经顺利出生。我会先保持观察，让它自己适应这个世界。",
    timeLabel: formatEventTime(event),
    sourceEventId: event.id,
    triggerReason: "pet_hatched_event",
  }
}

function recordIntentForAiData(intent: PPhoneMessageIntent): void {
  if (intent.channel === "silent") return

  recordAiMessageOnce({
    source: "message_policy",
    entityType: intent.channel === "world-notice" ? "world" : "butler",
    entityId: intent.senderName,
    importance: intent.channel === "world-notice" ? "high" : "medium",
    userVisibleChannel:
      intent.channel === "world-notice"
        ? "p_phone_world_notice"
        : "p_phone_butler",
    summary:
      intent.channel === "world-notice"
        ? "世界通知生成"
        : "管家短信生成",
    tags: [
      "p-phone",
      "message-policy",
      intent.channel === "world-notice" ? "world-notice" : "butler-message",
      `trigger:${intent.triggerReason}`,
    ],
    messageId: intent.id,
    messageChannel: intent.channel === "world-notice" ? "world_notice" : "butler",
    messageText: intent.text,
    triggerReason: intent.triggerReason,
    sourceEventId: intent.sourceEventId,
    wasReadByUser: false,
  })
}

export function buildMessageIntentFromEvent(
  event: WorldEvent,
  butlerName: string
): PPhoneMessageIntent | null {
  if (isWorldNoticeEvent(event)) {
    const intent = buildWorldNoticeIntent(event)

    recordIntentForAiData(intent)

    return intent
  }

  if (isButlerMessageEvent(event)) {
    const intent = buildButlerIntent(event, butlerName)

    recordIntentForAiData(intent)

    return intent
  }

  return null
}
