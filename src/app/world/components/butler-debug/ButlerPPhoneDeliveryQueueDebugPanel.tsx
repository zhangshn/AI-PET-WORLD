"use client"

/**
 * 当前文件负责：展示管家 P-Phone delivery queue 预备项的开发审计信息。
 */

import type {
  ButlerMessageDeliveryDecision,
} from "@/systems/butler/butler-gateway"

import {
  buildPPhoneButlerDeliveryQueueItem,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryQueue"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

export default function ButlerPPhoneDeliveryQueueDebugPanel({
  delivery,
  butlerName,
}: Props) {
  const queueItem = buildPPhoneButlerDeliveryQueueItem({
    delivery,
    butlerName,
  })

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone Delivery Queue Preview / 投递队列预览
      </h3>

      {!queueItem && (
        <p className={styles.empty}>
          当前没有可进入未来投递队列的管家消息预备项。
        </p>
      )}

      {queueItem && (
        <>
          <div className={styles.row}>
            <span>queueId</span>
            <span>{queueItem.queueId}</span>
          </div>

          <div className={styles.row}>
            <span>source</span>
            <span>{queueItem.source}</span>
          </div>

          <div className={styles.row}>
            <span>status</span>
            <span>{queueItem.status}</span>
          </div>

          <div className={styles.row}>
            <span>decisionReason</span>
            <span>{queueItem.decisionReason ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>priority</span>
            <span>{queueItem.priority ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>createdAtTick</span>
            <span>{queueItem.createdAtTick}</span>
          </div>

          <div className={styles.row}>
            <span>checkedAtTick</span>
            <span>{queueItem.checkedAtTick}</span>
          </div>

          <div className={styles.row}>
            <span>messageText</span>
            <span className={styles.multiline}>
              {queueItem.message.text}
            </span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {queueItem.tags.length > 0 ? queueItem.tags.join(" / ") : "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              当前 queue item 仍是 preview_only，不会写入 AiMessage，也不会出现在正式 P-Phone。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
