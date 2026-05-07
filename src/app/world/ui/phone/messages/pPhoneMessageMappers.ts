/**
 * 当前文件负责：把世界事件与状态整理成 P-Phone 短信数据。
 */

import type { WorldEvent } from "@/types/event"
import type { WorldHudBundle } from "../../../utils/worldHudMappers"
import type { PPhoneMessageThreadId } from "../PPhoneTypes"

import {
  buildMessageIntentFromEvent,
  type PPhoneMessageIntent,
} from "./pPhoneMessagePolicy"

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

function toMessageItem(intent: PPhoneMessageIntent): PPhoneMessageItem {
  return {
    id: intent.id,
    sender: intent.channel === "world-notice" ? "world" : "butler",
    senderName: intent.senderName,
    text: intent.text,
    timeLabel: intent.timeLabel,
  }
}

function buildIntentMessages(input: {
  events: WorldEvent[]
  hud: WorldHudBundle
}): {
  butlerMessages: PPhoneMessageItem[]
  worldMessages: PPhoneMessageItem[]
} {
  const butlerMessages: PPhoneMessageItem[] = []
  const worldMessages: PPhoneMessageItem[] = []

  input.events.forEach((event) => {
    const intent = buildMessageIntentFromEvent(event, input.hud.butler.name)

    if (!intent) return

    if (intent.channel === "butler") {
      butlerMessages.push(toMessageItem(intent))
      return
    }

    if (intent.channel === "world-notice") {
      worldMessages.push(toMessageItem(intent))
    }
  })

  return {
    butlerMessages: butlerMessages.slice(0, 6),
    worldMessages: worldMessages.slice(0, 8),
  }
}

function buildFallbackButlerMessages(hud: WorldHudBundle): PPhoneMessageItem[] {
  if (hud.pet.available) {
    return [
      {
        id: "butler-pet-born-status",
        sender: "butler",
        senderName: hud.butler.name,
        text: "宠物目前已经进入自主活动阶段。我会继续观察它的状态，但不会替它做决定。",
        timeLabel: hud.world.timeLabel,
      },
    ]
  }

  return [
    {
      id: "butler-incubator-status",
      sender: "butler",
      senderName: hud.butler.name,
      text: "我会先维持孵化器和周围环境的稳定。有重要变化时，我再发消息给你。",
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

  const { butlerMessages: eventButlerMessages, worldMessages } =
    buildIntentMessages({
      events: input.events,
      hud: input.hud,
    })

  const butlerMessages =
    eventButlerMessages.length > 0
      ? eventButlerMessages
      : buildFallbackButlerMessages(input.hud)

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
      latestText: getLatestText(worldMessages, "暂无世界公告。"),
      messages: worldMessages,
    },
  ]
}

export function getPPhoneTotalUnreadCount(
  threads: PPhoneMessageThread[]
): number {
  return threads.reduce((total, thread) => total + thread.unreadCount, 0)
}