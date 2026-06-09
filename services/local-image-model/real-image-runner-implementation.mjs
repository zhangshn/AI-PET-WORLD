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
      "真实 runner implementation 已接入 executor stdin payload，但尚未接入命令执行逻辑。当前不能生成图片，也不会返回假图。",
    messageEn:
      "The real runner implementation is connected to the executor stdin payload, but command execution logic is not connected yet. It cannot generate images and will not return fake images.",
    nextStep: {
      zh: "下一步才接入真实命令执行：将 executorStdinPayload.payload 通过 stdin 发送给自研推理脚本，读取 stdout JSON，并经过 execution contract 校验。",
      en: "Next connect real command execution: send executorStdinPayload.payload to the in-house inference script through stdin, read stdout JSON, and validate it through the execution contract.",
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
      "does_not_execute",
      "does_not_generate",
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
      "真实 runner implementation dry-run 已能构建 executor stdin payload，但尚未接入命令执行逻辑，因此不能声明会执行命令或返回真实图片字段。",
    messageEn:
      "The real runner implementation dry-run can build the executor stdin payload, but command execution logic is not connected yet, so it cannot declare command execution or real image fields.",
    nextStep: {
      zh: "接入真实命令执行后，dry-run 才能返回 ok=true，并声明会返回 imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "After connecting real command execution, dry-run may return ok=true and declare imageUrl / imageFormat / width / height / license / originalityConfirmed.",
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
      "does_not_execute",
      "does_not_generate",
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
      "真实 runner implementation 已构建 executor stdin payload，但尚未接入命令执行逻辑。不会执行命令，也不会返回假图、占位图、SVG、HTML、JSON 调试图或程序绘图结果。",
    messageEn:
      "The real runner implementation has built the executor stdin payload, but command execution logic is not connected yet. It will not execute commands and will not return fake images, placeholders, SVG, HTML, debug JSON images, or programmatic render results.",
    nextStep: {
      zh: "下一步接入真实命令执行：执行成功后必须写入 output-storage，并返回 public imageUrl / imageFormat / width / height / license / originalityConfirmed。",
      en: "Next connect real command execution: after successful execution it must write into output-storage and return public imageUrl / imageFormat / width / height / license / originalityConfirmed.",
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
      "does_not_execute",
      "does_not_generate",
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
      node: "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-14",
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