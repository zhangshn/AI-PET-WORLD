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

function isButlerMessageEvent(event: WorldEvent): boolean {
  return event.type === "pet_hatched"
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

function buildButlerIntent(
  event: WorldEvent,
  butlerName: string
): PPhoneMessageIntent {
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