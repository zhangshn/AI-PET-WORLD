/**
 * 当前文件负责：把世界事件与状态整理成 P-Phone 短信数据。
 */

import type { WorldEvent } from "@/types/event"
import type { WorldHudBundle } from "../../../utils/worldHudMappers"
import type { PPhoneMessageThreadId } from "../PPhoneTypes"

export type PPhoneMessageSender = "player" | "butler" | "world"

export type PPhoneMessageItem = {
  id: string
  sender: PPhoneMessageSender
  senderName: string
  text: string
  timeLabel: string
}

export type PPhoneMessageThread = {
  id: PPhoneMessageThreadId
  title: string
  subtitle: string
  unreadCount: number
  latestText: string
  messages: PPhoneMessageItem[]
}

const WORLD_NOTICE_EVENT_TYPES = new Set<WorldEvent["type"]>([
  "pet_hatched",
])

function formatEventTime(event: WorldEvent): string {
  return `${String(event.hour).padStart(2, "0")}:00`
}

function shouldShowWorldNotice(event: WorldEvent): boolean {
  if (WORLD_NOTICE_EVENT_TYPES.has(event.type)) return true

  return (
    event.message.includes("医院") ||
    event.message.includes("社区") ||
    event.message.includes("公园") ||
    event.message.includes("家园完成") ||
    event.message.includes("建筑完成") ||
    event.message.includes("区域开放") ||
    event.message.includes("生态变化")
  )
}

function buildWorldNoticeMessages(events: WorldEvent[]): PPhoneMessageItem[] {
  return events
    .filter(shouldShowWorldNotice)
    .slice(0, 8)
    .map((event) => ({
      id: `world-${event.id}`,
      sender: "world",
      senderName: "World Notice",
      text: event.message,
      timeLabel: formatEventTime(event),
    }))
}

function buildButlerMessages(hud: WorldHudBundle): PPhoneMessageItem[] {
  const messages: PPhoneMessageItem[] = []

  if (hud.home.available && hud.home.statusLabel.includes("已完成")) {
    messages.push({
      id: "butler-home-ready",
      sender: "butler",
      senderName: hud.butler.name,
      text: "家园已经整理完成。我会继续维护环境，观察宠物的状态变化。",
      timeLabel: hud.world.timeLabel,
    })
  }

  if (hud.pet.available) {
    messages.push({
      id: `butler-pet-${hud.pet.actionLabel}-${hud.pet.moodLabel}`,
      sender: "butler",
      senderName: hud.butler.name,
      text: `宠物现在处于「${hud.pet.actionLabel}」状态，情绪表现为「${hud.pet.moodLabel}」。我会保持观察，不会替它做决定。`,
      timeLabel: hud.world.timeLabel,
    })
  }

  if (messages.length === 0) {
    messages.push({
      id: "butler-initial-status",
      sender: "butler",
      senderName: hud.butler.name,
      text: "我会先维持孵化器和周围环境的稳定。有重要变化时，我再发消息给你。",
      timeLabel: hud.world.timeLabel,
    })
  }

  return messages.slice(0, 4)
}

function getLatestText(messages: PPhoneMessageItem[], fallback: string): string {
  return messages[0]?.text ?? fallback
}

function countUnreadMessages(
  messages: PPhoneMessageItem[],
  readMessageIds: ReadonlySet<string>
): number {
  return messages.filter((message) => !readMessageIds.has(message.id)).length
}

export function buildPPhoneMessageThreads(input: {
  events: WorldEvent[]
  hud: WorldHudBundle
  readMessageIds?: ReadonlySet<string>
}): PPhoneMessageThread[] {
  const readMessageIds = input.readMessageIds ?? new Set<string>()

  const butlerMessages = buildButlerMessages(input.hud)
  const worldMessages = buildWorldNoticeMessages(input.events)

  return [
    {
      id: "butler",
      title: input.hud.butler.name,
      subtitle: "管家短信",
      unreadCount: countUnreadMessages(butlerMessages, readMessageIds),
      latestText: getLatestText(butlerMessages, "管家暂时没有新短信。"),
      messages: butlerMessages,
    },
    {
      id: "world-notice",
      title: "World Notice",
      subtitle: "世界通知",
      unreadCount: countUnreadMessages(worldMessages, readMessageIds),
      latestText: getLatestText(worldMessages, "世界暂时没有新通知。"),
      messages: worldMessages,
    },
  ]
}

export function getPPhoneTotalUnreadCount(
  threads: PPhoneMessageThread[]
): number {
  return threads.reduce((total, thread) => total + thread.unreadCount, 0)
}