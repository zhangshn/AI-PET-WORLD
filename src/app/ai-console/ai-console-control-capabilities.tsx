"use client"

import { useEffect, useState, type FormEvent } from "react"
import styles from "./ai-console-workspace.module.css"
import type { OperatorSession, CapabilityServiceState, CapabilityCommandResponse } from "./ai-console-control-types"
import { createIdempotencyKey } from "./ai-console-control-common"

const qualificationGates = ["cpu_contract", "readonly_gpu", "controlled_smoke", "formal_stage", "independent_regression", "machine_release_adjudication"] as const

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
