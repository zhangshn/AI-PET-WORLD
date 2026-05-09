/**
 * 当前文件负责：把世界事件、AI 消息记录与状态整理成 P-Phone 短信数据。
 */

import type { WorldEvent } from "@/types/event"
import type { WorldHudBundle } from "../../../utils/worldHudMappers"
import type { PPhoneMessageThreadId } from "../PPhoneTypes"
import type { AiMessageRecord } from "@/ai/data-core/ai-data-types"

import {
  getAiDataRecords,
} from "@/ai/data-core/ai-data-gateway"

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

function formatAiMessageTime(record: AiMessageRecord): string {
  const occurredAt = new Date(record.occurredAt)

  if (Number.isNaN(occurredAt.getTime())) {
    return "--:--"
  }

  return `${String(occurredAt.getHours()).padStart(2, "0")}:${String(
    occurredAt.getMinutes()
  ).padStart(2, "0")}`
}

function toMessageItemFromAiRecord(
  record: AiMessageRecord,
  fallbackButlerName: string
): PPhoneMessageItem {
  const isWorldMessage = record.messageChannel === "world_notice"

  return {
    id: record.messageId,
    sender: isWorldMessage ? "world" : "butler",
    senderName: isWorldMessage ? "World Notice" : fallbackButlerName,
    text: record.messageText,
    timeLabel: formatAiMessageTime(record),
  }
}

function isDeliveryGeneratedButlerRecord(record: AiMessageRecord): boolean {
  return (
    record.messageChannel === "butler" &&
    record.tags.some((tag) =>
      [
        "message-delivery",
        "future-delivery-ready",
        "butler-message",
      ].includes(tag)
    ) &&
    !record.tags.includes("message-policy")
  )
}

function getMessageRecordPriority(record: AiMessageRecord): number {
  if (isDeliveryGeneratedButlerRecord(record)) {
    return 0
  }

  if (
    record.messageChannel === "butler" &&
    !record.tags.includes("message-policy")
  ) {
    return 1
  }

  if (record.messageChannel === "butler") {
    return 2
  }

  if (record.messageChannel === "world_notice") {
    return 0
  }

  return 9
}

function sortAiMessageRecords(records: AiMessageRecord[]): AiMessageRecord[] {
  return [...records].sort((a, b) => {
    const priorityDiff =
      getMessageRecordPriority(a) - getMessageRecordPriority(b)

    if (priorityDiff !== 0) return priorityDiff

    const bTime = new Date(b.occurredAt).getTime()
    const aTime = new Date(a.occurredAt).getTime()

    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0
    }

    return bTime - aTime
  })
}

function readPersistedMessageItems(input: {
  butlerName: string
}): {
  butlerMessages: PPhoneMessageItem[]
  worldMessages: PPhoneMessageItem[]
} {
  const records = getAiDataRecords({
    kind: "message",
    limit: 200,
  }) as AiMessageRecord[]

  const butlerMessages: PPhoneMessageItem[] = []
  const worldMessages: PPhoneMessageItem[] = []

  sortAiMessageRecords(records).forEach((record) => {
    const message = toMessageItemFromAiRecord(record, input.butlerName)

    if (record.messageChannel === "butler") {
      butlerMessages.push(message)
      return
    }

    if (record.messageChannel === "world_notice") {
      worldMessages.push(message)
    }
  })

  return {
    butlerMessages,
    worldMessages,
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
    butlerMessages,
    worldMessages,
  }
}

function buildMessageContentKey(message: PPhoneMessageItem): string {
  return [
    message.sender,
    message.senderName,
    message.text.replace(/\s+/g, " ").trim(),
  ].join("::")
}

function dedupeMessages(messages: PPhoneMessageItem[]): PPhoneMessageItem[] {
  const seenIds = new Set<string>()
  const seenContentKeys = new Set<string>()

  return messages.filter((message) => {
    if (seenIds.has(message.id)) return false

    const contentKey = buildMessageContentKey(message)

    if (seenContentKeys.has(contentKey)) return false

    seenIds.add(message.id)
    seenContentKeys.add(contentKey)
    return true
  })
}

function limitVisibleMessages(messages: PPhoneMessageItem[], limit: number) {
  return dedupeMessages(messages).slice(0, limit)
}

function buildButlerStatusMessageText(hud: WorldHudBundle): string {
  if (hud.pet.available) {
    return `${hud.pet.name} 正在自主活动。我会继续观察它的状态，也会把重要变化通过短信告诉你。`
  }

  return "孵化器目前保持稳定。我会继续照看周围环境，等有重要变化时再通知你。"
}

function buildButlerStatusMessage(input: {
  hud: WorldHudBundle
}): PPhoneMessageItem {
  const dayLabel = input.hud.world.dayLabel
  const messageId = `butler-status-${dayLabel}`
  const text = buildButlerStatusMessageText(input.hud)

  return {
    id: messageId,
    sender: "butler",
    senderName: input.hud.butler.name,
    text,
    timeLabel: input.hud.world.timeLabel,
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

/**
 * 正式 P-Phone message thread 构建规则：
 * 1. 已持久化 AiMessage 优先。
 * 2. 新 delivery 链路生成的 butler message 优先于旧 message-policy。
 * 3. 旧 WorldEvent → butler message 仅作为兼容 fallback。
 * 4. World Notice 暂时保留事件来源。
 * 5. fallback 状态短信不再写入 AiMessage。
 */
export function buildPPhoneMessageThreads(input: {
  events: WorldEvent[]
  hud: WorldHudBundle
  readMessageIds?: ReadonlySet<string>
}): PPhoneMessageThread[] {
  const readMessageIds = input.readMessageIds ?? new Set<string>()

  const {
    butlerMessages: eventButlerMessages,
    worldMessages: eventWorldMessages,
  } = buildIntentMessages({
    events: input.events,
    hud: input.hud,
  })

  const {
    butlerMessages: persistedButlerMessages,
    worldMessages: persistedWorldMessages,
  } = readPersistedMessageItems({
    butlerName: input.hud.butler.name,
  })

  // 新 delivery 链路写入的是 persistedButlerMessages。
  // 旧 WorldEvent → butler message 仅作为兼容 fallback，不能排在持久化消息前面。
  const butlerMessages = limitVisibleMessages(
    [...persistedButlerMessages, ...eventButlerMessages],
    30
  )

  const worldMessages = limitVisibleMessages(
    [...persistedWorldMessages, ...eventWorldMessages],
    30
  )

  const visibleButlerMessages =
    butlerMessages.length > 0
      ? butlerMessages
      : [buildButlerStatusMessage({ hud: input.hud })]

  const visibleWorldMessages =
    worldMessages.length > 0 ? worldMessages : [buildWorldNoticePlaceholderMessage()]

  return [
    {
      id: "butler",
      title: input.hud.butler.name,
      subtitle: "管家短信",
      unreadCount: countUnreadMessages(visibleButlerMessages, readMessageIds),
      latestText: getLatestText(visibleButlerMessages, "管家暂时没有新短信。"),
      messages: visibleButlerMessages,
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
  return threads.reduce((total, thread) => thread.unreadCount + total, 0)
}
