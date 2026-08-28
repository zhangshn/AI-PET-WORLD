"use client"

import { useEffect, useState, type FormEvent } from "react"
import styles from "./ai-console-workspace.module.css"

type OperatorSession = {
  csrfToken: string
  actorIdentity: string
  role: string
  expiresAtUtc: string
}

type CommandServiceStatus = {
  serviceStatus: "ready" | "failed_closed"
  currentRegistryRevision: number | null
  executorIdentity: string
  executionBoundary: string
  failureCode: string | null
}

type CommandReceipt = {
  commandId: string
  executionStatus: string
  resultTerminalId: string
  resultEvidencePath: string | null
  resultEvidenceSha256: string | null
  receiptSha256: string
  failureCode: string | null
}

type ReceiptResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: "verified"
  receiptLogicalPath?: string
  eventLedgerStatus?: string
  eventLedgerLogicalPath?: string
  eventBinding?: ControlEventBinding | null
  transactionStoreStatus?: string
  transactionStoreLogicalPath?: string
  transactionBinding?: ControlTransactionBinding | null
  receipt?: CommandReceipt
  errorCode?: string
}

type ControlEventBinding = {
  eventId: string
  eventSequence: number
  transactionId: string
  targetState: string
  eventSha256: string
}

type ControlTransactionBinding = {
  transactionId: string
  transactionSequence: number
  commitStatus: string
  recoveryStatus: string
  transactionRecordSha256: string
}

function createIdempotencyKey(): string {
  return `console_${crypto.randomUUID().replaceAll("-", "")}`
}

