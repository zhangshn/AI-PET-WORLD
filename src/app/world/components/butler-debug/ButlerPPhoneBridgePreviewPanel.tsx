"use client"

/**
 * 当前文件负责：展示管家 message delivery 到 P-Phone preview mapper 的开发审计信息。
 */

import type {
  ButlerMessageDeliveryDecision,
} from "@/systems/butler/butler-gateway"

import {
  buildPPhoneButlerDeliveryPreview,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryMapper"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

export default function ButlerPPhoneBridgePreviewPanel({
  delivery,
  butlerName,
}: Props) {
  const preview = buildPPhoneButlerDeliveryPreview({
    delivery,
    butlerName,
  })

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone Bridge Preview / 管家短信预览桥
      </h3>

      {!preview && (
        <p className={styles.empty}>
          当前 delivery boundary 未放行，或没有可预览的 draftText。
        </p>
      )}

      {preview && (
        <>
          <div className={styles.row}>
            <span>previewId</span>
            <span>{preview.id}</span>
          </div>

          <div className={styles.row}>
            <span>sender</span>
            <span>{preview.sender}</span>
          </div>

          <div className={styles.row}>
            <span>senderName</span>
            <span>{preview.senderName}</span>
          </div>

          <div className={styles.row}>
            <span>timeLabel</span>
            <span>{preview.timeLabel}</span>
          </div>

          <div className={styles.row}>
            <span>text</span>
            <span className={styles.multiline}>
              {preview.text}
            </span>
          </div>

          <div className={styles.row}>
            <span>说明</span>
            <span className={styles.multiline}>
              这里只是 preview，不代表已经进入正式 P-Phone，也不会写入 AiMessage。
            </span>
          </div>
        </>
      )}
    </div>
  )
}
