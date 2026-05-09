"use client"

/**
 * 当前文件负责：展示管家 P-Phone AiMessage record 输入预览。
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

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

export default function ButlerPPhoneAiMessageRecordPreviewPanel({
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

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone AiMessage Record Preview / 消息记录预览
      </h3>

      {!recordInput && (
        <p className={styles.empty}>
          当前没有可生成 AiMessage record 输入的管家消息。
        </p>
      )}

      {recordInput && (
        <>
          <div className={styles.row}>
            <span>id</span>
            <span>{recordInput.id ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>source</span>
            <span>{recordInput.source}</span>
          </div>

          <div className={styles.row}>
            <span>entityType</span>
            <span>{recordInput.entityType}</span>
          </div>

          <div className={styles.row}>
            <span>entityId</span>
            <span>{recordInput.entityId}</span>
          </div>

          <div className={styles.row}>
            <span>importance</span>
            <span>{recordInput.importance}</span>
          </div>

          <div className={styles.row}>
            <span>userVisibleChannel</span>
            <span>{recordInput.userVisibleChannel}</span>
          </div>

          <div className={styles.row}>
            <span>messageId</span>
            <span>{recordInput.messageId}</span>
          </div>

          <div className={styles.row}>
            <span>messageChannel</span>
            <span>{recordInput.messageChannel}</span>
          </div>

          <div className={styles.row}>
            <span>triggerReason</span>
            <span>{recordInput.triggerReason}</span>
          </div>

          <div className={styles.row}>
            <span>sourceEventId</span>
            <span>{recordInput.sourceEventId ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>messageText</span>
            <span className={styles.multiline}>
              {recordInput.messageText}
            </span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {recordInput.tags.length > 0 ? recordInput.tags.join(" / ") : "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              当前只展示 CreateAiMessageRecordInput 预览，不会调用 recordAiMessageOnce，也不会写入正式消息。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
