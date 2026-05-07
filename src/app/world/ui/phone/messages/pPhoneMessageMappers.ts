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
  isPlaceholder?: boolean
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
    butlerMessages: dedupeMessagesById(butlerMessages).slice(0, 6),
    worldMessages: dedupeMessagesById(worldMessages).slice(0, 8),
  }
}

function dedupeMessagesById(messages: PPhoneMessageItem[]): PPhoneMessageItem[] {
  const seenIds = new Set<string>()

  return messages.filter((message) => {
    if (seenIds.has(message.id)) return false

    seenIds.add(message.id)
    return true
  })
}

function buildButlerPlaceholderMessage(hud: WorldHudBundle): PPhoneMessageItem {
  if (hud.pet.available) {
    return {
      id: "placeholder-butler-pet-autonomy",
      sender: "butler",
      senderName: hud.butler.name,
      text: "目前没有新的重要消息。宠物正在自主活动，我会继续观察它的状态。",
      timeLabel: hud.world.timeLabel,
      isPlaceholder: true,
    }
  }

  return {
    id: "placeholder-butler-incubator-stable",
    sender: "butler",
    senderName: hud.butler.name,
    text: "目前没有新的重要消息。我会继续维持孵化器和周围环境的稳定。",
    timeLabel: hud.world.timeLabel,
    isPlaceholder: true,
  }
}

function buildWorldNoticePlaceholderMessage(): PPhoneMessageItem {
  return {
    id: "placeholder-world-notice-empty",
    sender: "world",
    senderName: "World Notice",
    text: "暂无世界公告。社区、小镇、医院、公园或公共设施有重要变化时，会在这里通知你。",
    timeLabel: "--:--",
    isPlaceholder: true,
  }
}

function getLatestText(messages: PPhoneMessageItem[], fallback: string): string {
  return messages[0]?.text ?? fallback
}

function countUnreadMessages(
  messages: PPhoneMessageItem[],
  readMessageIds: ReadonlySet<string>
): number {
  return messages.filter((message) => {
    if (message.isPlaceholder) return false

    return !readMessageIds.has(message.id)
  }).length
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
      : [buildButlerPlaceholderMessage(input.hud)]

  const visibleWorldMessages =
    worldMessages.length > 0 ? worldMessages : [buildWorldNoticePlaceholderMessage()]

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
      unreadCount: countUnreadMessages(visibleWorldMessages, readMessageIds),
      latestText: getLatestText(visibleWorldMessages, "暂无世界公告。"),
      messages: visibleWorldMessages,
    },
  ]
}

export function getPPhoneTotalUnreadCount(
  threads: PPhoneMessageThread[]
): number {
  return threads.reduce((total, thread) => total + thread.unreadCount, 0)
}