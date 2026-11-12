"use client"

import { useEffect, useState, type FormEvent } from "react"
import styles from "./ai-console-workspace.module.css"
import type { OperatorSession, TaskServiceState, TaskCommandResponse } from "./ai-console-control-types"
import { createIdempotencyKey } from "./ai-console-control-common"

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
