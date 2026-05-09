/**
 * 当前文件负责：把 P-Phone bridge preview 转换为未来 delivery queue 的临时队列项。
 *
 * 注意：
 * 这里不写 AiMessage。
 * 这里不接正式 P-Phone thread。
 * 这里只建立未来投递队列的数据边界。
 */

import type {
  ButlerMessageDeliveryDecision,
} from "@/systems/butler/butler-gateway"

import type {
  PPhoneMessageItem,
} from "./pPhoneMessageMappers"

import {
  buildPPhoneButlerDeliveryPreview,
} from "./pPhoneButlerDeliveryMapper"

export type PPhoneButlerDeliveryQueueItem = {
  queueId: string
  source: "butler_message_delivery"
  status: "preview_only" | "ready_for_future_delivery"
  message: PPhoneMessageItem
  decisionReason: ButlerMessageDeliveryDecision["decisionReason"]
  priority: ButlerMessageDeliveryDecision["priority"]
  createdAtTick: number
  checkedAtTick: number
  tags: string[]
}

export type BuildPPhoneButlerDeliveryQueueItemInput = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

function buildQueueId(input: {
  preview: PPhoneMessageItem
  delivery: ButlerMessageDeliveryDecision
}): string {
  return [
    "butler-delivery-queue",
    input.delivery.decisionReason ?? "unknown",
    input.delivery.createdAtTick,
    input.preview.id,
  ].join("-")
}

export function buildPPhoneButlerDeliveryQueueItem(
  input: BuildPPhoneButlerDeliveryQueueItemInput
): PPhoneButlerDeliveryQueueItem | null {
  const { delivery } = input

  if (!delivery) return null

  const preview = buildPPhoneButlerDeliveryPreview({
    delivery,
    butlerName: input.butlerName,
  })

  if (!preview) return null

  return {
    queueId: buildQueueId({
      preview,
      delivery,
    }),
    source: "butler_message_delivery",
    status: "preview_only",
    message: preview,
    decisionReason: delivery.decisionReason,
    priority: delivery.priority,
    createdAtTick: delivery.createdAtTick,
    checkedAtTick: delivery.checkedAtTick,
    tags: [
      "p-phone-bridge",
      "delivery-queue-preview",
      ...delivery.tags,
    ],
  }
}
