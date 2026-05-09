"use client"

/**
 * 当前文件负责：展示管家消息进入正式 P-Phone 前的只读集成预览。
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
  buildPPhoneButlerRecordPreviewMessage,
} from "@/app/world/ui/phone/messages/pPhoneButlerRecordPreviewMapper"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

export default function ButlerPPhoneReadonlyIntegrationPreviewPanel({
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

  const previewMessage = buildPPhoneButlerRecordPreviewMessage({
    recordInput,
    fallbackButlerName: butlerName,
  })

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone Readonly Integration Preview / 只读集成预览
      </h3>

      {!previewMessage && (
        <p className={styles.empty}>
          当前没有可展示的只读 P-Phone 集成预览。
        </p>
      )}

      {previewMessage && (
        <>
          <div className={styles.row}>
            <span>messageId</span>
            <span>{previewMessage.id}</span>
          </div>

          <div className={styles.row}>
            <span>sender</span>
            <span>{previewMessage.sender}</span>
          </div>

          <div className={styles.row}>
            <span>senderName</span>
            <span>{previewMessage.senderName}</span>
          </div>

          <div className={styles.row}>
            <span>timeLabel</span>
            <span>{previewMessage.timeLabel}</span>
          </div>

          <div className={styles.row}>
            <span>text</span>
            <span className={styles.multiline}>
              {previewMessage.text}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              这里只是 read-only preview，不会写入 AiMessage，也不会进入正式 P-Phone thread。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
