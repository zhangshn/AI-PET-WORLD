/**
 * 当前文件负责：判断世界事件是否可以转成 P-Phone 短信。
 */

import type { WorldEvent } from "@/types/event"

export type PPhoneMessageChannel = "butler" | "world-notice" | "silent"

export type PPhoneMessageIntent = {
  id: string
  channel: PPhoneMessageChannel
  senderName: string
  text: string
  timeLabel: string
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

export function buildMessageIntentFromEvent(
  event: WorldEvent,
  butlerName: string
): PPhoneMessageIntent | null {
  if (isWorldNoticeEvent(event)) {
    return {
      id: `world-${event.id}`,
      channel: "world-notice",
      senderName: "World Notice",
      text: event.message,
      timeLabel: formatEventTime(event),
    }
  }

  if (isButlerMessageEvent(event)) {
    return {
      id: `butler-${event.id}`,
      channel: "butler",
      senderName: butlerName,
      text: "宠物已经顺利出生。我会先保持观察，让它自己适应这个世界。",
      timeLabel: formatEventTime(event),
    }
  }

  return null
}