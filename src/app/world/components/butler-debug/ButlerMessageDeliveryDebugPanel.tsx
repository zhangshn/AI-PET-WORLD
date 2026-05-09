"use client"

/**
 * 当前文件负责：展示管家消息投递边界判断的开发审计信息。
 */

import type {
  ButlerMessageDeliveryDecision,
} from "@/systems/butler/butler-gateway"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
}

export default function ButlerMessageDeliveryDebugPanel({
  delivery,
}: Props) {
  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        Message Delivery Boundary / 消息投递边界
      </h3>

      {!delivery && (
        <p className={styles.empty}>
          当前还没有生成消息投递边界判断。
        </p>
      )}

      {delivery && (
        <>
          <div className={styles.row}>
            <span>canEnterDeliveryQueue</span>
            <span>{delivery.canEnterDeliveryQueue ? "true" : "false"}</span>
          </div>

          <div className={styles.row}>
            <span>blockReason</span>
            <span>{delivery.blockReason}</span>
          </div>

          <div className={styles.row}>
            <span>decisionReason</span>
            <span>{delivery.decisionReason ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>priority</span>
            <span>{delivery.priority ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>createdAtTick</span>
            <span>{delivery.createdAtTick}</span>
          </div>

          <div className={styles.row}>
            <span>checkedAtTick</span>
            <span>{delivery.checkedAtTick}</span>
          </div>

          <div className={styles.row}>
            <span>draftText</span>
            <span className={styles.multiline}>
              {delivery.draftText ?? "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {delivery.tags.length > 0 ? delivery.tags.join(" / ") : "-"}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              delivery boundary 只判断是否允许未来进入投递队列，不代表已经发送 P-Phone 消息。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
