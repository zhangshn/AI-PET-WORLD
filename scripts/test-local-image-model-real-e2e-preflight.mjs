import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  generateLocalImageCandidate,
  readLocalImageModelImplementationHealth,
  runLocalImageModelImplementationDryRun,
} from "../services/local-image-model/implementation.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  printTitle("AI-PET-WORLD real image model e2e preflight test")

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-pet-world-real-e2e-"))

  try {
    const assetDir = path.join(tempDir, "assets")
    const outputDir = path.join(tempDir, "generated")
    const manifestPath = path.join(assetDir, "real-model-manifest.json")
    await writeFile(path.join(tempDir, ".keep"), "", "utf8")
    await writeManifestFixture({ assetDir, manifestPath })

    const config = buildRuntimeConfig({ assetDir, manifestPath, outputDir })

    testImplementationHealthReadyForPreflight(config)
    await testImplementationDryRunReadyForPreflight(config)
    await testGenerateBlocksUntilRealModelCommand(config)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  console.log("")
  console.log("RESULT: real image model e2e preflight test passed.")
}

function testImplementationHealthReadyForPreflight(config) {
  const health = readLocalImageModelImplementationHealth({
    ...config,
    requestBody: buildRequestBody(),
  })

  assert.equal(health.ok, true)
  assert.equal(health.implementationConnected, true)
  assert.equal(health.worker.ok, true)
  assert.equal(health.adapter.ok, true)
  assert.equal(health.adapter.runner.readiness.ok, true)
  assert.equal(health.adapter.runner.outputStorage.ok, true)
  assert.equal(health.canShowToPlayer, false)

  printCheck("implementation health ready for e2e preflight")
}

async function testImplementationDryRunReadyForPreflight(config) {
  const dryRun = await runLocalImageModelImplementationDryRun({
    ...config,
    requestBody: buildRequestBody(),
    requestAudit: {
      requestId: "real-e2e-preflight-dry-run",
    },
  })

  assert.equal(dryRun.ok, true)
  assert.equal(dryRun.status, "local_image_model_dry_run_ok")
  assert.equal(dryRun.adapter.adapterConnected, true)
  assert.equal(dryRun.adapter.runner.runnerConnected, true)
  assert.equal(dryRun.adapter.runner.implementation.implementationConnected, true)
  assert.equal(dryRun.canShowToPlayer, false)

  printCheck("implementation dry-run ready for e2e preflight")
}

async function testGenerateBlocksUntilRealModelCommand(config) {
  const generate = await generateLocalImageCandidate({
    ...config,
    requestBody: buildRequestBody(),
    requestAudit: {
      requestId: "real-e2e-preflight-generate",
    },
  })

  assert.equal(generate.ok, false)
  assert.equal(generate.canShowToPlayer, false)
  assert.equal(generate.adapter.adapterConnected, false)
  assert.equal(generate.adapter.canGenerateRealBitmap, false)
  assert.equal(generate.adapter.runner.runnerConnected, false)
  assert.equal(generate.adapter.runner.canGenerateRealBitmap, false)
  assert.equal(
    generate.adapter.runner.implementation.executorShell.status,
    "real_image_executor_shell_exit_non_zero"
  )
  assert.equal(
    generate.adapter.runner.implementation.executorShell.didWriteOutputFile,
    false
  )
  assert.equal(
    generate.adapter.runner.implementation.executorShell.canShowToPlayer,
    false
  )

  printCheck("generate blocks until real model command is configured")
}

async function writeManifestFixture(input) {
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(input.assetDir, { recursive: true })
  )

  await writeFile(
    input.manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: "ai-pet-world-real-image-model-manifest-v1",
        modelName: "AI-PET-WORLD E2E Preflight Real Model Placeholder Manifest",
        modelVersion: "preflight-1",
        license: "self_owned",
        dataSourceType: "self_owned",
        commercialUseAllowed: true,
        originalityConfirmed: true,
        unlicensedThirdPartyArtworkAllowed: false,
        outputCapabilities: {
          supportedImageFormats: ["png", "webp", "jpg"],
          minimumWidth: 1024,
          minimumHeight: 768,
          canReturnPlaceholder: false,
          canReturnSvg: false,
          canReturnHtml: false,
          canReturnJsonDebugImage: false,
          canReturnProgrammaticRenderer: false,
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  )
}

function buildRuntimeConfig(input) {
  return {
    enabled: "true",
    command: process.execPath,
    argsJson: JSON.stringify(["services/local-image-model/real-image-model-worker.mjs"]),
    timeoutMs: "10000",
    worker: {
      command: process.execPath,
      argsJson: JSON.stringify(["services/local-image-model/real-image-command-bridge.mjs"]),
      timeoutMs: "10000",
    },
    realModelReadiness: {
      enabled: "true",
      assetDirectory: input.assetDir,
      manifestPath: input.manifestPath,
      license: "self_owned",
      originalityConfirmed: "true",
    },
    outputStorage: {
      outputDirectory: input.outputDir,
      publicBaseUrl: "http://127.0.0.1:7001/generated",
    },
  }
}

function buildRequestBody() {
  return {
    requestId: "real-e2e-preflight-request",
    imageFormat: "png",
    width: 1536,
    height: 1024,
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
      tags: ["real_e2e_preflight_model_task"],
    },
    promptPackage: {
      packageId: "real-e2e-preflight-prompt-package",
      positivePromptEn:
        "Bright healing detailed top-down pixel world frame with clear terrain layers.",
      negativePromptEn:
        "No placeholder, no SVG, no HTML, no JSON debug image, no watermark.",
      sourceFactIds: ["real-e2e-preflight-fact"],
      canShowToPlayer: false,
      tags: ["real_e2e_preflight_prompt_package"],
    },
    responseContract: {
      requiredFields: [
        "imageUrl",
        "imageFormat",
        "width",
        "height",
        "license",
        "originalityConfirmed",
      ],
      allowedImageFormats: ["png", "webp", "jpg"],
      allowedLicenses: ["self_owned", "cc0", "commercial_license"],
      minimumWidth: 1024,
      minimumHeight: 768,
      canShowToPlayer: false,
      mustPersistAsAiImageCandidate: true,
      mustPassVisualJudge: true,
      tags: ["real_e2e_preflight_response_contract"],
    },
    controlSketch: {
      controlSketchId: "real-e2e-preflight-control-sketch",
      canShowToPlayer: false,
      cannotApprove: true,
      tags: ["real_e2e_preflight_control_sketch"],
    },
    visualFixHints: [],
    worldFactMetadata: {
      sourceFactIds: ["real-e2e-preflight-fact"],
      canShowToPlayer: false,
      tags: ["real_e2e_preflight_world_fact_metadata"],
    },
    constraints: {
      canShowToPlayer: false,
    },
    canShowToPlayer: false,
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
