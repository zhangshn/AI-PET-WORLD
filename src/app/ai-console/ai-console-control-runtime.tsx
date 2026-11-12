"use client"

import { useEffect, useState, type FormEvent } from "react"
import styles from "./ai-console-workspace.module.css"
import type { OperatorSession, RuntimeReleaseServiceState, RuntimeReleaseCommandResponse } from "./ai-console-control-types"
import { createIdempotencyKey } from "./ai-console-control-common"

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
