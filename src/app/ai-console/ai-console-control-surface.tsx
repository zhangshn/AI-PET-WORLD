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

type TaskServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  taskCount: number
  queuedTasks: readonly {
    taskId: string
    taskGoal: string
    capabilityDomain: string
    priority: number
    taskRevision: number
    queuedAtUtc: string
  }[]
}

type TaskCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  task?: { taskId: string; taskGoal: string; priority: number; lifecycleStatus: string; taskRecordSha256: string } | null
  event?: { taskEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

type CapabilityServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  candidateCount: number
  qualificationCount: number
  releaseCount: number
  candidates: readonly {
    capabilityVersionId: string
    capabilityDomain: string
    modelIdentity: string
    datasetReleaseIdentity: string
    qualificationStage: string
    candidateStatus: string
    candidateRevision: number
  }[]
  releases: readonly {
    capabilityReleaseIdentity: string
    capabilityDomain: string
    capabilityVersionId: string
    releaseStatus: string
  }[]
}

type CapabilityCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  candidate?: { capabilityVersionId: string; candidateStatus: string; candidateRecordSha256: string } | null
  qualification?: { qualificationResultId: string; qualificationGateId: string; qualificationRecordSha256: string } | null
  release?: { capabilityReleaseIdentity: string; releaseStatus: string; releaseRecordSha256: string } | null
  event?: { lifecycleEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

type TrainingDesignServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  modelStructureCount: number
  trainingPlanCount: number
  modelStructures: readonly {
    modelStructureId: string
    capabilityDomain: string
    modelFamily: string
    parameterCount: number
    modelStructureStatus: string
  }[]
  trainingPlans: readonly {
    trainingPlanId: string
    capabilityDomain: string
    modelStructureId: string
    datasetReleaseIdentity: string
    planStatus: string
  }[]
}

type TrainingDesignCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  modelStructure?: { modelStructureId: string; modelStructureStatus: string; modelStructureRecordSha256: string } | null
  trainingPlan?: { trainingPlanId: string; planStatus: string; trainingPlanRecordSha256: string } | null
  event?: { designEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

type ReviewAdjudicationServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  decisionBoundary: string
  registryRevision: number
  reviewContractCount: number
  reviewResultCount: number
  reviewContracts: readonly {
    reviewContractId: string
    capabilityDomain: string
    reviewerIdentity: string
    reviewerVersion: string
    metricDefinitionId: string
    thresholdOperator: "greater_or_equal" | "less_or_equal"
    thresholdValue: number
    thresholdUnit: string
    failureCode: string
    contractStatus: string
  }[]
  reviewResults: readonly {
    reviewResultId: string
    reviewRunId: string
    reviewContractId: string
    reviewNodeId: string
    reviewerIdentity: string
    metricValue: number
    reviewStatus: "passed" | "failed"
    resultTerminalStatus: string
  }[]
}

type ReviewAdjudicationCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    failureCode: string | null
    commandReceiptSha256: string
  }
  reviewContract?: { reviewContractId: string; contractStatus: string; reviewContractRecordSha256: string } | null
  reviewResult?: { reviewResultId: string; reviewStatus: "passed" | "failed"; resultTerminalStatus: string; reviewResultRecordSha256: string } | null
  event?: { adjudicationEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

type RuntimeReleaseServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: string
  registryRevision: number
  activationCount: number
  candidateCount: number
  publicationCount: number
  qualifiedReleases: readonly { capabilityReleaseIdentity: string; capabilityDomain: string; capabilityVersionId: string; releaseStatus: string }[]
  activations: readonly { activationId: string; capabilityDomain: string; capabilityReleaseIdentity: string; activationStatus: "active" | "superseded"; activatedAtUtc: string }[]
  candidates: readonly { runtimeFrameCandidateIdentity: string; activationId: string; capabilityDomain: string; capabilityReleaseIdentity: string; worldId: string; tick: number; candidateStatus: string }[]
  reviewResults: readonly { reviewResultId: string; validationInputIdentity: string; capabilityDomain: string; reviewStatus: "passed" | "failed" }[]
  publications: readonly { publishIdentity: string; runtimeFrameIdentity: string; runtimeFrameCandidateIdentity: string; worldId: string; tick: number; runtimeFrameStatus: string }[]
}

type RuntimeReleaseCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: { commandId: string; commandType: string; resultTerminalId: string; resultingRegistryRevision: number; failureCode: string | null; commandReceiptSha256: string }
  activation?: { activationId: string; capabilityReleaseIdentity: string; activationRecordSha256: string } | null
  candidate?: { runtimeFrameCandidateIdentity: string; candidateStatus: string; candidateRecordSha256: string } | null
  publication?: { publishIdentity: string; runtimeFrameIdentity: string; runtimeFrameStatus: string; publicationRecordSha256: string } | null
  event?: { runtimeReleaseEventId: string; eventSequence: number; eventType: string; eventRecordSha256: string } | null
  errorCode?: string
}

const qualificationGates = ["cpu_contract", "readonly_gpu", "controlled_smoke", "formal_stage", "independent_regression", "machine_release_adjudication"] as const

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

