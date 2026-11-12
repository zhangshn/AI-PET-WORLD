"use client"

import { useEffect, useState } from "react"
import styles from "./ai-console-workspace.module.css"
import type { OperatorSession, WorldControlServiceState, WorldControlCommandResponse } from "./ai-console-control-types"
import { createIdempotencyKey } from "./ai-console-control-common"

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
