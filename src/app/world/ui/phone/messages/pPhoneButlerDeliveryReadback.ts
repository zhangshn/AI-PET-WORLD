/**
 * 当前文件负责：读取已经写入 AiMessage 的管家 delivery 消息，用于开发审计验证。
 *
 * 注意：
 * 这里只做 readback。
 * 不写 AiMessage。
 * 不接正式 P-Phone thread。
 */

import type {
  AiMessageRecord,
} from "@/ai/data-core/ai-data-types"

import {
  getAiDataRecords,
  type CreateAiMessageRecordInput,
} from "@/ai/data-core/ai-data-gateway"

import type {
  PPhoneMessageItem,
} from "./pPhoneMessageMappers"

export type PPhoneButlerDeliveryReadbackResult = {
  found: boolean
  messageId: string | null
  recordId: string | null
  messageText: string | null
  senderName: string
  pPhonePreview: PPhoneMessageItem | null
  reason: string
  tags: string[]
}

export type BuildPPhoneButlerDeliveryReadbackInput = {
  recordInput: CreateAiMessageRecordInput | null
  butlerName: string
}

function formatReadbackTime(record: AiMessageRecord): string {
  const occurredAt = new Date(record.occurredAt)

  if (Number.isNaN(occurredAt.getTime())) {
    return "--:--"
  }

  return `${String(occurredAt.getHours()).padStart(2, "0")}:${String(
    occurredAt.getMinutes()
  ).padStart(2, "0")}`
}

function buildPPhonePreviewFromRecord(input: {
  record: AiMessageRecord
  butlerName: string
}): PPhoneMessageItem {
  return {
    id: input.record.messageId,
    sender: "butler",
    senderName: input.butlerName,
    text: input.record.messageText,
    timeLabel: formatReadbackTime(input.record),
  }
}

export function buildPPhoneButlerDeliveryReadback(
  input: BuildPPhoneButlerDeliveryReadbackInput
): PPhoneButlerDeliveryReadbackResult {
  if (!input.recordInput) {
    return {
      found: false,
      messageId: null,
      recordId: null,
      messageText: null,
      senderName: input.butlerName,
      pPhonePreview: null,
      reason: "当前没有 record input，无法读取持久化消息。",
      tags: ["p-phone-delivery-readback", "missing-record-input"],
    }
  }

  const records = getAiDataRecords({
    kind: "message",
    limit: 200,
  }) as AiMessageRecord[]

  const record = records.find(
    (item) => item.messageId === input.recordInput?.messageId
  )

  if (!record) {
    return {
      found: false,
      messageId: input.recordInput.messageId,
      recordId: input.recordInput.id ?? null,
      messageText: input.recordInput.messageText,
      senderName: input.butlerName,
      pPhonePreview: null,
      reason: "尚未在 AiMessage 持久化记录中找到该 messageId。",
      tags: [
        "p-phone-delivery-readback",
        "not-found",
        ...input.recordInput.tags,
      ],
    }
  }

  return {
    found: true,
    messageId: record.messageId,
    recordId: record.id,
    messageText: record.messageText,
    senderName: input.butlerName,
    pPhonePreview: buildPPhonePreviewFromRecord({
      record,
      butlerName: input.butlerName,
    }),
    reason: "已在 AiMessage 持久化记录中找到该管家消息。",
    tags: [
      "p-phone-delivery-readback",
      "found",
      ...record.tags,
    ],
  }
}