export function AiConsoleTaskRegistryControl() {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<TaskServiceState | null>(null)
  const [taskGoal, setTaskGoal] = useState("")
  const [capabilityDomain, setCapabilityDomain] = useState("visual_world_generation")
  const [priority, setPriority] = useState(5)
  const [selectedTaskId, setSelectedTaskId] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [result, setResult] = useState<TaskCommandResponse | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  async function loadService(signal?: AbortSignal) {
    const response = await fetch("/api/ai-console/control/tasks", { cache: "no-store", credentials: "same-origin", signal })
    const payload = await response.json() as TaskServiceState & { ok?: boolean; errorCode?: string }
    if (!response.ok || payload.ok === false) throw new Error(payload.errorCode ?? "task_service_connection_failed")
    setService(payload)
    setSelectedTaskId((current) => payload.queuedTasks.some((task) => task.taskId === current) ? current : payload.queuedTasks[0]?.taskId ?? "")
    return payload
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/tasks", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as TaskServiceState & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || sessionPayload.ok === false || !serviceResponse.ok || servicePayload.ok === false) throw new Error(sessionPayload.errorCode ?? servicePayload.errorCode ?? "task_service_session_failed")
      setSession(sessionPayload)
      setService(servicePayload)
      setSelectedTaskId(servicePayload.queuedTasks[0]?.taskId ?? "")
      setState("ready")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode(error instanceof Error ? error.message : "task_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitCommand(body: Record<string, unknown>) {
    if (!session || !service) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/tasks", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ai-console-csrf": session.csrfToken },
        body: JSON.stringify({ ...body, expectedRegistryRevision: service.registryRevision, idempotencyKey: createIdempotencyKey() }),
      })
      const payload = await response.json() as TaskCommandResponse
      setResult(payload)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
      await loadService()
    } catch {
      setErrorCode("task_command_request_failed")
      setState("failed")
    }
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (taskGoal.trim().length < 4) return
    void submitCommand({ commandType: "create_registered_task", taskGoal: taskGoal.trim(), capabilityDomain, priority, reasonText: "通过本地控制台登记新平台任务" }).then(() => setTaskGoal(""))
  }

  function submitTaskAction(commandType: "set_queued_task_priority" | "cancel_unstarted_task") {
    if (!selectedTaskId) return
    void submitCommand({ commandType, taskId: selectedTaskId, ...(commandType === "set_queued_task_priority" ? { priority } : {}), reasonText: commandType === "cancel_unstarted_task" ? "通过本地控制台取消未启动任务" : "通过本地控制台调整排队任务优先级" })
  }

  const canWrite = state !== "connecting" && state !== "submitting" && Boolean(session && service)
  return (
    <section className={styles.controlExecutionSurface} aria-label="新平台任务登记控制">
      <header>
        <div><span>LOCAL TASK REGISTRY</span><strong>新平台任务登记与队列控制</strong></div>
        <small className={canWrite ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "COMMITTING" : service ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>登记修订</span><strong>{service?.registryRevision ?? "—"}</strong></div>
        <div><span>任务总数</span><strong>{service?.taskCount ?? "—"}</strong></div>
        <div><span>执行边界</span><code>{service?.executionBoundary ?? "new_ai_console_task_registry_only"}</code></div>
      </div>
      <form className={styles.taskRegistryCreateForm} onSubmit={submitCreate}>
        <label><span>任务目标</span><input aria-label="新平台任务目标" maxLength={2000} minLength={4} onChange={(event) => setTaskGoal(event.target.value)} placeholder="输入清晰、可验收的任务目标" type="text" value={taskGoal} /></label>
        <label><span>能力域</span><select aria-label="任务能力域" onChange={(event) => setCapabilityDomain(event.target.value)} value={capabilityDomain}><option value="visual_world_generation">AI Painter</option><option value="text_and_language">文字与语言</option><option value="speech_and_audio">语音与音频</option><option value="video_generation">视频</option><option value="multimodal_orchestration">多模态</option></select></label>
        <label><span>优先级</span><input aria-label="任务优先级" max={9} min={1} onChange={(event) => setPriority(Number(event.target.value))} type="number" value={priority} /></label>
        <button disabled={!canWrite || taskGoal.trim().length < 4} type="submit">登记任务</button>
      </form>
      <div className={styles.taskRegistryActions}>
        <label><span>未启动任务</span><select aria-label="选择未启动任务" disabled={!service?.queuedTasks.length} onChange={(event) => setSelectedTaskId(event.target.value)} value={selectedTaskId}><option value="">{service?.queuedTasks.length ? "选择任务" : "当前无排队任务"}</option>{service?.queuedTasks.map((task) => <option key={task.taskId} value={task.taskId}>{task.taskGoal} · P{task.priority}</option>)}</select></label>
        <button disabled={!canWrite || !selectedTaskId} onClick={() => submitTaskAction("set_queued_task_priority")} type="button">更新优先级</button>
        <button className={styles.controlSecondaryAction} disabled={!canWrite || !selectedTaskId} onClick={() => submitTaskAction("cancel_unstarted_task")} type="button">取消未启动任务</button>
      </div>
      {result?.receipt ? <div className={styles.controlReceipt}>
        <div><span>命令终态</span><strong>{result.receipt.resultTerminalId}</strong><small>{result.replayed ? "IDEMPOTENT REPLAY" : result.receipt.commandType}</small></div>
        <div><span>登记修订</span><strong>{result.receipt.resultingRegistryRevision}</strong><code>{result.storeLogicalPath}</code></div>
        <div><span>命令身份</span><code>{result.receipt.commandId}</code></div>
        <div><span>任务身份</span><code>{result.task?.taskId ?? "—"}</code></div>
        <div><span>任务记录摘要</span><code>{result.task?.taskRecordSha256 ?? "—"}</code></div>
        <div><span>事件摘要</span><code>{result.event?.eventRecordSha256 ?? "—"}</code></div>
      </div> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <footer>这里只登记、调整或取消新平台自身尚未启动的任务；不会启动训练、审核、Runtime、外部进程或旧平台功能。</footer>
    </section>
  )
}

export function AiConsoleCapabilityLifecycleControl() {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<CapabilityServiceState | null>(null)
  const [capabilityDomain, setCapabilityDomain] = useState("visual_world_generation")
  const [parentCapabilityVersionId, setParentCapabilityVersionId] = useState("")
  const [modelIdentity, setModelIdentity] = useState("")
  const [datasetReleaseIdentity, setDatasetReleaseIdentity] = useState("")
  const [trainingParadigm, setTrainingParadigm] = useState("")
  const [selectedCandidateId, setSelectedCandidateId] = useState("")
  const [qualificationStatus, setQualificationStatus] = useState<"passed" | "failed">("passed")
  const [evidenceSha256, setEvidenceSha256] = useState("")
  const [conditionSchemaId, setConditionSchemaId] = useState("")
  const [previousReleaseIdentity, setPreviousReleaseIdentity] = useState("")
  const [rollbackReleaseIdentity, setRollbackReleaseIdentity] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [result, setResult] = useState<CapabilityCommandResponse | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  async function loadService(signal?: AbortSignal) {
    const response = await fetch("/api/ai-console/control/capabilities", { cache: "no-store", credentials: "same-origin", signal })
    const payload = await response.json() as CapabilityServiceState & { ok?: boolean; errorCode?: string }
    if (!response.ok || payload.ok === false) throw new Error(payload.errorCode ?? "capability_service_connection_failed")
    setService(payload)
    setSelectedCandidateId((current) => payload.candidates.some((candidate) => candidate.capabilityVersionId === current) ? current : payload.candidates[0]?.capabilityVersionId ?? "")
    return payload
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/capabilities", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as CapabilityServiceState & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || sessionPayload.ok === false || !serviceResponse.ok || servicePayload.ok === false) throw new Error(sessionPayload.errorCode ?? servicePayload.errorCode ?? "capability_service_session_failed")
      setSession(sessionPayload)
      setService(servicePayload)
      setSelectedCandidateId(servicePayload.candidates[0]?.capabilityVersionId ?? "")
      setState("ready")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode(error instanceof Error ? error.message : "capability_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitCommand(body: Record<string, unknown>) {
    if (!session || !service) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/capabilities", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ai-console-csrf": session.csrfToken },
        body: JSON.stringify({ ...body, expectedRegistryRevision: service.registryRevision, idempotencyKey: createIdempotencyKey() }),
      })
      const payload = await response.json() as CapabilityCommandResponse
      setResult(payload)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
      await loadService()
    } catch {
      setErrorCode("capability_command_request_failed")
      setState("failed")
    }
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (![modelIdentity, datasetReleaseIdentity, trainingParadigm].every((value) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value))) return
    void submitCommand({
      commandType: "register_capability_candidate",
      capabilityDomain,
      parentCapabilityVersionId: parentCapabilityVersionId || null,
      modelIdentity,
      datasetReleaseIdentity,
      trainingParadigm,
      reasonText: "通过本地控制台登记能力候选版本",
    })
  }

  const selectedCandidate = service?.candidates.find((candidate) => candidate.capabilityVersionId === selectedCandidateId)
  const completedGateIndex = selectedCandidate?.qualificationStage === "not_started" ? -1 : qualificationGates.indexOf(selectedCandidate?.qualificationStage as (typeof qualificationGates)[number])
  const nextQualificationGate = selectedCandidate && ["registered", "qualifying"].includes(selectedCandidate.candidateStatus) ? qualificationGates[completedGateIndex + 1] : undefined
  const canWrite = state !== "connecting" && state !== "submitting" && Boolean(session && service)
  const candidateInputValid = [modelIdentity, datasetReleaseIdentity, trainingParadigm].every((value) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value))
  const evidenceValid = /^[a-fA-F0-9]{64}$/u.test(evidenceSha256)
  const conditionSchemaValid = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(conditionSchemaId)

  return (
    <section className={styles.controlExecutionSurface} aria-label="新平台能力生命周期控制">
      <header>
        <div><span>LOCAL CAPABILITY REGISTRY</span><strong>能力候选、资格与发布登记</strong></div>
        <small className={canWrite ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "COMMITTING" : service ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>登记修订</span><strong>{service?.registryRevision ?? "—"}</strong></div>
        <div><span>生命周期记录</span><strong>{service ? `${service.candidateCount} / ${service.qualificationCount} / ${service.releaseCount}` : "—"}</strong></div>
        <div><span>执行边界</span><code>{service?.executionBoundary ?? "new_ai_console_capability_registry_only"}</code></div>
      </div>

      <form className={styles.capabilityCandidateForm} onSubmit={submitCandidate}>
        <div className={styles.controlFormHeading}><span>01 · CANDIDATE</span><strong>登记能力候选</strong><small>只建立新平台候选身份，不启动训练。</small></div>
        <label><span>能力域</span><select aria-label="候选能力域" onChange={(event) => { setCapabilityDomain(event.target.value); setParentCapabilityVersionId("") }} value={capabilityDomain}><option value="visual_world_generation">AI Painter</option><option value="text_and_language">文字与语言</option><option value="speech_and_audio">语音与音频</option><option value="video_generation">视频</option><option value="multimodal_orchestration">多模态</option></select></label>
        <label><span>模型身份</span><input aria-label="候选模型身份" maxLength={160} onChange={(event) => setModelIdentity(event.target.value)} placeholder="model:family/version" spellCheck={false} type="text" value={modelIdentity} /></label>
        <label><span>数据发布身份</span><input aria-label="候选数据发布身份" maxLength={160} onChange={(event) => setDatasetReleaseIdentity(event.target.value)} placeholder="dataset:release/version" spellCheck={false} type="text" value={datasetReleaseIdentity} /></label>
        <label><span>训练范式</span><input aria-label="候选训练范式" maxLength={160} onChange={(event) => setTrainingParadigm(event.target.value)} placeholder="training:paradigm/version" spellCheck={false} type="text" value={trainingParadigm} /></label>
        <label><span>父候选版本</span><select aria-label="父候选版本" onChange={(event) => setParentCapabilityVersionId(event.target.value)} value={parentCapabilityVersionId}><option value="">无父版本</option>{service?.candidates.filter((candidate) => candidate.capabilityDomain === capabilityDomain).map((candidate) => <option key={candidate.capabilityVersionId} value={candidate.capabilityVersionId}>{candidate.modelIdentity} · {candidate.capabilityVersionId.slice(0, 12)}</option>)}</select></label>
        <button disabled={!canWrite || !candidateInputValid} type="submit">登记候选版本</button>
      </form>

      <div className={styles.capabilityLifecycleActions}>
        <div className={styles.controlFormHeading}><span>02 · QUALIFICATION</span><strong>顺序登记资格结果</strong><small>只接收证据摘要；不得跳过门禁。</small></div>
        <label><span>候选版本</span><select aria-label="资格候选版本" disabled={!service?.candidates.length} onChange={(event) => setSelectedCandidateId(event.target.value)} value={selectedCandidateId}><option value="">{service?.candidates.length ? "选择候选版本" : "当前无候选版本"}</option>{service?.candidates.map((candidate) => <option key={candidate.capabilityVersionId} value={candidate.capabilityVersionId}>{candidate.modelIdentity} · {candidate.candidateStatus}</option>)}</select></label>
        <label><span>下一门禁</span><input aria-label="下一资格门禁" readOnly type="text" value={nextQualificationGate ?? "当前不可登记"} /></label>
        <label><span>资格结果</span><select aria-label="资格结果" onChange={(event) => setQualificationStatus(event.target.value as "passed" | "failed")} value={qualificationStatus}><option value="passed">通过</option><option value="failed">失败关闭</option></select></label>
        <label><span>证据SHA-256</span><input aria-label="资格证据摘要" maxLength={64} onChange={(event) => setEvidenceSha256(event.target.value)} placeholder="64位证据摘要" spellCheck={false} type="text" value={evidenceSha256} /></label>
        <button disabled={!canWrite || !selectedCandidateId || !nextQualificationGate || !evidenceValid} onClick={() => { if (nextQualificationGate) void submitCommand({ commandType: "record_capability_qualification", capabilityVersionId: selectedCandidateId, qualificationGateId: nextQualificationGate, qualificationStatus, evidenceSha256: evidenceSha256.toLowerCase(), reasonText: "通过本地控制台登记能力资格结果" }) }} type="button">登记资格结果</button>
      </div>

      <div className={styles.capabilityLifecycleActions}>
        <div className={styles.controlFormHeading}><span>03 · RELEASE</span><strong>登记非活动发布身份</strong><small>只有六级资格全部通过后才开放；不会激活发布。</small></div>
        <label><span>条件Schema</span><input aria-label="发布条件Schema身份" maxLength={160} onChange={(event) => setConditionSchemaId(event.target.value)} placeholder="condition:schema/version" spellCheck={false} type="text" value={conditionSchemaId} /></label>
        <label><span>前序发布</span><select aria-label="前序发布身份" onChange={(event) => setPreviousReleaseIdentity(event.target.value)} value={previousReleaseIdentity}><option value="">无前序发布</option>{service?.releases.filter((release) => release.capabilityDomain === selectedCandidate?.capabilityDomain).map((release) => <option key={release.capabilityReleaseIdentity} value={release.capabilityReleaseIdentity}>{release.capabilityReleaseIdentity.slice(0, 16)} · {release.releaseStatus}</option>)}</select></label>
        <label><span>回退发布</span><select aria-label="回退发布身份" onChange={(event) => setRollbackReleaseIdentity(event.target.value)} value={rollbackReleaseIdentity}><option value="">未登记回退版本</option>{service?.releases.filter((release) => release.capabilityDomain === selectedCandidate?.capabilityDomain).map((release) => <option key={release.capabilityReleaseIdentity} value={release.capabilityReleaseIdentity}>{release.capabilityReleaseIdentity.slice(0, 16)} · {release.releaseStatus}</option>)}</select></label>
        <button disabled={!canWrite || selectedCandidate?.candidateStatus !== "qualified" || !conditionSchemaValid} onClick={() => void submitCommand({ commandType: "register_qualified_capability_release", capabilityVersionId: selectedCandidateId, conditionSchemaId, previousReleaseIdentity: previousReleaseIdentity || null, rollbackReleaseIdentity: rollbackReleaseIdentity || null, reasonText: "通过本地控制台登记已资格化的非活动能力发布" })} type="button">登记非活动发布</button>
      </div>

      {result?.receipt ? <div className={styles.controlReceipt}>
        <div><span>命令终态</span><strong>{result.receipt.resultTerminalId}</strong><small>{result.replayed ? "IDEMPOTENT REPLAY" : result.receipt.commandType}</small></div>
        <div><span>登记修订</span><strong>{result.receipt.resultingRegistryRevision}</strong><code>{result.storeLogicalPath}</code></div>
        <div><span>命令身份</span><code>{result.receipt.commandId}</code></div>
        <div><span>候选身份</span><code>{result.candidate?.capabilityVersionId ?? "—"}</code></div>
        <div><span>资格/发布身份</span><code>{result.qualification?.qualificationResultId ?? result.release?.capabilityReleaseIdentity ?? "—"}</code></div>
        <div><span>事件摘要</span><code>{result.event?.eventRecordSha256 ?? "—"}</code></div>
      </div> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <footer>此Frame只登记候选、资格证据摘要和非活动发布身份；合格发布激活由下方V15独立Frame完成，停用、回退、训练、审核与Runtime执行保持禁用。</footer>
    </section>
  )
}

export function AiConsoleTrainingDesignControl() {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<TrainingDesignServiceState | null>(null)
  const [capabilityDomain, setCapabilityDomain] = useState("visual_world_generation")
  const [modelFamily, setModelFamily] = useState("")
  const [architectureDefinitionSha256, setArchitectureDefinitionSha256] = useState("")
  const [sourceCodeSha256, setSourceCodeSha256] = useState("")
  const [inputConditionSchemaId, setInputConditionSchemaId] = useState("")
  const [outputSchemaId, setOutputSchemaId] = useState("")
  const [parameterCount, setParameterCount] = useState("1")
  const [modelStructureId, setModelStructureId] = useState("")
  const [datasetReleaseIdentity, setDatasetReleaseIdentity] = useState("")
  const [splitIdentity, setSplitIdentity] = useState("")
  const [randomSeed, setRandomSeed] = useState("0")
  const [nativeResolution, setNativeResolution] = useState("512x512")
  const [epochBudget, setEpochBudget] = useState("1")
  const [parentTerminalRule, setParentTerminalRule] = useState("")
  const [optimizerConfigSha256, setOptimizerConfigSha256] = useState("")
  const [resourceProfileIdentity, setResourceProfileIdentity] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [result, setResult] = useState<TrainingDesignCommandResponse | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  async function loadService(signal?: AbortSignal) {
    const response = await fetch("/api/ai-console/control/training", { cache: "no-store", credentials: "same-origin", signal })
    const payload = await response.json() as TrainingDesignServiceState & { ok?: boolean; errorCode?: string }
    if (!response.ok || payload.ok === false) throw new Error(payload.errorCode ?? "training_design_service_connection_failed")
    setService(payload)
    setModelStructureId((current) => payload.modelStructures.some((model) => model.modelStructureId === current) ? current : payload.modelStructures[0]?.modelStructureId ?? "")
    return payload
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/training", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as TrainingDesignServiceState & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || sessionPayload.ok === false || !serviceResponse.ok || servicePayload.ok === false) throw new Error(sessionPayload.errorCode ?? servicePayload.errorCode ?? "training_design_service_session_failed")
      setSession(sessionPayload)
      setService(servicePayload)
      setModelStructureId(servicePayload.modelStructures[0]?.modelStructureId ?? "")
      setState("ready")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode(error instanceof Error ? error.message : "training_design_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitCommand(body: Record<string, unknown>) {
    if (!session || !service) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/training", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ai-console-csrf": session.csrfToken },
        body: JSON.stringify({ ...body, expectedRegistryRevision: service.registryRevision, idempotencyKey: createIdempotencyKey() }),
      })
      const payload = await response.json() as TrainingDesignCommandResponse
      setResult(payload)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
      await loadService()
    } catch {
      setErrorCode("training_design_command_request_failed")
      setState("failed")
    }
  }

  const isSha256 = (value: string) => /^[a-fA-F0-9]{64}$/u.test(value)
  const isIdentity = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value)
  const canWrite = state !== "connecting" && state !== "submitting" && Boolean(session && service)
  const modelValid = isIdentity(modelFamily) && isSha256(architectureDefinitionSha256) && isSha256(sourceCodeSha256) && isIdentity(inputConditionSchemaId) && isIdentity(outputSchemaId) && Number.isSafeInteger(Number(parameterCount)) && Number(parameterCount) > 0
  const planValid = Boolean(modelStructureId) && isIdentity(datasetReleaseIdentity) && isIdentity(splitIdentity) && Number.isSafeInteger(Number(randomSeed)) && Number(randomSeed) >= 0 && Number(randomSeed) <= 2147483647 && /^\d{2,5}x\d{2,5}$/u.test(nativeResolution) && Number.isInteger(Number(epochBudget)) && Number(epochBudget) > 0 && Number(epochBudget) <= 1000000 && isIdentity(parentTerminalRule) && isSha256(optimizerConfigSha256) && isIdentity(resourceProfileIdentity)

  function submitModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modelValid) return
    void submitCommand({ commandType: "register_model_structure", capabilityDomain, modelFamily, architectureDefinitionSha256: architectureDefinitionSha256.toLowerCase(), sourceCodeSha256: sourceCodeSha256.toLowerCase(), inputConditionSchemaId, outputSchemaId, parameterCount: Number(parameterCount), reasonText: "通过本地控制台登记不可变模型结构" })
  }

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planValid) return
    const selectedModel = service?.modelStructures.find((model) => model.modelStructureId === modelStructureId)
    if (!selectedModel) return
    void submitCommand({ commandType: "register_training_plan", capabilityDomain: selectedModel.capabilityDomain, modelStructureId, datasetReleaseIdentity, splitIdentity, randomSeed: Number(randomSeed), nativeResolution, epochBudget: Number(epochBudget), parentTerminalRule, optimizerConfigSha256: optimizerConfigSha256.toLowerCase(), resourceProfileIdentity, reasonText: "通过本地控制台登记非活动训练计划" })
  }

  return (
    <section className={styles.controlExecutionSurface} aria-label="新平台训练设计登记控制">
      <header>
        <div><span>LOCAL TRAINING DESIGN REGISTRY</span><strong>模型结构与训练计划登记</strong></div>
        <small className={canWrite ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "COMMITTING" : service ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>登记修订</span><strong>{service?.registryRevision ?? "—"}</strong></div>
        <div><span>设计记录</span><strong>{service ? `${service.modelStructureCount} MODELS / ${service.trainingPlanCount} PLANS` : "—"}</strong></div>
        <div><span>执行边界</span><code>{service?.executionBoundary ?? "new_ai_console_training_design_registry_only"}</code></div>
      </div>

      <form className={styles.capabilityCandidateForm} onSubmit={submitModel}>
        <div className={styles.controlFormHeading}><span>01 · MODEL STRUCTURE</span><strong>登记不可变模型结构</strong><small>由架构、代码、输入输出Schema和参数量生成内容身份。</small></div>
        <label><span>能力域</span><select aria-label="模型结构能力域" onChange={(event) => setCapabilityDomain(event.target.value)} value={capabilityDomain}><option value="visual_world_generation">AI Painter</option><option value="text_and_language">文字与语言</option><option value="speech_and_audio">语音与音频</option><option value="video_generation">视频</option><option value="multimodal_orchestration">多模态</option></select></label>
        <label><span>模型家族</span><input aria-label="模型家族" maxLength={160} onChange={(event) => setModelFamily(event.target.value)} placeholder="model:family/version" spellCheck={false} value={modelFamily} /></label>
        <label><span>架构定义SHA-256</span><input aria-label="架构定义摘要" maxLength={64} onChange={(event) => setArchitectureDefinitionSha256(event.target.value)} placeholder="64位摘要" spellCheck={false} value={architectureDefinitionSha256} /></label>
        <label><span>源代码SHA-256</span><input aria-label="模型源代码摘要" maxLength={64} onChange={(event) => setSourceCodeSha256(event.target.value)} placeholder="64位摘要" spellCheck={false} value={sourceCodeSha256} /></label>
        <label><span>输入条件Schema</span><input aria-label="输入条件Schema身份" maxLength={160} onChange={(event) => setInputConditionSchemaId(event.target.value)} placeholder="condition:schema/version" spellCheck={false} value={inputConditionSchemaId} /></label>
        <label><span>输出Schema</span><input aria-label="输出Schema身份" maxLength={160} onChange={(event) => setOutputSchemaId(event.target.value)} placeholder="output:schema/version" spellCheck={false} value={outputSchemaId} /></label>
        <label><span>参数量</span><input aria-label="模型参数量" min="1" onChange={(event) => setParameterCount(event.target.value)} step="1" type="number" value={parameterCount} /></label>
        <button disabled={!canWrite || !modelValid} type="submit">登记模型结构</button>
      </form>

      <form className={styles.capabilityCandidateForm} onSubmit={submitPlan}>
        <div className={styles.controlFormHeading}><span>02 · TRAINING PLAN</span><strong>登记非活动训练计划</strong><small>必须绑定同能力域的已登记模型；登记后不会入队或启动。</small></div>
        <label><span>模型结构</span><select aria-label="训练计划模型结构" disabled={!service?.modelStructures.length} onChange={(event) => setModelStructureId(event.target.value)} value={modelStructureId}><option value="">{service?.modelStructures.length ? "选择已登记模型" : "当前无模型结构"}</option>{service?.modelStructures.map((model) => <option key={model.modelStructureId} value={model.modelStructureId}>{model.modelFamily} · {model.capabilityDomain}</option>)}</select></label>
        <label><span>数据发布身份</span><input aria-label="训练计划数据发布身份" maxLength={160} onChange={(event) => setDatasetReleaseIdentity(event.target.value)} placeholder="dataset:release/version" spellCheck={false} value={datasetReleaseIdentity} /></label>
        <label><span>Split身份</span><input aria-label="训练计划Split身份" maxLength={160} onChange={(event) => setSplitIdentity(event.target.value)} placeholder="split:identity/version" spellCheck={false} value={splitIdentity} /></label>
        <label><span>随机种子</span><input aria-label="训练计划随机种子" min="0" onChange={(event) => setRandomSeed(event.target.value)} step="1" type="number" value={randomSeed} /></label>
        <label><span>原生分辨率</span><input aria-label="训练计划原生分辨率" onChange={(event) => setNativeResolution(event.target.value)} pattern="\d{2,5}x\d{2,5}" placeholder="512x512" value={nativeResolution} /></label>
        <label><span>Epoch预算</span><input aria-label="训练计划Epoch预算" min="1" onChange={(event) => setEpochBudget(event.target.value)} step="1" type="number" value={epochBudget} /></label>
        <label><span>父终态规则</span><input aria-label="训练计划父终态规则" maxLength={160} onChange={(event) => setParentTerminalRule(event.target.value)} placeholder="terminal:rule/version" spellCheck={false} value={parentTerminalRule} /></label>
        <label><span>优化器配置SHA-256</span><input aria-label="训练计划优化器配置摘要" maxLength={64} onChange={(event) => setOptimizerConfigSha256(event.target.value)} placeholder="64位摘要" spellCheck={false} value={optimizerConfigSha256} /></label>
        <label><span>资源档案身份</span><input aria-label="训练计划资源档案身份" maxLength={160} onChange={(event) => setResourceProfileIdentity(event.target.value)} placeholder="resource:profile/version" spellCheck={false} value={resourceProfileIdentity} /></label>
        <button disabled={!canWrite || !planValid} type="submit">登记非活动计划</button>
      </form>

      {result?.receipt ? <div className={styles.controlReceipt}>
        <div><span>命令终态</span><strong>{result.receipt.resultTerminalId}</strong><small>{result.replayed ? "IDEMPOTENT REPLAY" : result.receipt.commandType}</small></div>
        <div><span>登记修订</span><strong>{result.receipt.resultingRegistryRevision}</strong><code>{result.storeLogicalPath}</code></div>
        <div><span>命令身份</span><code>{result.receipt.commandId}</code></div>
        <div><span>模型结构身份</span><code>{result.modelStructure?.modelStructureId ?? "—"}</code></div>
        <div><span>训练计划身份</span><code>{result.trainingPlan?.trainingPlanId ?? "—"}</code></div>
        <div><span>事件摘要</span><code>{result.event?.eventRecordSha256 ?? "—"}</code></div>
      </div> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <footer>这里只登记新平台自身的模型结构和非活动训练计划。训练启动、暂停、恢复、停止、资源窗口、Checkpoint、审核、Runtime及旧平台调用全部保持禁用。</footer>
    </section>
  )
}

export function AiConsoleReviewAdjudicationControl() {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<ReviewAdjudicationServiceState | null>(null)
  const [capabilityDomain, setCapabilityDomain] = useState("visual_world_generation")
  const [reviewerIdentity, setReviewerIdentity] = useState("")
  const [reviewerVersion, setReviewerVersion] = useState("")
  const [metricDefinitionId, setMetricDefinitionId] = useState("")
  const [thresholdOperator, setThresholdOperator] = useState<"greater_or_equal" | "less_or_equal">("greater_or_equal")
  const [thresholdValue, setThresholdValue] = useState("0")
  const [thresholdUnit, setThresholdUnit] = useState("")
  const [evidenceRequirementId, setEvidenceRequirementId] = useState("")
  const [failureCode, setFailureCode] = useState("")
  const [previousReviewContractId, setPreviousReviewContractId] = useState("")
  const [reviewContractId, setReviewContractId] = useState("")
  const [reviewRunId, setReviewRunId] = useState("")
  const [validationInputIdentity, setValidationInputIdentity] = useState("")
  const [metricValue, setMetricValue] = useState("0")
  const [affectedScope, setAffectedScope] = useState("")
  const [evidenceTypeId, setEvidenceTypeId] = useState("")
  const [evidenceSha256, setEvidenceSha256] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [result, setResult] = useState<ReviewAdjudicationCommandResponse | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  async function loadService(signal?: AbortSignal) {
    const response = await fetch("/api/ai-console/control/reviews", { cache: "no-store", credentials: "same-origin", signal })
    const payload = await response.json() as ReviewAdjudicationServiceState & { ok?: boolean; errorCode?: string }
    if (!response.ok || payload.ok === false) throw new Error(payload.errorCode ?? "review_adjudication_service_connection_failed")
    setService(payload)
    setReviewContractId((current) => payload.reviewContracts.some((contract) => contract.reviewContractId === current) ? current : payload.reviewContracts[0]?.reviewContractId ?? "")
    return payload
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/reviews", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as ReviewAdjudicationServiceState & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || sessionPayload.ok === false || !serviceResponse.ok || servicePayload.ok === false) throw new Error(sessionPayload.errorCode ?? servicePayload.errorCode ?? "review_adjudication_service_session_failed")
      setSession(sessionPayload)
      setService(servicePayload)
      setReviewContractId(servicePayload.reviewContracts[0]?.reviewContractId ?? "")
      setState("ready")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode(error instanceof Error ? error.message : "review_adjudication_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitCommand(body: Record<string, unknown>) {
    if (!session || !service) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/reviews", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ai-console-csrf": session.csrfToken },
        body: JSON.stringify({ ...body, expectedRegistryRevision: service.registryRevision, idempotencyKey: createIdempotencyKey() }),
      })
      const payload = await response.json() as ReviewAdjudicationCommandResponse
      setResult(payload)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
      await loadService()
    } catch {
      setErrorCode("review_adjudication_command_request_failed")
      setState("failed")
    }
  }

  const isSha256 = (value: string) => /^[a-fA-F0-9]{64}$/u.test(value)
  const isIdentity = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value)
  const finiteThreshold = Number.isFinite(Number(thresholdValue)) && Math.abs(Number(thresholdValue)) <= 1_000_000_000
  const finiteObservation = Number.isFinite(Number(metricValue)) && Math.abs(Number(metricValue)) <= 1_000_000_000
  const contractValid = isIdentity(reviewerIdentity) && isIdentity(reviewerVersion) && isIdentity(metricDefinitionId) && finiteThreshold && isIdentity(thresholdUnit) && isIdentity(evidenceRequirementId) && /^[a-z][a-z0-9_]{2,95}$/u.test(failureCode)
  const selectedContract = service?.reviewContracts.find((contract) => contract.reviewContractId === reviewContractId)
  const observationValid = Boolean(selectedContract) && isIdentity(reviewRunId) && isIdentity(validationInputIdentity) && finiteObservation && isIdentity(affectedScope) && isIdentity(evidenceTypeId) && isSha256(evidenceSha256)
  const canWrite = state !== "connecting" && state !== "submitting" && Boolean(session && service)
  const derivedStatus = !selectedContract || !finiteObservation ? "等待有效合同与观测值" : selectedContract.thresholdOperator === "greater_or_equal" ? Number(metricValue) >= selectedContract.thresholdValue ? "通过" : "失败关闭" : Number(metricValue) <= selectedContract.thresholdValue ? "通过" : "失败关闭"

  function submitContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contractValid) return
    void submitCommand({ commandType: "register_review_contract", capabilityDomain, reviewerIdentity, reviewerVersion, metricDefinitionId, thresholdOperator, thresholdValue: Number(thresholdValue), thresholdUnit, evidenceRequirementId, failureCode, previousReviewContractId: previousReviewContractId || null, reasonText: "通过本地控制台登记冻结机器审核合同" })
  }

  function submitObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!observationValid || !selectedContract) return
    void submitCommand({ commandType: "register_machine_review_observation", reviewContractId, reviewRunId, validationInputIdentity, machineReviewerIdentity: selectedContract.reviewerIdentity, metricValue: Number(metricValue), affectedScope: affectedScope.trim(), evidenceTypeId, evidenceSha256: evidenceSha256.toLowerCase(), reasonText: "通过本地控制台登记机器审核观测并由服务端裁决" })
  }

  return (
    <section className={styles.controlExecutionSurface} aria-label="新平台机器审核合同与结果登记控制">
      <header>
        <div><span>LOCAL REVIEW ADJUDICATION REGISTRY</span><strong>冻结合同与机器审核终态登记</strong></div>
        <small className={canWrite ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "COMMITTING" : service ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>登记修订</span><strong>{service?.registryRevision ?? "—"}</strong></div>
        <div><span>审核记录</span><strong>{service ? `${service.reviewContractCount} CONTRACTS / ${service.reviewResultCount} RESULTS` : "—"}</strong></div>
        <div><span>裁决边界</span><code>{service?.decisionBoundary ?? "server_recomputes_terminal_status_from_frozen_contract"}</code></div>
      </div>

      <form className={styles.capabilityCandidateForm} onSubmit={submitContract}>
        <div className={styles.controlFormHeading}><span>01 · REVIEW CONTRACT</span><strong>登记冻结审核合同</strong><small>合同身份由审核器、指标、阈值、证据要求和前序合同共同确定。</small></div>
        <label><span>能力域</span><select aria-label="审核合同能力域" onChange={(event) => { setCapabilityDomain(event.target.value); setPreviousReviewContractId("") }} value={capabilityDomain}><option value="visual_world_generation">AI Painter</option><option value="text_and_language">文字与语言</option><option value="speech_and_audio">语音与音频</option><option value="video_generation">视频</option><option value="multimodal_orchestration">多模态</option></select></label>
        <label><span>机器审核器</span><input aria-label="机器审核器身份" maxLength={160} onChange={(event) => setReviewerIdentity(event.target.value)} placeholder="reviewer:identity" spellCheck={false} value={reviewerIdentity} /></label>
        <label><span>审核器版本</span><input aria-label="机器审核器版本" maxLength={160} onChange={(event) => setReviewerVersion(event.target.value)} placeholder="reviewer:version/v1" spellCheck={false} value={reviewerVersion} /></label>
        <label><span>指标定义</span><input aria-label="审核指标定义身份" maxLength={160} onChange={(event) => { setMetricDefinitionId(event.target.value); setPreviousReviewContractId("") }} placeholder="metric:definition/v1" spellCheck={false} value={metricDefinitionId} /></label>
        <label><span>阈值方向</span><select aria-label="审核阈值方向" onChange={(event) => setThresholdOperator(event.target.value as "greater_or_equal" | "less_or_equal")} value={thresholdOperator}><option value="greater_or_equal">大于等于通过</option><option value="less_or_equal">小于等于通过</option></select></label>
        <label><span>冻结阈值</span><input aria-label="审核冻结阈值" onChange={(event) => setThresholdValue(event.target.value)} step="any" type="number" value={thresholdValue} /></label>
        <label><span>阈值单位</span><input aria-label="审核阈值单位" maxLength={160} onChange={(event) => setThresholdUnit(event.target.value)} placeholder="unit:score" spellCheck={false} value={thresholdUnit} /></label>
        <label><span>证据要求</span><input aria-label="审核证据要求身份" maxLength={160} onChange={(event) => setEvidenceRequirementId(event.target.value)} placeholder="evidence:requirement/v1" spellCheck={false} value={evidenceRequirementId} /></label>
        <label><span>失败码</span><input aria-label="审核失败码" maxLength={160} onChange={(event) => setFailureCode(event.target.value)} placeholder="review_metric_not_met" spellCheck={false} value={failureCode} /></label>
        <label><span>前序合同</span><select aria-label="前序审核合同身份" onChange={(event) => setPreviousReviewContractId(event.target.value)} value={previousReviewContractId}><option value="">首个合同</option>{service?.reviewContracts.filter((contract) => contract.capabilityDomain === capabilityDomain && contract.metricDefinitionId === metricDefinitionId).map((contract) => <option key={contract.reviewContractId} value={contract.reviewContractId}>{contract.reviewContractId.slice(0, 16)} · {contract.reviewerVersion}</option>)}</select></label>
        <button disabled={!canWrite || !contractValid} type="submit">登记冻结合同</button>
      </form>

      <form className={styles.capabilityCandidateForm} onSubmit={submitObservation}>
        <div className={styles.controlFormHeading}><span>02 · MACHINE OBSERVATION</span><strong>登记观测并计算唯一终态</strong><small>操作员不选择通过或失败；服务端按冻结合同重新计算结果。</small></div>
        <label><span>审核合同</span><select aria-label="机器观测审核合同" disabled={!service?.reviewContracts.length} onChange={(event) => setReviewContractId(event.target.value)} value={reviewContractId}><option value="">{service?.reviewContracts.length ? "选择冻结合同" : "当前无冻结合同"}</option>{service?.reviewContracts.map((contract) => <option key={contract.reviewContractId} value={contract.reviewContractId}>{contract.metricDefinitionId} · {contract.reviewerVersion}</option>)}</select></label>
        <label><span>机器审核器</span><input aria-label="观测机器审核器身份" readOnly value={selectedContract?.reviewerIdentity ?? "由合同锁定"} /></label>
        <label><span>审核运行身份</span><input aria-label="审核运行身份" maxLength={160} onChange={(event) => setReviewRunId(event.target.value)} placeholder="review:run/identity" spellCheck={false} value={reviewRunId} /></label>
        <label><span>验证输入身份</span><input aria-label="验证输入身份" maxLength={160} onChange={(event) => setValidationInputIdentity(event.target.value)} placeholder="validation:input/identity" spellCheck={false} value={validationInputIdentity} /></label>
        <label><span>机器观测值</span><input aria-label="机器审核观测值" onChange={(event) => setMetricValue(event.target.value)} step="any" type="number" value={metricValue} /></label>
        <label><span>服务端预判</span><input aria-label="服务端审核预判" readOnly value={derivedStatus} /></label>
        <label><span>影响范围</span><input aria-label="审核失败影响范围" maxLength={160} onChange={(event) => setAffectedScope(event.target.value)} placeholder="scope:capability/version" spellCheck={false} value={affectedScope} /></label>
        <label><span>证据类型</span><input aria-label="机器审核证据类型" maxLength={160} onChange={(event) => setEvidenceTypeId(event.target.value)} placeholder="evidence:type/v1" spellCheck={false} value={evidenceTypeId} /></label>
        <label><span>证据SHA-256</span><input aria-label="机器审核证据摘要" maxLength={64} onChange={(event) => setEvidenceSha256(event.target.value)} placeholder="64位摘要" spellCheck={false} value={evidenceSha256} /></label>
        <button disabled={!canWrite || !observationValid} type="submit">登记机器审核终态</button>
      </form>

      {result?.receipt ? <div className={styles.controlReceipt}>
        <div><span>命令终态</span><strong>{result.receipt.resultTerminalId}</strong><small>{result.replayed ? "IDEMPOTENT REPLAY" : result.receipt.commandType}</small></div>
        <div><span>登记修订</span><strong>{result.receipt.resultingRegistryRevision}</strong><code>{result.storeLogicalPath}</code></div>
        <div><span>命令身份</span><code>{result.receipt.commandId}</code></div>
        <div><span>合同身份</span><code>{result.reviewContract?.reviewContractId ?? "—"}</code></div>
        <div><span>审核结果</span><strong>{result.reviewResult?.reviewStatus ?? "—"}</strong><code>{result.reviewResult?.reviewResultId ?? "—"}</code></div>
        <div><span>事件摘要</span><code>{result.event?.eventRecordSha256 ?? "—"}</code></div>
      </div> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <footer>这里只登记新平台自己的冻结审核合同与机器观测终态；不启动验证、不重跑审核、不改写结论，也不读取或调用旧平台训练与审核页面。</footer>
    </section>
  )
}

export function AiConsoleRuntimeReleaseControl({ mode }: { mode: "activation" | "runtime" }) {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<RuntimeReleaseServiceState | null>(null)
  const [selectedReleaseIdentity, setSelectedReleaseIdentity] = useState("")
  const [selectedActivationId, setSelectedActivationId] = useState("")
  const [worldId, setWorldId] = useState("")
  const [tick, setTick] = useState("0")
  const [worldFactIdentity, setWorldFactIdentity] = useState("")
  const [conditionPackageIdentity, setConditionPackageIdentity] = useState("")
  const [visualArtifactIdentity, setVisualArtifactIdentity] = useState("")
  const [imageSha256, setImageSha256] = useState("")
  const [frameManifestSha256, setFrameManifestSha256] = useState("")
  const [selectedCandidateIdentity, setSelectedCandidateIdentity] = useState("")
  const [selectedReviewResultId, setSelectedReviewResultId] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [result, setResult] = useState<RuntimeReleaseCommandResponse | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  function synchronizeSelections(payload: RuntimeReleaseServiceState) {
    setSelectedReleaseIdentity((current) => payload.qualifiedReleases.some((release) => release.capabilityReleaseIdentity === current) ? current : payload.qualifiedReleases[0]?.capabilityReleaseIdentity ?? "")
    setSelectedActivationId((current) => payload.activations.some((activation) => activation.activationStatus === "active" && activation.activationId === current) ? current : payload.activations.find((activation) => activation.activationStatus === "active")?.activationId ?? "")
    setSelectedCandidateIdentity((current) => payload.candidates.some((candidate) => candidate.runtimeFrameCandidateIdentity === current) ? current : payload.candidates[0]?.runtimeFrameCandidateIdentity ?? "")
  }

  async function loadService(signal?: AbortSignal) {
    const response = await fetch("/api/ai-console/control/runtime", { cache: "no-store", credentials: "same-origin", signal })
    const payload = await response.json() as RuntimeReleaseServiceState & { ok?: boolean; errorCode?: string }
    if (!response.ok || payload.ok === false) throw new Error(payload.errorCode ?? "runtime_release_service_connection_failed")
    setService(payload)
    synchronizeSelections(payload)
    return payload
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/runtime", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as RuntimeReleaseServiceState & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || sessionPayload.ok === false || !serviceResponse.ok || servicePayload.ok === false) throw new Error(sessionPayload.errorCode ?? servicePayload.errorCode ?? "runtime_release_service_session_failed")
      setSession(sessionPayload)
      setService(servicePayload)
      synchronizeSelections(servicePayload)
      setState("ready")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode(error instanceof Error ? error.message : "runtime_release_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitCommand(body: Record<string, unknown>) {
    if (!session || !service) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/runtime", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ai-console-csrf": session.csrfToken },
        body: JSON.stringify({ ...body, expectedRegistryRevision: service.registryRevision, idempotencyKey: createIdempotencyKey() }),
      })
      const payload = await response.json() as RuntimeReleaseCommandResponse
      setResult(payload)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
      await loadService()
    } catch {
      setErrorCode("runtime_release_command_request_failed")
      setState("failed")
    }
  }

  const isIdentity = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/u.test(value)
  const isSha256 = (value: string) => /^[a-fA-F0-9]{64}$/u.test(value)
  const selectedRelease = service?.qualifiedReleases.find((release) => release.capabilityReleaseIdentity === selectedReleaseIdentity)
  const currentActivation = service?.activations.find((activation) => activation.activationStatus === "active" && activation.capabilityDomain === selectedRelease?.capabilityDomain)
  const activeActivations = service?.activations.filter((activation) => activation.activationStatus === "active") ?? []
  const selectedActivation = activeActivations.find((activation) => activation.activationId === selectedActivationId)
  const selectedCandidate = service?.candidates.find((candidate) => candidate.runtimeFrameCandidateIdentity === selectedCandidateIdentity)
  const eligibleReviewResults = service?.reviewResults.filter((review) => review.reviewStatus === "passed" && review.validationInputIdentity === selectedCandidateIdentity && review.capabilityDomain === selectedCandidate?.capabilityDomain) ?? []
  const selectedReviewResult = eligibleReviewResults.find((review) => review.reviewResultId === selectedReviewResultId)
  const previousRuntimeFrame = selectedCandidate ? [...(service?.publications ?? [])].reverse().find((publication) => publication.worldId === selectedCandidate.worldId) : undefined
  const canWrite = state !== "connecting" && state !== "submitting" && Boolean(session && service)
  const candidateValid = Boolean(selectedActivation) && [worldId, worldFactIdentity, conditionPackageIdentity, visualArtifactIdentity].every(isIdentity) && Number.isSafeInteger(Number(tick)) && Number(tick) >= 0 && isSha256(imageSha256) && isSha256(frameManifestSha256)

  function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRelease) return
    void submitCommand({ commandType: "activate_qualified_release", capabilityReleaseIdentity: selectedRelease.capabilityReleaseIdentity, expectedPreviousActivationId: currentActivation?.activationId ?? null, reasonText: "通过本地控制台激活完整资格能力发布" })
  }

  function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedActivation || !candidateValid) return
    void submitCommand({ commandType: "register_runtime_frame_candidate", activationId: selectedActivation.activationId, worldId, tick: Number(tick), worldFactIdentity, conditionPackageIdentity, visualArtifactIdentity, imageSha256: imageSha256.toLowerCase(), frameManifestSha256: frameManifestSha256.toLowerCase(), reasonText: "通过本地控制台登记RuntimeFrame审核候选" })
  }

  function submitPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCandidate || !selectedReviewResult) return
    void submitCommand({ commandType: "publish_reviewed_runtime_frame", runtimeFrameCandidateIdentity: selectedCandidate.runtimeFrameCandidateIdentity, reviewResultId: selectedReviewResult.reviewResultId, expectedPreviousRuntimeFrameIdentity: previousRuntimeFrame?.runtimeFrameIdentity ?? null, reasonText: "通过本地控制台登记机器审核通过的正式RuntimeFrame" })
  }

  return (
    <section className={styles.controlExecutionSurface} aria-label={mode === "activation" ? "新平台能力发布激活控制" : "新平台RuntimeFrame登记控制"}>
      <header>
        <div><span>LOCAL RUNTIME RELEASE REGISTRY</span><strong>{mode === "activation" ? "合格能力发布激活" : "RuntimeFrame候选与正式发布"}</strong></div>
        <small className={canWrite ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "COMMITTING" : service ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>登记修订</span><strong>{service?.registryRevision ?? "—"}</strong></div>
        <div><span>激活 / 候选 / 正式Frame</span><strong>{service ? `${service.activationCount} / ${service.candidateCount} / ${service.publicationCount}` : "—"}</strong></div>
        <div><span>执行边界</span><code>{service?.executionBoundary ?? "new_ai_console_runtime_release_registry_only"}</code></div>
      </div>

      {mode === "activation" ? (
        <form className={styles.capabilityCandidateForm} onSubmit={submitActivation}>
          <div className={styles.controlFormHeading}><span>04 · ACTIVATE</span><strong>激活完整资格发布</strong><small>服务端重新复核资格链与当前能力域前序激活。</small></div>
          <label><span>合格发布</span><select aria-label="选择合格能力发布" disabled={!service?.qualifiedReleases.length} onChange={(event) => setSelectedReleaseIdentity(event.target.value)} value={selectedReleaseIdentity}><option value="">{service?.qualifiedReleases.length ? "选择发布" : "当前无合格发布"}</option>{service?.qualifiedReleases.map((release) => <option key={release.capabilityReleaseIdentity} value={release.capabilityReleaseIdentity}>{release.capabilityDomain} · {release.capabilityVersionId.slice(0, 12)} · {release.releaseStatus}</option>)}</select></label>
          <label><span>前序激活</span><input aria-label="当前能力域前序激活" readOnly value={currentActivation?.activationId ?? "首个激活"} /></label>
          <button disabled={!canWrite || !selectedRelease || selectedRelease.releaseStatus === "active"} type="submit">原子激活发布</button>
        </form>
      ) : (
        <>
          <form className={styles.capabilityCandidateForm} onSubmit={submitCandidate}>
            <div className={styles.controlFormHeading}><span>01 · FRAME CANDIDATE</span><strong>登记待审核RuntimeFrame候选</strong><small>只登记现有视觉制品身份与摘要，不生成图片、不启动推理。</small></div>
            <label><span>当前能力激活</span><select aria-label="选择当前能力激活" disabled={!activeActivations.length} onChange={(event) => setSelectedActivationId(event.target.value)} value={selectedActivationId}><option value="">{activeActivations.length ? "选择当前激活" : "当前无激活发布"}</option>{activeActivations.map((activation) => <option key={activation.activationId} value={activation.activationId}>{activation.capabilityDomain} · {activation.capabilityReleaseIdentity.slice(0, 12)}</option>)}</select></label>
            <label><span>世界身份</span><input aria-label="Frame候选世界身份" maxLength={160} onChange={(event) => setWorldId(event.target.value)} placeholder="world:identity" spellCheck={false} value={worldId} /></label>
            <label><span>世界Tick</span><input aria-label="Frame候选世界Tick" min="0" onChange={(event) => setTick(event.target.value)} step="1" type="number" value={tick} /></label>
            <label><span>世界事实身份</span><input aria-label="Frame候选世界事实身份" maxLength={160} onChange={(event) => setWorldFactIdentity(event.target.value)} placeholder="worldfact:identity" spellCheck={false} value={worldFactIdentity} /></label>
            <label><span>条件包身份</span><input aria-label="Frame候选条件包身份" maxLength={160} onChange={(event) => setConditionPackageIdentity(event.target.value)} placeholder="condition:package/identity" spellCheck={false} value={conditionPackageIdentity} /></label>
            <label><span>视觉制品身份</span><input aria-label="Frame候选视觉制品身份" maxLength={160} onChange={(event) => setVisualArtifactIdentity(event.target.value)} placeholder="artifact:visual/identity" spellCheck={false} value={visualArtifactIdentity} /></label>
            <label><span>图像SHA-256</span><input aria-label="Frame候选图像摘要" maxLength={64} onChange={(event) => setImageSha256(event.target.value)} placeholder="64位摘要" spellCheck={false} value={imageSha256} /></label>
            <label><span>Frame清单SHA-256</span><input aria-label="Frame候选清单摘要" maxLength={64} onChange={(event) => setFrameManifestSha256(event.target.value)} placeholder="64位摘要" spellCheck={false} value={frameManifestSha256} /></label>
            <button disabled={!canWrite || !candidateValid} type="submit">登记审核候选</button>
          </form>

          <form className={styles.capabilityCandidateForm} onSubmit={submitPublication}>
            <div className={styles.controlFormHeading}><span>02 · FORMAL FRAME</span><strong>登记机器审核通过的正式Frame</strong><small>正式状态为未消费；本命令不会写入或替换当前世界。</small></div>
            <label><span>Frame候选</span><select aria-label="选择RuntimeFrame候选" disabled={!service?.candidates.length} onChange={(event) => { setSelectedCandidateIdentity(event.target.value); setSelectedReviewResultId("") }} value={selectedCandidateIdentity}><option value="">{service?.candidates.length ? "选择候选" : "当前无Frame候选"}</option>{service?.candidates.map((candidate) => <option key={candidate.runtimeFrameCandidateIdentity} value={candidate.runtimeFrameCandidateIdentity}>{candidate.worldId} · T{candidate.tick} · {candidate.runtimeFrameCandidateIdentity.slice(0, 12)}</option>)}</select></label>
            <label><span>通过的审核结果</span><select aria-label="选择通过的机器审核结果" disabled={!eligibleReviewResults.length} onChange={(event) => setSelectedReviewResultId(event.target.value)} value={selectedReviewResultId}><option value="">{eligibleReviewResults.length ? "选择审核结果" : "当前候选无通过结果"}</option>{eligibleReviewResults.map((review) => <option key={review.reviewResultId} value={review.reviewResultId}>{review.reviewResultId.slice(0, 16)} · PASSED</option>)}</select></label>
            <label><span>前序正式Frame</span><input aria-label="同一世界前序正式Frame" readOnly value={previousRuntimeFrame?.runtimeFrameIdentity ?? "首个正式Frame"} /></label>
            <button disabled={!canWrite || !selectedCandidate || !selectedReviewResult} type="submit">登记正式未消费Frame</button>
          </form>
        </>
      )}

      {result?.receipt ? <div className={styles.controlReceipt}>
        <div><span>命令终态</span><strong>{result.receipt.resultTerminalId}</strong><small>{result.replayed ? "IDEMPOTENT REPLAY" : result.receipt.commandType}</small></div>
        <div><span>登记修订</span><strong>{result.receipt.resultingRegistryRevision}</strong><code>{result.storeLogicalPath}</code></div>
        <div><span>命令身份</span><code>{result.receipt.commandId}</code></div>
        <div><span>激活身份</span><code>{result.activation?.activationId ?? "—"}</code></div>
        <div><span>Frame候选</span><code>{result.candidate?.runtimeFrameCandidateIdentity ?? "—"}</code></div>
        <div><span>正式Frame</span><code>{result.publication?.runtimeFrameIdentity ?? "—"}</code></div>
      </div> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <footer>{mode === "activation" ? "这里只激活新平台自身已完整资格并登记的发布；不会启动训练、验证、审核或旧平台功能。" : "这里只登记新平台RuntimeFrame候选和机器审核通过后的正式未消费Frame；不会生成图片、进入世界或调用旧平台页面。"}</footer>
    </section>
  )
}

type WorldControlState = {
  worldStateRevisionId: string
  worldId: string
  worldRevision: number
  activeRuntimeFrameIdentity: string
  activeFrameTick: number
  publishControlStatus: "publishing" | "paused"
  visualUpdateStatus: "enabled" | "frozen"
  transitionType: string
}

type WorldControlServiceState = {
  serviceStatus: "ready"
  executorIdentity: string
  executionBoundary: "new_ai_console_only"
  registryRevision: number
  worldCount: number
  worldStateCount: number
  commandCount: number
  eventCount: number
  currentWorldStates: readonly WorldControlState[]
  stateHistory: readonly WorldControlState[]
  publications: readonly {
    publishIdentity: string
    runtimeFrameIdentity: string
    previousRuntimeFrameIdentity: string | null
    worldId: string
    tick: number
    runtimeFrameStatus: string
  }[]
}

type WorldControlCommandResponse = {
  ok?: boolean
  replayed?: boolean
  integrityStatus?: string
  storeLogicalPath?: string
  receipt?: {
    commandId: string
    commandType: string
    resultTerminalId: string
    resultingRegistryRevision: number
    resultingWorldRevision: number | null
    failureCode: string | null
  }
  worldState?: WorldControlState | null
  errorCode?: string
}

export function AiConsoleWorldControl() {
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [service, setService] = useState<WorldControlServiceState | null>(null)
  const [selectedPublicationIdentity, setSelectedPublicationIdentity] = useState("")
  const [selectedWorldId, setSelectedWorldId] = useState("")
  const [rollbackTargetIdentity, setRollbackTargetIdentity] = useState("")
  const [state, setState] = useState<"connecting" | "ready" | "submitting" | "succeeded" | "rejected" | "failed">("connecting")
  const [result, setResult] = useState<WorldControlCommandResponse | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  function synchronizeSelections(payload: WorldControlServiceState) {
    const consumable = payload.publications.filter((publication) => publication.runtimeFrameStatus === "registered_formal_unconsumed")
    setSelectedPublicationIdentity((current) => consumable.some((publication) => publication.runtimeFrameIdentity === current) ? current : consumable[0]?.runtimeFrameIdentity ?? "")
    setSelectedWorldId((current) => payload.currentWorldStates.some((world) => world.worldId === current) ? current : payload.currentWorldStates[0]?.worldId ?? "")
  }

  async function loadService(signal?: AbortSignal) {
    const response = await fetch("/api/ai-console/control/world", { cache: "no-store", credentials: "same-origin", signal })
    const payload = await response.json() as WorldControlServiceState & { ok?: boolean; errorCode?: string }
    if (!response.ok || payload.ok === false) throw new Error(payload.errorCode ?? "world_control_service_connection_failed")
    setService(payload)
    synchronizeSelections(payload)
    return payload
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch("/api/ai-console/control/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
      fetch("/api/ai-console/control/world", { cache: "no-store", credentials: "same-origin", signal: controller.signal }),
    ]).then(async ([sessionResponse, serviceResponse]) => {
      const sessionPayload = await sessionResponse.json() as OperatorSession & { ok?: boolean; errorCode?: string }
      const servicePayload = await serviceResponse.json() as WorldControlServiceState & { ok?: boolean; errorCode?: string }
      if (!sessionResponse.ok || sessionPayload.ok === false || !serviceResponse.ok || servicePayload.ok === false) throw new Error(sessionPayload.errorCode ?? servicePayload.errorCode ?? "world_control_service_session_failed")
      setSession(sessionPayload)
      setService(servicePayload)
      synchronizeSelections(servicePayload)
      setState("ready")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setErrorCode(error instanceof Error ? error.message : "world_control_service_connection_failed")
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [])

  async function submitCommand(body: Record<string, unknown>, expectedWorldRevision: number) {
    if (!session || !service) return
    setState("submitting")
    setErrorCode(null)
    try {
      const response = await fetch("/api/ai-console/control/world", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ai-console-csrf": session.csrfToken },
        body: JSON.stringify({ ...body, expectedRegistryRevision: service.registryRevision, expectedWorldRevision, idempotencyKey: createIdempotencyKey() }),
      })
      const payload = await response.json() as WorldControlCommandResponse
      setResult(payload)
      setErrorCode(payload.errorCode ?? payload.receipt?.failureCode ?? null)
      setState(response.ok ? "succeeded" : response.status === 409 ? "rejected" : "failed")
      await loadService()
    } catch {
      setErrorCode("world_control_command_request_failed")
      setState("failed")
    }
  }

  const consumablePublications = service?.publications.filter((publication) => publication.runtimeFrameStatus === "registered_formal_unconsumed") ?? []
  const selectedPublication = consumablePublications.find((publication) => publication.runtimeFrameIdentity === selectedPublicationIdentity)
  const selectedWorld = service?.currentWorldStates.find((world) => world.worldId === selectedWorldId)
  const rollbackTargets = selectedWorld ? service?.publications.filter((publication) => publication.worldId === selectedWorld.worldId && publication.runtimeFrameIdentity !== selectedWorld.activeRuntimeFrameIdentity && publication.tick < selectedWorld.activeFrameTick) ?? [] : []
  const selectedRollbackTarget = rollbackTargets.find((publication) => publication.runtimeFrameIdentity === rollbackTargetIdentity)
  const canWrite = state !== "connecting" && state !== "submitting" && Boolean(session && service)

  return (
    <section className={styles.controlExecutionSurface} aria-label="新平台世界控制登记">
      <header>
        <div><span>LOCAL WORLD CONTROL REGISTRY</span><strong>Frame消费与世界控制登记</strong></div>
        <small className={canWrite ? styles.controlServiceReady : styles.controlServicePending}>{state === "connecting" ? "CONNECTING" : state === "submitting" ? "COMMITTING" : service ? "READY" : "FAILED CLOSED"}</small>
      </header>
      <div className={styles.controlExecutionFacts}>
        <div><span>执行器</span><code>{service?.executorIdentity ?? "—"}</code></div>
        <div><span>登记修订</span><strong>{service?.registryRevision ?? "—"}</strong></div>
        <div><span>世界 / 状态 / 命令</span><strong>{service ? `${service.worldCount} / ${service.worldStateCount} / ${service.commandCount}` : "—"}</strong></div>
        <div><span>执行边界</span><code>{service?.executionBoundary ?? "new_ai_console_only"}</code></div>
      </div>

      <form className={styles.capabilityCandidateForm} onSubmit={(event) => { event.preventDefault(); if (selectedPublication) void submitCommand({ commandType: "consume_registered_runtime_frame", runtimeFrameIdentity: selectedPublication.runtimeFrameIdentity, reasonText: "消费新控制台已登记的正式RuntimeFrame" }, service?.currentWorldStates.find((world) => world.worldId === selectedPublication.worldId)?.worldRevision ?? 0) }}>
        <div className={styles.controlFormHeading}><span>03 · CONSUME</span><strong>消费正式RuntimeFrame</strong><small>只接受新平台V15正式未消费Frame，并严格校验同一世界前序链。</small></div>
        <label><span>正式未消费Frame</span><select aria-label="选择待消费RuntimeFrame" disabled={!consumablePublications.length} onChange={(event) => setSelectedPublicationIdentity(event.target.value)} value={selectedPublicationIdentity}><option value="">{consumablePublications.length ? "选择正式Frame" : "当前无正式未消费Frame"}</option>{consumablePublications.map((publication) => <option key={publication.runtimeFrameIdentity} value={publication.runtimeFrameIdentity}>{publication.worldId} · T{publication.tick} · {publication.runtimeFrameIdentity.slice(0, 12)}</option>)}</select></label>
        <label><span>前序Frame</span><input readOnly value={selectedPublication?.previousRuntimeFrameIdentity ?? "首个Frame"} /></label>
        <button disabled={!canWrite || !selectedPublication} type="submit">登记Frame消费</button>
      </form>

      <form className={styles.capabilityCandidateForm} onSubmit={(event) => event.preventDefault()}>
        <div className={styles.controlFormHeading}><span>04 · WORLD CONTROL</span><strong>发布、回退与视觉控制</strong><small>所有操作只新增新平台控制修订；不写游戏世界、不改WorldFacts、不调用旧页面。</small></div>
        <label><span>已登记世界</span><select aria-label="选择世界控制状态" disabled={!service?.currentWorldStates.length} onChange={(event) => { setSelectedWorldId(event.target.value); setRollbackTargetIdentity("") }} value={selectedWorldId}><option value="">{service?.currentWorldStates.length ? "选择世界" : "消费Frame后建立世界状态"}</option>{service?.currentWorldStates.map((world) => <option key={world.worldStateRevisionId} value={world.worldId}>{world.worldId} · R{world.worldRevision} · {world.publishControlStatus}</option>)}</select></label>
        <label><span>合法回退目标</span><select aria-label="选择合法回退Frame" disabled={!rollbackTargets.length} onChange={(event) => setRollbackTargetIdentity(event.target.value)} value={rollbackTargetIdentity}><option value="">{rollbackTargets.length ? "选择祖先Frame" : "当前无合法祖先Frame"}</option>{rollbackTargets.map((publication) => <option key={publication.runtimeFrameIdentity} value={publication.runtimeFrameIdentity}>T{publication.tick} · {publication.runtimeFrameIdentity.slice(0, 16)}</option>)}</select></label>
        <div className={styles.taskRegistryActions}>
          <button disabled={!canWrite || !selectedWorld || selectedWorld.publishControlStatus === "paused"} onClick={() => selectedWorld && void submitCommand({ commandType: "pause_frame_publish", worldId: selectedWorld.worldId, reasonText: "暂停新控制台Frame发布控制" }, selectedWorld.worldRevision)} type="button">暂停发布</button>
          <button disabled={!canWrite || !selectedWorld || selectedWorld.publishControlStatus !== "paused"} onClick={() => selectedWorld && void submitCommand({ commandType: "resume_frame_publish", worldId: selectedWorld.worldId, reasonText: "恢复新控制台Frame发布控制" }, selectedWorld.worldRevision)} type="button">恢复发布</button>
          <button className={styles.controlSecondaryAction} disabled={!canWrite || !selectedWorld || selectedWorld.publishControlStatus !== "paused" || !selectedRollbackTarget} onClick={() => selectedWorld && selectedRollbackTarget && void submitCommand({ commandType: "rollback_runtime_frame", worldId: selectedWorld.worldId, targetRuntimeFrameIdentity: selectedRollbackTarget.runtimeFrameIdentity, reasonText: "回退到新控制台已登记的祖先RuntimeFrame" }, selectedWorld.worldRevision)} type="button">登记合法回退</button>
          <button className={styles.controlSecondaryAction} disabled={!canWrite || !selectedWorld || selectedWorld.visualUpdateStatus === "frozen"} onClick={() => selectedWorld && void submitCommand({ commandType: "freeze_visual_updates", worldId: selectedWorld.worldId, reasonText: "冻结新控制台视觉更新登记" }, selectedWorld.worldRevision)} type="button">冻结视觉更新</button>
        </div>
      </form>

      {result?.receipt ? <div className={styles.controlReceipt}>
        <div><span>命令终态</span><strong>{result.receipt.resultTerminalId}</strong><small>{result.replayed ? "IDEMPOTENT REPLAY" : result.receipt.commandType}</small></div>
        <div><span>登记修订</span><strong>{result.receipt.resultingRegistryRevision}</strong><code>{result.storeLogicalPath}</code></div>
        <div><span>世界修订</span><strong>{result.receipt.resultingWorldRevision ?? "—"}</strong><code>{result.worldState?.worldStateRevisionId ?? "—"}</code></div>
        <div><span>命令身份</span><code>{result.receipt.commandId}</code></div>
      </div> : null}
      {errorCode ? <p className={styles.controlExecutionError}><span>FAILURE CODE</span><code>{errorCode}</code></p> : null}
      <footer>NEW AI CONSOLE ONLY · 该控制面不读取或写入旧训练监控、旧世界Runtime与WorldFacts。</footer>
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
