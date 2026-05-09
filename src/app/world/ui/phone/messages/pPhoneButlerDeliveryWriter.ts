/**
 * 当前文件负责：提供管家 P-Phone delivery 的受控手动写入函数。
 *
 * 注意：
 * 只有 control.mode === "enabled" 时才会调用 recordAiMessageOnce。
 * 默认业务链路不要调用本文件进行自动写入。
 */

import {
  recordAiMessageOnce,
  type CreateAiMessageRecordInput,
} from "@/ai/data-core/ai-data-gateway"

import type {
  PPhoneButlerDeliveryWriteControl,
  PPhoneButlerDeliveryWriteResult,
} from "./pPhoneButlerDeliveryWriterTypes"

import {
  buildPPhoneButlerDeliveryWritePreview,
} from "./pPhoneButlerDeliveryWriterTypes"

export type WritePPhoneButlerDeliveryMessageInput = {
  recordInput: CreateAiMessageRecordInput | null
  control: PPhoneButlerDeliveryWriteControl
}

export function writePPhoneButlerDeliveryMessageOnce(
  input: WritePPhoneButlerDeliveryMessageInput
): PPhoneButlerDeliveryWriteResult {
  const preview = buildPPhoneButlerDeliveryWritePreview(input)

  if (!input.recordInput) return preview

  if (input.control.mode !== "enabled") {
    return preview
  }

  const record = recordAiMessageOnce(input.recordInput)

  if (!record) {
    return {
      status: "blocked",
      canWrite: true,
      didWrite: false,
      messageId: input.recordInput.messageId,
      recordId: input.recordInput.id ?? null,
      reason: "recordAiMessageOnce 没有返回记录，写入被视为阻塞。",
      tags: [
        "p-phone-delivery-writer",
        "write-blocked",
        ...input.recordInput.tags,
      ],
    }
  }

  const isDuplicate =
    record.id !== input.recordInput.id &&
    record.messageId === input.recordInput.messageId

  if (isDuplicate) {
    return {
      status: "skipped_duplicate",
      canWrite: true,
      didWrite: false,
      messageId: record.messageId,
      recordId: record.id,
      reason: "已存在相同 messageId 的 AiMessage，跳过重复写入。",
      tags: [
        "p-phone-delivery-writer",
        "skipped-duplicate",
        ...record.tags,
      ],
    }
  }

  return {
    status: "written",
    canWrite: true,
    didWrite: true,
    messageId: record.messageId,
    recordId: record.id,
    reason: "已通过显式 enabled 开关写入 AiMessage。",
    tags: [
      "p-phone-delivery-writer",
      "written",
      ...record.tags,
    ],
  }
}
