import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { REQUIRED_RESPONSE_FIELDS } from "../services/local-image-model/contracts.mjs"
import { buildRealImageExecutorStdinPayload } from "../services/local-image-model/real-image-execution-payload.mjs"
import {
  executeRealImageWithExecutorShell,
  readRealImageExecutorShellConfig,
  readRealImageExecutorShellHealth,
  runRealImageExecutorShellDryRun,
} from "../services/local-image-model/real-image-executor-shell.mjs"
import { REAL_MODEL_MANIFEST_SCHEMA_VERSION } from "../services/local-image-model/real-model-manifest.mjs"
import { readRealImageRunnerImplementationHealth } from "../services/local-image-model/real-image-runner-implementation.mjs"

main()

async function main() {
  printTitle("AI-PET-WORLD real image executor shell test")

  testExecutorShellDefaultDisabled()
  testExecutorShellEnabledWithoutCommandBlocked()
  testExecutorShellInvalidArgsBlocked()
  testExecutorShellConfigReady()
  await testExecutorShellDryRunReadyDoesNotExecute()
  await testExecutorShellExecutionRequiresPayload()
  await testExecutorShellDoesNotExecuteInvalidRequest()
  await testExecutorShellExecutesAndRejectsInvalidStdoutJson()
  await testExecutorShellExecutesAndRejectsInvalidStdoutContract()
  await testExecutorShellRejectsValidStdoutWithoutOutputFile()
  testRunnerImplementationExposesExecutorShell()

  console.log("")
  console.log("RESULT: real image executor shell test passed.")
}

function testExecutorShellDefaultDisabled() {
  const health = readRealImageExecutorShellHealth()

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_executor_shell_disabled")
  assert.equal(health.enabled, false)
  assert.equal(health.commandConfigured, false)
  assert.equal(health.canExecuteCommand, false)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.willExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  printCheck("executor shell default disabled")
}

