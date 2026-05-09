/**
 * 当前文件负责：把管家未来投递队列项转换为 AiMessage record 输入。
 *
 * 注意：
 * 这里只构造 CreateAiMessageRecordInput。
 * 不调用 recordAiMessage。
 * 不调用 recordAiMessageOnce。
 * 不写入 AiMessage。
 * 不接正式 P-Phone thread。
 */

import type {
  CreateAiMessageRecordInput,
} from "@/ai/data-core/ai-data-gateway"

import type {
  PPhoneButlerFutureDeliveryQueueItem,
} from "./pPhoneButlerDeliveryQueue"

export type BuildPPhoneButlerAiMessageRecordInput = {
  queueItem: PPhoneButlerFutureDeliveryQueueItem | null
  butlerName: string
}

function buildAiMessageId(
  queueItem: PPhoneButlerFutureDeliveryQueueItem
): string {
  return [
    "butler-message-delivery",
    queueItem.decisionReason ?? "unknown",
    queueItem.createdAtTick,
    queueItem.checkedAtTick,
  ].join("-")
}

function buildAiRecordId(messageId: string): string {
  return `ai-message-${messageId}`
}

export function buildPPhoneButlerAiMessageRecordInput(
  input: BuildPPhoneButlerAiMessageRecordInput
): CreateAiMessageRecordInput | null {
  const { queueItem } = input

  if (!queueItem) return null
  if (queueItem.status !== "ready_for_future_delivery") return null

  const messageId = buildAiMessageId(queueItem)

  return {
    id: buildAiRecordId(messageId),
    source: "butler_system",
    entityType: "butler",
    entityId: input.butlerName,
    importance: queueItem.priority === "high"
      ? "high"
      : queueItem.priority === "medium"
        ? "medium"
        : "low",
    userVisibleChannel: "p_phone_butler",
    summary: "管家主动消息投递预备记录",
    tags: [
      "p-phone",
      "butler-message",
      "message-delivery",
      "record-preview",
      ...queueItem.tags,
    ],
    messageId,
    messageChannel: "butler",
    messageText: queueItem.message.text,
    triggerReason: queueItem.decisionReason ?? "butler_message_delivery",
    sourceEventId: queueItem.queueId,
    wasReadByUser: false,
  }
}
