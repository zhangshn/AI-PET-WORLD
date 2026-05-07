/**
 * 当前文件负责：把世界事件与状态整理成 P-Phone 短信数据。
 */

import type { WorldEvent } from "@/types/event"
import type { WorldHudBundle } from "../../../utils/worldHudMappers"
import type { PPhoneMessageThreadId } from "../PPhoneTypes"

export type PPhoneMessageSender = "player" | "butler" | "system" | "world"

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

function formatEventTime(event: WorldEvent): string {
  return `${String(event.hour).padStart(2, "0")}:00`
}

function buildWorldNoticeMessages(events: WorldEvent[]): PPhoneMessageItem[] {
  return events.slice(0, 12).map((event) => ({
    id: event.id,
    sender: "world",
    senderName: "World Notice",
    text: event.message,
    timeLabel: formatEventTime(event),
  }))
}

function buildSystemMessages(events: WorldEvent[]): PPhoneMessageItem[] {
  const importantEvents = events.filter((event) => {
    return (
      event.type === "pet_hatched" ||
      event.type === "time_period_changed" ||
      event.type === "incubator_progress_changed"
    )
  })

  return importantEvents.slice(0, 10).map((event) => ({
    id: `system-${event.id}`,
    sender: "system",
    senderName: "P-System",
    text: event.message,
    timeLabel: formatEventTime(event),
  }))
}

function buildButlerMessages(hud: WorldHudBundle): PPhoneMessageItem[] {
  return [
    {
      id: "butler-current-state",
      sender: "butler",
      senderName: hud.butler.name,
      text: `我现在会继续处理「${hud.butler.taskLabel}」。我可以维护环境、观察状态、提供机会，但不会替宠物做决定。`,
      timeLabel: hud.world.timeLabel,
    },
    {
      id: "butler-pet-state",
      sender: "butler",
      senderName: hud.butler.name,
      text: `宠物现在表现为「${hud.pet.actionLabel}」，情绪是「${hud.pet.moodLabel}」。我会保持环境稳定，让它自己选择下一步。`,
      timeLabel: hud.world.timeLabel,
    },
  ]
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
  const systemMessages = buildSystemMessages(input.events)
  const worldMessages = buildWorldNoticeMessages(input.events)

  return [
    {
      id: "butler",
      title: input.hud.butler.name,
      subtitle: "管家短信",
      unreadCount: 0,
      latestText: getLatestText(butlerMessages, "管家暂时没有新短信。"),
      messages: butlerMessages,
    },
    {
      id: "p-system",
      title: "P-System",
      subtitle: "系统短信",
      unreadCount: countUnreadMessages(systemMessages, readMessageIds),
      latestText: getLatestText(systemMessages, "系统暂时没有新短信。"),
      messages: systemMessages,
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