"use client"

/**
 * 当前文件负责：展示管家 P-Phone 手动写入后的持久化读取验证。
 */

import type {
  ButlerMessageDeliveryDecision,
} from "@/systems/butler/butler-gateway"

import {
  buildPPhoneButlerFutureDeliveryQueueItem,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryQueue"

import {
  buildPPhoneButlerAiMessageRecordInput,
} from "@/app/world/ui/phone/messages/pPhoneButlerAiMessageRecordBuilder"

import {
  buildPPhoneButlerDeliveryReadback,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryReadback"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

export default function ButlerPPhoneDeliveryReadbackPanel({
  delivery,
  butlerName,
}: Props) {
  const queueItem = buildPPhoneButlerFutureDeliveryQueueItem({
    delivery,
    butlerName,
  })

  const recordInput = buildPPhoneButlerAiMessageRecordInput({
    queueItem,
    butlerName,
  })

  const readback = buildPPhoneButlerDeliveryReadback({
    recordInput,
    butlerName,
  })

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone Persisted Readback / 持久化读取验证
      </h3>

      <div className={styles.row}>
        <span>found</span>
        <span>{readback.found ? "true" : "false"}</span>
      </div>

      <div className={styles.row}>
        <span>messageId</span>
        <span>{readback.messageId ?? "-"}</span>
      </div>

      <div className={styles.row}>
        <span>recordId</span>
        <span>{readback.recordId ?? "-"}</span>
      </div>

      <div className={styles.row}>
        <span>reason</span>
        <span className={styles.multiline}>
          {readback.reason}
        </span>
      </div>

      {readback.pPhonePreview && (
        <>
          <div className={styles.row}>
            <span>previewSender</span>
            <span>{readback.pPhonePreview.sender}</span>
          </div>

          <div className={styles.row}>
            <span>previewSenderName</span>
            <span>{readback.pPhonePreview.senderName}</span>
          </div>

          <div className={styles.row}>
            <span>previewTimeLabel</span>
            <span>{readback.pPhonePreview.timeLabel}</span>
          </div>

          <div className={styles.row}>
            <span>previewText</span>
            <span className={styles.multiline}>
              {readback.pPhonePreview.text}
            </span>
          </div>
        </>
      )}

      <div className={styles.row}>
        <span>tags</span>
        <span className={styles.multiline}>
          {readback.tags.length > 0 ? readback.tags.join(" / ") : "-"}
        </span>
      </div>

      <div className={styles.row}>
        <span>说明</span>
        <span className={styles.multiline}>
          这里验证 AiMessage 是否已经能被持久化读取链路读到。它不替换正式 P-Phone thread。
        </span>
      </div>
    </div>
  )
}
