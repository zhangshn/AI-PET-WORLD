// 当前文件作用：定义 AI-PET-WORLD 自研真实图像生成 runner implementation 入口；把 executor shell 成功结果转换为正式 6 字段响应。

import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_LICENSES,
  MINIMUM_IMAGE_HEIGHT,
  MINIMUM_IMAGE_WIDTH,
  REQUIRED_RESPONSE_FIELDS,
  buildSuccessfulDryRunResponse,
  buildSuccessfulGenerateResponse,
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
const RUNNER_IMPLEMENTATION_VERSION = "implementation-result-mapped-1"

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
    ok: executorShell.ok === true,
    status:
      executorShell.ok === true
        ? "real_image_runner_implementation_ready"
        : "real_image_runner_implementation_blocked",
    implementation: RUNNER_IMPLEMENTATION_NAME,
    version: RUNNER_IMPLEMENTATION_VERSION,
    implementationConnected: executorShell.ok === true,
    executorStdinPayloadConnected: true,
    canRunInference: executorShell.ok === true,
    canGenerateRealBitmap: false,
    canWriteOutputFile: executorShell.ok === true,
    requiredResponseShape: requiredResponseFields,
    inputContract: buildImplementationInputContract(requiredResponseFields),
    outputContract: buildImplementationOutputContract(requiredResponseFields),
    executionContract,
    executorStdinPayload,
    executorShell,
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "executor_stdin_payload_ready",
      "execution_contract_ready",
      ...executorStdinPayload.tags,
      ...executorShell.tags,
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

  if (executorShell.ok === true && executorStdinPayload.ok === true) {
    const response = buildSuccessfulDryRunResponse({
      requestAudit: input.requestAudit,
      requiredResponseFields,
    })

    return {
      ...response,
      status: "real_image_runner_implementation_dry_run_passed",
      implementation: RUNNER_IMPLEMENTATION_NAME,
      version: RUNNER_IMPLEMENTATION_VERSION,
      implementationConnected: true,
      executorStdinPayloadConnected: true,
      executorStdinPayload,
      executorShell,
      canRunInference: true,
      canGenerateRealBitmap: false,
      canWriteOutputFile: true,
      canShowToPlayer: false,
    }
  }

  return {
    ok: false,
    status: "real_image_runner_implementation_blocked",
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
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "dry_run_blocked",
      ...executorStdinPayload.tags,
      ...executorShell.tags,
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

  if (executorShell.ok === true) {
    const response = buildSuccessfulGenerateResponse({
      requestAudit: input.requestAudit,
      requiredResponseFields,
      payload: executorShell,
    })

    return {
      ...response,
      status:
        response.ok === true
          ? "real_image_runner_implementation_generate_passed"
          : response.status,
      implementation: RUNNER_IMPLEMENTATION_NAME,
      version: RUNNER_IMPLEMENTATION_VERSION,
      implementationConnected: response.ok === true,
      executorStdinPayloadConnected: true,
      executorStdinPayload,
      executorShell,
      canRunInference: response.ok === true,
      canGenerateRealBitmap: response.ok === true,
      canWriteOutputFile: response.ok === true,
      canShowToPlayer: false,
    }
  }

  return {
    ok: false,
    status: "real_image_runner_implementation_blocked",
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
    canShowToPlayer: false,
    tags: [
      "real_image_runner_implementation",
      "generate_blocked",
      ...executorStdinPayload.tags,
      ...executorShell.tags,
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
      node: "MD-NEXT-LOCAL-MODEL-IMPLEMENTATION-16-BLOCK",
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
