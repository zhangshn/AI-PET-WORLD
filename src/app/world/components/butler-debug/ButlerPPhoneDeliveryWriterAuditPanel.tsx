"use client"

/**
 * 当前文件负责：展示管家 P-Phone delivery writer 的受控写入审计。
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
  buildPPhoneButlerDeliveryWritePreview,
  createDisabledPPhoneButlerDeliveryWriteControl,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryWriterTypes"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
}

export default function ButlerPPhoneDeliveryWriterAuditPanel({
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

  const writePreview = buildPPhoneButlerDeliveryWritePreview({
    recordInput,
    control: createDisabledPPhoneButlerDeliveryWriteControl(),
  })

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone Delivery Writer Audit / 写入开关审计
      </h3>

      <div className={styles.row}>
        <span>status</span>
        <span>{writePreview.status}</span>
      </div>

      <div className={styles.row}>
        <span>canWrite</span>
        <span>{writePreview.canWrite ? "true" : "false"}</span>
      </div>

      <div className={styles.row}>
        <span>didWrite</span>
        <span>{writePreview.didWrite ? "true" : "false"}</span>
      </div>

      <div className={styles.row}>
        <span>messageId</span>
        <span>{writePreview.messageId ?? "-"}</span>
      </div>

      <div className={styles.row}>
        <span>recordId</span>
        <span>{writePreview.recordId ?? "-"}</span>
      </div>

      <div className={styles.row}>
        <span>reason</span>
        <span className={styles.multiline}>
          {writePreview.reason}
        </span>
      </div>

      <div className={styles.row}>
        <span>tags</span>
        <span className={styles.multiline}>
          {writePreview.tags.length > 0 ? writePreview.tags.join(" / ") : "-"}
        </span>
      </div>

      <div className={styles.row}>
        <span>说明</span>
        <span className={styles.multiline}>
          当前 writer 默认 disabled。本面板不提供发送按钮，也不会调用 recordAiMessageOnce。
        </span>
      </div>
    </div>
  )
}
