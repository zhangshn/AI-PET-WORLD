/**
 * 当前文件负责：把未来 AiMessage record input 转换成 P-Phone 只读预览消息。
 *
 * 注意：
 * 这里不写 AiMessage。
 * 这里不接正式 P-Phone thread。
 * 这里只做 read-only integration preview。
 */

import type {
  CreateAiMessageRecordInput,
} from "@/ai/data-core/ai-data-gateway"

import type {
  PPhoneMessageItem,
} from "./pPhoneMessageMappers"

export type BuildPPhoneButlerRecordPreviewMessageInput = {
  recordInput: CreateAiMessageRecordInput | null
  fallbackButlerName: string
}

function formatRecordPreviewTime(): string {
  const now = new Date()

  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`
}

export function buildPPhoneButlerRecordPreviewMessage(
  input: BuildPPhoneButlerRecordPreviewMessageInput
): PPhoneMessageItem | null {
  const { recordInput } = input

  if (!recordInput) return null
  if (recordInput.messageChannel !== "butler") return null
  if (recordInput.userVisibleChannel !== "p_phone_butler") return null
  if (!recordInput.messageText) return null

  return {
    id: `record-preview-${recordInput.messageId}`,
    sender: "butler",
    senderName: input.fallbackButlerName,
    text: recordInput.messageText,
    timeLabel: formatRecordPreviewTime(),
  }
}