export function AiConsoleRegistryVerificationControl() {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<CommandServiceStatus | null>(null)
  const [reasonText, setReasonText] = useState("核验新平台主登记完整性")
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [receipt, setReceipt] = useState<CommandReceipt | null>(null)
  const [receiptLogicalPath, setReceiptLogicalPath] = useState<string | null>(null)
  const [receiptIntegrityStatus, setReceiptIntegrityStatus] = useState<string | null>(null)
  const [eventBinding, setEventBinding] = useState<ControlEventBinding | null>(null)
  const [transactionBinding, setTransactionBinding] = useState<ControlTransactionBinding | null>(null)
  const [replayed, setReplayed] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [lookupCommandId, setLookupCommandId] = useState("")
  const [lookupState, setLookupState] = useState<"idle" | "querying" | "verified" | "failed">("idle")
  const [lookupReceipt, setLookupReceipt] = useState<CommandReceipt | null>(null)
  const [lookupReceiptLogicalPath, setLookupReceiptLogicalPath] = useState<string | null>(null)
  const [lookupEventBinding, setLookupEventBinding] = useState<ControlEventBinding | null>(null)
  const [lookupTransactionBinding, setLookupTransactionBinding] = useState<ControlTransactionBinding | null>(null)
  const [lookupErrorCode, setLookupErrorCode] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/commands", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as CommandServiceStatus & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || !serviceResponse.ok || sessionPayload.ok === false || servicePayload.ok === false) {
        setErrorCode(sessionPayload.errorCode ?? servicePayload.errorCode ?? "control_service_connection_failed")
        setState("failed")
        return
      }
      setSession(sessionPayload)
      setService(servicePayload)
      setIdempotencyKey(createIdempotencyKey())
      setState(servicePayload.serviceStatus === "ready" ? "ready" : "failed")
      setErrorCode(servicePayload.failureCode)
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode("control_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !service || service.currentRegistryRevision === null || reasonText.trim().length < 4 || !idempotencyKey) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/commands", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-ai-console-csrf": session.csrfToken,
        },
        body: JSON.stringify({
          commandType: "verify_primary_registry",
          targetType: "primary_registry",
          targetId: "ai_console_primary_registry",
          expectedRegistryRevision: service.currentRegistryRevision,
          idempotencyKey,
          reasonText: reasonText.trim(),
        }),
      })
      const payload = await response.json() as ReceiptResponse
      setReceipt(payload.receipt ?? null)
      setReceiptLogicalPath(payload.receiptLogicalPath ?? null)
      setReceiptIntegrityStatus(payload.integrityStatus ?? null)
      setEventBinding(payload.eventBinding ?? null)
      setTransactionBinding(payload.transactionBinding ?? null)
      if (payload.receipt?.commandId) setLookupCommandId(payload.receipt.commandId)
      setReplayed(payload.replayed ?? false)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
    } catch {
      setErrorCode("control_command_request_failed")
      setState("failed")
    }
  }

  async function lookupReceiptByCommandId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCommandId = lookupCommandId.trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/u.test(normalizedCommandId)) {
      setLookupState("failed")
      setLookupErrorCode("control_command_identity_invalid")
      setLookupReceipt(null)
      setLookupReceiptLogicalPath(null)
      setLookupEventBinding(null)
      setLookupTransactionBinding(null)
      return
    }
    setLookupState("querying")
    setLookupErrorCode(null)
    try {
      const response = await fetch(`/api/ai-console/control/commands?commandId=${encodeURIComponent(normalizedCommandId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload = await response.json() as ReceiptResponse
      if (!response.ok || payload.integrityStatus !== "verified" || !payload.receipt) {
        setLookupState("failed")
        setLookupErrorCode(payload.errorCode ?? "control_command_receipt_query_failed")
        setLookupReceipt(null)
        setLookupReceiptLogicalPath(null)
        setLookupEventBinding(null)
        setLookupTransactionBinding(null)
        return
      }
      setLookupState("verified")
      setLookupReceipt(payload.receipt)
      setLookupReceiptLogicalPath(payload.receiptLogicalPath ?? null)
      setLookupEventBinding(payload.eventBinding ?? null)
      setLookupTransactionBinding(payload.transactionBinding ?? null)
    } catch {
      setLookupState("failed")
      setLookupErrorCode("control_command_receipt_query_failed")
      setLookupReceipt(null)
      setLookupReceiptLogicalPath(null)
      setLookupEventBinding(null)
      setLookupTransactionBinding(null)
    }
  }

  function resetRequest() {
    setIdempotencyKey(createIdempotencyKey())
    setReceipt(null)
    setReceiptLogicalPath(null)
    setReceiptIntegrityStatus(null)
    setEventBinding(null)
    setTransactionBinding(null)
    setReplayed(false)
    setErrorCode(null)
    setState(service?.serviceStatus === "ready" ? "ready" : "failed")
  }

  const canSubmit = state === "ready" && Boolean(session && service?.currentRegistryRevision && idempotencyKey && reasonText.trim().length >= 4)
  return (
    <section className={styles.controlExecutionSurface} aria-label="新平台主登记核验命令">
      <header>
        <div><span>LOCAL SAFE EXECUTOR</span><strong>新平台主登记核验</strong></div>
        <small className={state === "ready" || state === "succeeded" ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "EXECUTING" : service?.serviceStatus === "ready" ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>目标登记</span><code>ai_console_primary_registry</code></div>
        <div><span>预期修订</span><strong>{service?.currentRegistryRevision ?? "—"}</strong></div>
        <div><span>执行边界</span><code>{service?.executionBoundary ?? "new_ai_console_registry_only"}</code></div>
      </div>
      <form onSubmit={submitVerification}>
        <label><span>操作原因</span><input aria-label="主登记核验原因" maxLength={240} minLength={4} onChange={(event) => setReasonText(event.target.value)} type="text" value={reasonText} /></label>
        <button disabled={!canSubmit} type="submit">{state === "submitting" ? "正在核验…" : "核验主登记"}</button>
        {receipt ? <button className={styles.controlSecondaryAction} onClick={resetRequest} type="button">新建请求</button> : null}
      </form>
      {receipt ? <ReceiptDetails eventBinding={eventBinding} integrityStatus={receiptIntegrityStatus} logicalPath={receiptLogicalPath} receipt={receipt} statusLabel={replayed ? "IDEMPOTENT REPLAY" : receipt.executionStatus} transactionBinding={transactionBinding} /> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <section className={styles.controlReceiptLookup} aria-label="控制命令回执精确查询">
        <header><div><span>EXACT RECEIPT LOOKUP</span><strong>按命令身份复核回执</strong></div><small>{lookupState === "querying" ? "VERIFYING" : lookupState === "verified" ? "VERIFIED" : lookupState === "failed" ? "FAILED CLOSED" : "READY"}</small></header>
        <p>只按完整命令身份读取固定路径并由服务端重新校验结构、终态和SHA-256；不扫描回执目录。</p>
        <form onSubmit={lookupReceiptByCommandId}>
          <label><span>命令身份</span><input aria-label="待复核命令身份" autoComplete="off" maxLength={64} minLength={64} onChange={(event) => setLookupCommandId(event.target.value)} pattern="[a-fA-F0-9]{64}" placeholder="64位命令身份" spellCheck={false} type="text" value={lookupCommandId} /></label>
          <button disabled={lookupState === "querying" || !/^[a-fA-F0-9]{64}$/u.test(lookupCommandId.trim())} type="submit">{lookupState === "querying" ? "正在复核…" : "复核回执"}</button>
        </form>
        {lookupReceipt ? <ReceiptDetails eventBinding={lookupEventBinding} integrityStatus="verified" logicalPath={lookupReceiptLogicalPath} receipt={lookupReceipt} statusLabel="SERVER VERIFIED" transactionBinding={lookupTransactionBinding} /> : null}
        {lookupErrorCode ? <p className={styles.controlExecutionError}><span>LOOKUP FAILURE</span><code>{lookupErrorCode}</code></p> : null}
      </section>
      <footer>该执行器只读取并验证新控制台主登记；不访问训练Run、Checkpoint、审核、Runtime或旧平台。</footer>
    </section>
  )
}

function ReceiptDetails({ eventBinding, integrityStatus, logicalPath, receipt, statusLabel, transactionBinding }: {
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
