"use client"

import { useEffect, useState, type FormEvent } from "react"
import styles from "./ai-console-workspace.module.css"
import type { OperatorSession, ReviewAdjudicationServiceState, ReviewAdjudicationCommandResponse } from "./ai-console-control-types"
import { createIdempotencyKey } from "./ai-console-control-common"

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
