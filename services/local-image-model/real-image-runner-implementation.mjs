// 当前文件作用：定义 AI-PET-WORLD 自研真实图像生成 runner implementation 入口；真实推理未接入前不生成图片、不返回假图。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
} from "./contracts.mjs"
import { buildRealImageExecutionContract } from "./real-image-execution-contract.mjs"
import { buildRealImageExecutorStdinPayload } from "./real-image-execution-payload.mjs"
import {
  executeRealImageWithExecutorShell,
  readRealImageExecutorShellHealth,
  runRealImageExecutorShellDryRun,
} from "./real-image-executor-shell.mjs"

const RUNNER_IMPLEMENTATION_NAME =
  "ai-pet-world-real-image-runner-implementation"
const RUNNER_IMPLEMENTATION_VERSION = "implementation-payload-connected-1"

export function readRealImageRunnerImplementationHealth(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const executionContract = buildRealImageExecutionContract({
    requiredResponseFields,
  })
  const executorStdinPayload = buildImplementationExecutorStdinPayload({
    ...input,
    requiredResponseFields,
    executionContract,
  })
  const executorShell = readRealImageExecutorShellHealth({
    enabled: input.enabled,
    command: input.command,
    argsJson: input.argsJson,
    timeoutMs: input.timeoutMs,
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_runner_implementation_payload_ready_not_connected",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    executorStdinPayloadConnected: true,
    canRunInference: false,
    canGenerateRealBitmap: false,
    canWriteOutputFile: false,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    executorStdinPayload,
    executorShell,
    message:
      "真实 runner implementation 已接入 executor stdin payload，但尚未接入命令执行结果转换逻辑。当前不能生成可进入正式链路的图片结果，也不会返回假图。",
    messageEn:
      "The real runner implementation is connected to the executor stdin payload, but execution result mapping is not connected yet. It cannot produce a formal-chain image result and will not return fake images.",
    nextStep: {
      zh: "下一步会把 executor shell 的真实执行结果转换成 local image model 的 6 字段响应，然后才能进入隐藏 AiImageCandidate。",
      en: "Next map the executor shell real execution result into the local image model six-field response before it may enter a hidden AiImageCandidate.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "implementation_payload_connected",
      "runner_implementation_not_connected",
      "executor_stdin_payload_ready",
      "execution_contract_ready",
      ...executorStdinPayload.tags,
      ...executorShell.tags,
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function runRealImageRunnerImplementationDryRun(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const executionContract = buildRealImageExecutionContract({
    requiredResponseFields,
  })
  const executorStdinPayload = buildImplementationExecutorStdinPayload({
    ...input,
    requiredResponseFields,
    executionContract,
  })
  const executorShell = await runRealImageExecutorShellDryRun({
    enabled: input.enabled,
    command: input.command,
    argsJson: input.argsJson,
    timeoutMs: input.timeoutMs,
    requiredResponseFields,
  })

  return {
    ok: false,
    status: "real_image_runner_implementation_payload_ready_not_connected",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    executorStdinPayloadConnected: true,
    canRunInference: false,
    canGenerateRealBitmap: false,
    canWriteOutputFile: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    executorStdinPayload,
    executorShell,
    willReturnImageUrl: false,
    willReturnImageFormat: false,
    willReturnWidth: false,
    willReturnHeight: false,
    willReturnLicense: false,
    willReturnOriginalityConfirmed: false,
    willWriteOutputFile: false,
    willExecuteCommand: false,
    willPersistOnlyAsHiddenCandidate: false,
    message:
      "真实 runner implementation dry-run 已能构建 executor stdin payload，并能读取 executor shell child_process 配置，但尚未把执行结果转换成正式模型响应。",
    messageEn:
      "The real runner implementation dry-run can build the executor stdin payload and read executor shell child_process configuration, but it has not mapped execution results into the formal model response yet.",
    nextStep: {
      zh: "接入真实结果转换后，dry-run 才能声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting real result mapping, dry-run may declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "implementation_payload_connected",
      "runner_implementation_not_connected",
      "executor_stdin_payload_ready",
      "execution_contract_ready",
      ...executorStdinPayload.tags,
      ...executorShell.tags,
      "dry_run_blocked",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

export async function generateRealImageWithRunnerImplementation(input = {}) {
  const requiredResponseFields = readRequiredResponseFields(input)
  const executionContract = buildRealImageExecutionContract({
    requiredResponseFields,
  })
  const executorStdinPayload = buildImplementationExecutorStdinPayload({
    ...input,
    requiredResponseFields,
    executionContract,
  })
  const executorShell = await executeRealImageWithExecutorShell({
    enabled: input.enabled,
    command: input.command,
    argsJson: input.argsJson,
    timeoutMs: input.timeoutMs,
    outputStorage: input.outputStorage,
    requiredResponseFields,
    executorStdinPayload:
      executorStdinPayload.ok === true ? executorStdinPayload.payload : null,
  })

  return {
    ok: false,
    status: "real_image_runner_implementation_payload_ready_not_connected",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: false,
    executorStdinPayloadConnected: true,
    canRunInference: false,
    canGenerateRealBitmap: false,
    canWriteOutputFile: false,
    ...(input.requestAudit ?? {}),
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    executorStdinPayload,
    executorShell,
    message:
      "真实 runner implementation 已调用 executor shell 边界，但尚未把 shell 执行结果转换为正式 6 字段模型响应。不会直接返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real runner implementation has called the executor shell boundary, but it has not mapped shell execution results into the formal six-field model response yet. It will not directly return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实结果转换：只有 executorShell.ok=true 时，才把 imageUrl / imageFormat / width / height / license / originalityConfirmed 传回 provider。",
      en: "Next connect real result mapping: only when executorShell.ok=true may imageUrl / imageFormat / width / height / license / originalityConfirmed be returned to the provider.",
    },
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "implementation_payload_connected",
      "runner_implementation_not_connected",
      "executor_stdin_payload_ready",
      "execution_contract_ready",
      ...executorStdinPayload.tags,
      ...executorShell.tags,
      "generate_blocked",
      "fake_image_forbidden",
      "not_player_visible",
    ],
  }
}

function buildImplementationExecutorStdinPayload(input = {}) {
  return buildRealImageExecutorStdinPayload({
    requestId:
      input.requestId ??
      input.requestAudit?.requestId ??
      input.requestBody?.requestId,
    requestBody: input.requestBody,
    readiness: input.readiness ?? input.realModelReadiness,
    outputStorage: input.outputStorage,
    outputFileName: input.outputFileName ?? input.requestBody?.outputFileName,
    manifest:
      input.manifest ??
      input.readiness?.manifest ??
      input.realModelReadiness?.manifest ??
      input.requestBody?.manifest,
    modelTask: input.modelTask ?? input.requestBody?.modelTask,
    promptPackage: input.promptPackage ?? input.requestBody?.promptPackage,
    responseContract:
      input.responseContract ?? input.requestBody?.responseContract,
    executionContract: input.executionContract,
    controlSketch: input.controlSketch ?? input.requestBody?.controlSketch,
    visualFixHints: input.visualFixHints ?? input.requestBody?.visualFixHints,
    worldFactMetadata:
      input.worldFactMetadata ??
      input.requestBody?.worldFactMetadata ??
      input.requestBody?.metadata,
    audit: {
      ...(input.audit ?? {}),
      ...(input.requestAudit ?? {}),
      node: "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-15",
    },
    constraints: input.constraints,
    requiredResponseFields: input.requiredResponseFields,
    timeoutMs: input.timeoutMs,
  })
}

function buildImplementationInputContract(requiredResponseFields) {
  return {
    mustReceiveReadinessGate: true,
    mustReceiveOutputStorage: true,
    mustReceiveModelTask: true,
    mustReceivePromptPackage: true,
    mustReceiveControlSketch: true,
    mustReceiveResponseContract: true,
    mustReceiveVisualFixHints: true,
    mustReceiveWorldFactMetadata: true,
    mustBuildExecutorStdinPayload: true,
    mustUseExecutionContract: true,
    mustUseExecutorShell: true,
    mustNotRewriteWorldFacts: true,
    mustNotDisplayDirectly: true,
    mustNotCopyUnlicensedThirdPartyWorks: true,
    requiredResponseFields,
  }
}

function buildImplementationOutputContract(requiredResponseFields) {
  return {
    requiredFields: requiredResponseFields,
    allowedImageFormats: ALLOWED_IMAGE_FORMATS,
    allowedLicenses: ALLOWED_LICENSES,
    minimumWidth: MINIMUM_IMAGE_WIDTH,
    minimumHeight: MINIMUM_IMAGE_HEIGHT,
    mustReturnBitmap: true,
    mustWriteFileUnderOutputStorage: true,
    mustReturnPublicHttpUrl: true,
    mustNotReturnLocalFilePath: true,
    mustNotReturnFileUrl: true,
    mustNotReturnSvg: true,
    mustNotReturnHtml: true,
    mustNotReturnJsonDebugImage: true,
    mustNotReturnPlaceholder: true,
    mustNotReturnProgrammaticRenderer: true,
    mustPersistOnlyAsHiddenCandidate: true,
    mustPassVisualJudge: true,
    canShowToPlayer: false,
  }
}

function readRequiredResponseFields(input = {}) {
  return Array.isArray(input.requiredResponseFields) &&
    input.requiredResponseFields.length > 0
    ? input.requiredResponseFields
    : REQUIRED_RESPONSE_FIELDS
}