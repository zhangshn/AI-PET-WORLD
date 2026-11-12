"use client"

import styles from "./ai-console-workspace.module.css"
import type { CommandReceipt, ControlEventBinding, ControlTransactionBinding } from "./ai-console-control-types"

export function createIdempotencyKey(): string {
  return `console_${crypto.randomUUID().replaceAll("-", "")}`
}

export function ReceiptDetails({ eventBinding, integrityStatus, logicalPath, receipt, statusLabel, transactionBinding }: {
  eventBinding: ControlEventBinding | null
  integrityStatus: string | null
  logicalPath: string | null
  receipt: CommandReceipt
  statusLabel: string
  transactionBinding: ControlTransactionBinding | null
}) {
  return (
    <div className={styles.controlReceipt}>
      <div><span>命令终态</span><strong>{receipt.resultTerminalId}</strong><small>{statusLabel}</small></div>
      <div><span>完整性</span><strong>{integrityStatus ?? "verified"}</strong><code>{logicalPath ?? "—"}</code></div>
      <div><span>命令身份</span><code>{receipt.commandId}</code></div>
      <div><span>结果证据</span><code>{receipt.resultEvidencePath ?? "—"}</code></div>
      <div><span>证据摘要</span><code>{receipt.resultEvidenceSha256 ?? "—"}</code></div>
      <div><span>回执摘要</span><code>{receipt.receiptSha256}</code></div>
      <div><span>事件绑定</span><code>{eventBinding ? `${eventBinding.eventSequence} · ${eventBinding.eventId}` : "尚未登记到V5事件账本"}</code></div>
      <div><span>事务身份</span><code>{eventBinding?.transactionId ?? "—"}</code></div>
      <div><span>事件摘要</span><code>{eventBinding?.eventSha256 ?? "—"}</code></div>
      <div><span>提交事务</span><code>{transactionBinding ? `${transactionBinding.transactionSequence} · ${transactionBinding.transactionId}` : "尚未登记到V6事务库"}</code></div>
      <div><span>事务状态</span><code>{transactionBinding ? `${transactionBinding.commitStatus} · ${transactionBinding.recoveryStatus}` : "—"}</code></div>
      <div><span>事务摘要</span><code>{transactionBinding?.transactionRecordSha256 ?? "—"}</code></div>
    </div>
  )
}
