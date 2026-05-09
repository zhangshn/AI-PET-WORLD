/**
 * 当前文件负责：把管家 message delivery boundary 转换为 P-Phone 消息预览结构。
 *
 * 注意：
 * 这里只做 mapper。
 * 不写 AiMessage。
 * 不接正式 P-Phone thread。
 * 不把 WorldEvent 转短信。
 */

import type {
  ButlerMessageDeliveryDecision,
} from "@/systems/butler/butler-gateway"

import type {
  PPhoneMessageItem,
} from "./pPhoneMessageMappers"

export type BuildPPhoneButlerDeliveryPreviewInput = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

function buildDeliveryPreviewId(
  delivery: ButlerMessageDeliveryDecision
): string {
  return [
    "butler-delivery-preview",
    delivery.decisionReason ?? "unknown",
    delivery.createdAtTick,
    delivery.checkedAtTick,
  ].join("-")
}

function formatDeliveryPreviewTime(
  delivery: ButlerMessageDeliveryDecision
): string {
  const hour = delivery.checkedAtTick % 24

  return `${String(hour).padStart(2, "0")}:00`
}

export function buildPPhoneButlerDeliveryPreview(
  input: BuildPPhoneButlerDeliveryPreviewInput
): PPhoneMessageItem | null {
  const { delivery } = input

  if (!delivery) return null
  if (!delivery.canEnterDeliveryQueue) return null
  if (!delivery.draftText) return null

  return {
    id: buildDeliveryPreviewId(delivery),
    sender: "butler",
    senderName: input.butlerName,
    text: delivery.draftText,
    timeLabel: formatDeliveryPreviewTime(delivery),
  }
}