function testExecutorShellEnabledWithoutCommandBlocked() {
  const health = readRealImageExecutorShellHealth({
    enabled: true,
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_executor_shell_command_missing")
  assert.equal(health.enabled, true)
  assert.equal(health.commandConfigured, false)
  assert.equal(health.canExecuteCommand, false)
  assert.equal(health.willExecuteCommand, false)

  printCheck("executor shell enabled without command blocked")
}

function testExecutorShellInvalidArgsBlocked() {
  const health = readRealImageExecutorShellHealth({
    enabled: true,
    command: "node",
    argsJson: "{bad json",
  })

  assert.equal(health.ok, false)
  assert.equal(health.status, "real_image_executor_shell_args_invalid")
  assert.equal(health.enabled, true)
  assert.equal(health.commandConfigured, true)
  assert.equal(health.argsValid, false)
  assert.equal(health.canExecuteCommand, false)

  printCheck("executor shell invalid args blocked")
}

function testExecutorShellConfigReady() {
  const health = readRealImageExecutorShellHealth({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify(["mock-runner.mjs"]),
    timeoutMs: 10_000,
  })

  assert.equal(health.ok, true)
  assert.equal(health.status, "real_image_executor_shell_ready")
  assert.equal(health.enabled, true)
  assert.equal(health.commandConfigured, true)
  assert.equal(health.argsValid, true)
  assert.equal(health.timeoutMs, 10_000)
  assert.equal(health.executorConnected, true)
  assert.equal(health.canExecuteCommand, true)
  assert.equal(health.canRunInference, true)
  assert.equal(health.canGenerateRealBitmap, false)
  assert.equal(health.willExecuteCommand, false)
  assert.equal(health.canShowToPlayer, false)

  const config = readRealImageExecutorShellConfig({
    enabled: true,
    command: process.execPath,
    argsJson: ["mock-runner.mjs"],
  })

  assert.equal(config.enabled, true)
  assert.equal(config.command, process.execPath)
  assert.deepEqual(config.args, ["mock-runner.mjs"])
  assert.equal(config.argsValid, true)

  printCheck("executor shell config ready")
}

async function testExecutorShellDryRunReadyDoesNotExecute() {
  const worker = createMockWorkerFile("dry-run-worker.mjs", buildInvalidJsonWorker())

  const dryRun = await runRealImageExecutorShellDryRun({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([worker]),
  })

  assert.equal(dryRun.ok, true)
  assert.equal(dryRun.status, "real_image_executor_shell_dry_run_ready")
  assert.equal(dryRun.enabled, true)
  assert.equal(dryRun.commandConfigured, true)
  assert.equal(dryRun.canExecuteCommand, true)
  assert.equal(dryRun.willExecuteCommand, false)
  assert.equal(dryRun.wouldExecuteCommand, true)
  assert.equal(dryRun.willReturnStdoutJson, true)
  assert.equal(dryRun.willReturnImageUrl, false)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("executor shell dry-run ready does not execute")
}

async function testExecutorShellExecutionRequiresPayload() {
  const worker = createMockWorkerFile(
    "requires-payload-worker.mjs",
    buildInvalidJsonWorker()
  )

  const generate = await executeRealImageWithExecutorShell({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([worker]),
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_executor_shell_payload_missing")
  assert.equal(generate.enabled, true)
  assert.equal(generate.commandConfigured, true)
  assert.equal(generate.didExecuteCommand, false)
  assert.equal(generate.didWriteOutputFile, false)
  assert.equal(generate.didReturnStdoutJson, false)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("executor shell execution requires payload")
}

async function testExecutorShellDoesNotExecuteInvalidRequest() {
  const worker = createMockWorkerFile(
    "invalid-request-worker.mjs",
    buildInvalidJsonWorker()
  )

  const generate = await executeRealImageWithExecutorShell({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([worker]),
    executorStdinPayload: {
      schemaVersion: "invalid",
    },
  })

  assert.equal(generate.ok, false)
  assert.equal(
    generate.status,
    "real_image_executor_shell_execution_request_invalid"
  )
  assert.equal(generate.didExecuteCommand, false)
  assert.equal(generate.didWriteOutputFile, false)
  assert.equal(generate.didReturnStdoutJson, false)
  assert.equal(generate.canShowToPlayer, false)

  printCheck("executor shell does not execute invalid request")
}

async function testExecutorShellExecutesAndRejectsInvalidStdoutJson() {
  const fixture = createExecutionFixture()
  const worker = createMockWorkerFile(
    "invalid-stdout-json-worker.mjs",
    buildInvalidJsonWorker()
  )
  const payload = buildValidExecutorPayload({
    requestId: "executor-invalid-json",
    outputDirectory: fixture.outputDirectory,
  })

  const generate = await executeRealImageWithExecutorShell({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([worker]),
    outputStorage: {
      outputDirectory: fixture.outputDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    executorStdinPayload: payload,
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_executor_shell_stdout_json_invalid")
  assert.equal(generate.didExecuteCommand, true)
  assert.equal(generate.didWriteOutputFile, false)
  assert.equal(generate.didReturnStdoutJson, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)

  printCheck("executor shell executes and rejects invalid stdout JSON")
}

async function testExecutorShellExecutesAndRejectsInvalidStdoutContract() {
  const fixture = createExecutionFixture()
  const worker = createMockWorkerFile(
    "invalid-stdout-contract-worker.mjs",
    buildInvalidStdoutContractWorker()
  )
  const payload = buildValidExecutorPayload({
    requestId: "executor-invalid-contract",
    outputDirectory: fixture.outputDirectory,
  })

  const generate = await executeRealImageWithExecutorShell({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([worker]),
    outputStorage: {
      outputDirectory: fixture.outputDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    executorStdinPayload: payload,
  })

  assert.equal(generate.ok, false)
  assert.equal(
    generate.status,
    "real_image_executor_shell_stdout_contract_invalid"
  )
  assert.equal(generate.didExecuteCommand, true)
  assert.equal(generate.didWriteOutputFile, false)
  assert.equal(generate.didReturnStdoutJson, true)
  assert.equal(generate.didAcceptStdoutJson, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)

  printCheck("executor shell executes and rejects invalid stdout contract")
}

async function testExecutorShellRejectsValidStdoutWithoutOutputFile() {
  const fixture = createExecutionFixture()
  const worker = createMockWorkerFile(
    "valid-stdout-missing-file-worker.mjs",
    buildValidStdoutWithoutFileWorker()
  )
  const payload = buildValidExecutorPayload({
    requestId: "executor-missing-file",
    outputDirectory: fixture.outputDirectory,
  })

  const generate = await executeRealImageWithExecutorShell({
    enabled: true,
    command: process.execPath,
    argsJson: JSON.stringify([worker]),
    outputStorage: {
      outputDirectory: fixture.outputDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
    executorStdinPayload: payload,
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.status, "real_image_executor_shell_output_file_missing")
  assert.equal(generate.didExecuteCommand, true)
  assert.equal(generate.didWriteOutputFile, false)
  assert.equal(generate.didReturnStdoutJson, true)
  assert.equal(generate.didAcceptStdoutJson, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(Object.hasOwn(generate, "imageUrl"), false)

  printCheck("executor shell rejects valid stdout without output file")
}

function testRunnerImplementationExposesExecutorShell() {
  const health = readRealImageRunnerImplementationHealth()

  assert.equal(health.ok, false)
  assert.equal(health.version, "implementation-payload-connected-1")
  assert.equal(
    health.status,
    "real_image_runner_implementation_payload_ready_not_connected"
  )
  assert.equal(health.executorStdinPayloadConnected, true)
  assert.equal(health.executorShell.status, "real_image_executor_shell_disabled")
  assert.equal(health.executorShell.canExecuteCommand, false)
  assert.equal(health.inputContract.mustUseExecutorShell, true)
  assert.equal(health.inputContract.mustBuildExecutorStdinPayload, true)
  assert.equal(health.canShowToPlayer, false)
  assert.ok(health.tags.includes("executor_stdin_payload_ready"))

  printCheck("runner implementation exposes executor shell")
}

function createExecutionFixture() {
  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-pet-world-executor-shell-output-")
  )

  return {
    outputDirectory,
  }
}

function createMockWorkerFile(fileName, source) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ai-pet-world-executor-shell-worker-")
  )
  const filePath = path.join(directory, fileName)

  fs.writeFileSync(filePath, source, "utf8")

  return filePath
}

function buildValidExecutorPayload(input) {
  const result = buildRealImageExecutorStdinPayload({
    requestId: input.requestId,
    requestBody: buildRequestBody(),
    readiness: buildReadyReadinessGate(),
    manifest: buildValidManifest(),
    outputStorage: {
      outputDirectory: input.outputDirectory,
      publicBaseUrl: "http://127.0.0.1:3000",
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.payload.canShowToPlayer, false)
  assert.equal(result.payload.worldFactMetadata.locked, true)
  assert.equal(result.payload.constraints.mustPassVisualJudge, true)

  return result.payload
}

function buildInvalidJsonWorker() {
  return `
let input = ""

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  input += chunk
})
process.stdin.on("end", () => {
  JSON.parse(input)
  process.stdout.write("not-json")
})
`
}

function buildInvalidStdoutContractWorker() {
  return `
let input = ""

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  input += chunk
})
process.stdin.on("end", () => {
  JSON.parse(input)
  process.stdout.write(JSON.stringify({
    ok: true,
    status: "real_image_generated",
    imageFileName: "bad.svg",
    imageFormat: "svg",
    width: 1024,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true
  }))
})
`
}

function buildValidStdoutWithoutFileWorker() {
  return `
let input = ""

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  input += chunk
})
process.stdin.on("end", () => {
  const payload = JSON.parse(input)

  process.stdout.write(JSON.stringify({
    ok: true,
    status: "real_image_generated",
    imageFileName: payload.outputFileName,
    imageFormat: "png",
    width: 1024,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true
  }))
})
`
}

function buildRequestBody() {
  return {
    modelTask: {
      taskKind: "generate_hidden_world_bitmap_candidate",
      modelRole: "ai_image_generation_model",
      outputPurpose: "hidden_ai_image_candidate",
      worldFrameKind: "static_top_down_pixel_world_frame",
      mustReturnResponseContract: true,
      mustNotDisplayDirectly: true,
      mustNotRewriteWorldFacts: true,
      mustNotUseProgrammaticRenderer: true,
      mustNotCopyUnlicensedThirdPartyWorks: true,
      canShowToPlayer: false,
    },
    promptPackage: {
      packageId: "executor-shell-test-prompt-package",
      worldId: "executor-shell-test-world",
      tick: 1,
      canShowToPlayer: false,
      summary:
        "Executor shell child_process integration test. This is not a player-visible image.",
    },
    controlSketch: {
      controlSketchId: "executor-shell-test-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
    },
    responseContract: {
      requiredFields: REQUIRED_RESPONSE_FIELDS,
      allowedImageFormats: ["png", "webp", "jpg"],
      allowedLicenses: ["self_owned", "cc0", "commercial_license"],
      minimumWidth: 512,
      minimumHeight: 512,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPersistOnlyAsHiddenCandidate: true,
      mustPassVisualJudge: true,
    },
    visualFixHints: [],
    metadata: {
      worldId: "executor-shell-test-world",
      tick: 1,
      promptPackageId: "executor-shell-test-prompt-package",
      sourceFactIds: ["executor-shell-test-world", "executor-shell-test-fact"],
      canShowToPlayer: false,
      cannotApprove: true,
    },
    imageFormat: "png",
    width: 1536,
    height: 1024,
  }
}

function buildReadyReadinessGate() {
  return {
    ok: true,
    status: "real_image_model_assets_ready",
    enabled: true,
    assetDirectoryConfigured: true,
    manifestConfigured: true,
    license: "self_owned",
    originalityConfirmed: true,
    manifest: {
      ok: true,
      status: "real_model_manifest_valid",
      ...buildValidManifest(),
      canShowToPlayer: false,
    },
    canRunInference: false,
    canShowToPlayer: false,
    tags: [
      "real_image_model_readiness",
      "assets_ready",
      "manifest_valid",
      "runner_not_connected",
      "does_not_generate",
      "not_player_visible",
    ],
  }
}

function buildValidManifest() {
  return {
    schemaVersion: REAL_MODEL_MANIFEST_SCHEMA_VERSION,
    modelName: "ai-pet-world-executor-shell-test-model",
    modelVersion: "0.0.1",
    license: "self_owned",
    dataSourceType: "self_owned",
    commercialUseAllowed: true,
    originalityConfirmed: true,
    unlicensedThirdPartyArtworkAllowed: false,
    outputCapabilities: {
      supportedImageFormats: ["png", "webp", "jpg"],
      minimumWidth: 512,
      minimumHeight: 512,
      canReturnPlaceholder: false,
      canReturnSvg: false,
      canReturnHtml: false,
      canReturnJsonDebugImage: false,
      canReturnProgrammaticRenderer: false,
    },
  }
}

function printTitle(title) {
  console.log("")
  console.log("=".repeat(title.length))
  console.log(title)
  console.log("=".repeat(title.length))
}

function printCheck(name) {
  console.log(`[passed] ${name}`)
}