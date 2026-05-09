"use client"

/**
 * 当前文件负责：提供开发限定的管家 P-Phone 手动写入审计入口。
 *
 * 注意：
 * 只有点击按钮时才会调用 writer。
 * 不自动写入。
 * 不接正式 P-Phone thread。
 */

import { useMemo, useState } from "react"

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
  createEnabledPPhoneButlerDeliveryWriteControl,
  type PPhoneButlerDeliveryWriteResult,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryWriterTypes"

import {
  writePPhoneButlerDeliveryMessageOnce,
} from "@/app/world/ui/phone/messages/pPhoneButlerDeliveryWriter"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  delivery: ButlerMessageDeliveryDecision | null
  butlerName: string
  onWriteResult?: (result: PPhoneButlerDeliveryWriteResult) => void
}

export default function ButlerPPhoneManualDeliveryWritePanel({
  delivery,
  butlerName,
  onWriteResult,
}: Props) {
  const [writeResult, setWriteResult] =
    useState<PPhoneButlerDeliveryWriteResult | null>(null)

  const queueItem = useMemo(
    () =>
      buildPPhoneButlerFutureDeliveryQueueItem({
        delivery,
        butlerName,
      }),
    [delivery, butlerName]
  )

  const recordInput = useMemo(
    () =>
      buildPPhoneButlerAiMessageRecordInput({
        queueItem,
        butlerName,
      }),
    [queueItem, butlerName]
  )

  const canAttemptWrite = Boolean(recordInput)

  function handleManualWrite(): void {
    const result = writePPhoneButlerDeliveryMessageOnce({
      recordInput,
      control: createEnabledPPhoneButlerDeliveryWriteControl(
        "开发面板手动触发写入，用于验证 P-Phone 持久化读取链路。"
      ),
    })

    setWriteResult(result)
    onWriteResult?.(result)
  }

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        P-Phone Manual Delivery Write / 手动写入验证
      </h3>

      <div className={styles.row}>
        <span>canAttemptWrite</span>
        <span>{canAttemptWrite ? "true" : "false"}</span>
      </div>

      <div className={styles.row}>
        <span>recordMessageId</span>
        <span>{recordInput?.messageId ?? "-"}</span>
      </div>

      <div className={styles.row}>
        <span>说明</span>
        <span className={styles.multiline}>
          这是开发限定按钮。只有点击时才会尝试写入 AiMessage，不会自动发送，也不会替换正式 P-Phone thread。
        </span>
      </div>

      <button
        type="button"
        disabled={!canAttemptWrite}
        onClick={handleManualWrite}
      >
        手动写入 AiMessage（开发验证）
      </button>

      {!writeResult && (
        <p className={styles.empty}>
          当前还没有执行手动写入。
        </p>
      )}

      {writeResult && (
        <>
          <div className={styles.row}>
            <span>status</span>
            <span>{writeResult.status}</span>
          </div>

          <div className={styles.row}>
            <span>canWrite</span>
            <span>{writeResult.canWrite ? "true" : "false"}</span>
          </div>

          <div className={styles.row}>
            <span>didWrite</span>
            <span>{writeResult.didWrite ? "true" : "false"}</span>
          </div>

          <div className={styles.row}>
            <span>messageId</span>
            <span>{writeResult.messageId ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>recordId</span>
            <span>{writeResult.recordId ?? "-"}</span>
          </div>

          <div className={styles.row}>
            <span>reason</span>
            <span className={styles.multiline}>
              {writeResult.reason}
            </span>
          </div>

          <div className={styles.row}>
            <span>tags</span>
            <span className={styles.multiline}>
              {writeResult.tags.length > 0 ? writeResult.tags.join(" / ") : "-"}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
