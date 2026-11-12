"use client"

import { useEffect, useState, type FormEvent } from "react"
import styles from "./ai-console-workspace.module.css"
import type { OperatorSession, TrainingDesignServiceState, TrainingDesignCommandResponse } from "./ai-console-control-types"
import { createIdempotencyKey } from "./ai-console-control-common"

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
