import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { DatabaseSync } from "node:sqlite"

import {
  CAPABILITY_VERSION,
  EXPECTED_TRAINER_STATUS,
  FIXED_PREVIEW_EPOCHS,
  TRAINER_ARCHITECTURE_VERSION,
  createJointConditionLocalTransportSmokeAdapters,
  validateJointConditionLocalTransportSmokeExecutionPlan,
} from "../lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"
import { runAutonomousClosedLoop } from "../lib/ai-painter-autonomous-closed-loop-v1.mjs"
import { materializeJointConditionLocalTransportSmokePackage } from "../materialize-ai-painter-stage4-joint-condition-local-transport-smoke-package.mjs"

const PROJECT_ROOT = path.resolve(process.cwd())
const FIXTURE_PARENT = path.join(PROJECT_ROOT, ".runtime", "ai-painter")
const FIXTURE_ROOT = fs.mkdtempSync(path.join(FIXTURE_PARENT, "joint-transport-closed-loop-cpu-"))
const SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-194-wet-season-drainage-hollow-v6"
let positive = 0
let negative = 0

export async function runJointConditionLocalTransportSmokeClosedLoopCpuSimulation() {
  try {
    prepareProjectFixture()
    const qualified = await runCase({ suffix: "qualified", visualPass: true })
    assert.equal(qualified.state.state, "completed")
    assert.equal(qualified.counters.trainer, 1)
    assert.equal(qualified.counters.activation, 1)
    assert.deepEqual(qualified.states, [
      "package_materialized", "preflight", "executing", "validating",
      "reviewing", "adjudicating", "finalizing", "completed",
    ])
    const recovered = await qualified.adapters.execute(makeAdapterContext(qualified.plan, qualified.packageSpec))
    assert.equal(recovered.status, "passed")
    assert.equal(recovered.recoveredWithoutRetraining, true)
    assert.equal(qualified.counters.trainer, 1)
    const qualifiedManifestPath = resolveFixture(`${qualified.plan.outputRoot}/training-output/manifest.json`)
    const qualifiedManifest = readJson(qualifiedManifestPath)
    writeJson(projectPath(qualifiedManifestPath), { ...qualifiedManifest, architectureVersion: CAPABILITY_VERSION })
    const wrongShortArchitecture = await qualified.adapters.execute(makeAdapterContext(qualified.plan, qualified.packageSpec))
    assert.equal(wrongShortArchitecture.failureCode, "partial_training_output_reuse_forbidden")
    assert.equal(qualified.counters.trainer, 1)
    writeJson(projectPath(qualifiedManifestPath), {
      ...qualifiedManifest,
      stage4JointConditionLocalTransportSmoke: {
        ...qualifiedManifest.stage4JointConditionLocalTransportSmoke,
        architectureId: "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1",
        legacySpatialAffineIdentityReused: true,
      },
    })
    const legacyArchitecture = await qualified.adapters.execute(makeAdapterContext(qualified.plan, qualified.packageSpec))
    assert.equal(legacyArchitecture.failureCode, "partial_training_output_reuse_forbidden")
    assert.equal(qualified.counters.trainer, 1)
    writeJson(projectPath(qualifiedManifestPath), qualifiedManifest)
    negative += 2
    positive += 1

    const failed = await runCase({ suffix: "visual-failure", visualPass: false })
    assert.equal(failed.state.state, "failed_closed")
    assert.equal(failed.state.phase, "finalize")
    assert.equal(failed.counters.trainer, 1)
    const failedTerminal = readJson(path.join(
      FIXTURE_ROOT, ".runtime", "ai-painter", "autonomous-closed-loop-executions",
      failed.plan.packageIdentity, "phase-terminal.json",
    ))
    assert.equal(failedTerminal.finalResult.failureKind, "visual")
    assert.equal(failedTerminal.ownerResponseRequired, false)
    positive += 1

    const invalid = structuredClone(qualified.plan)
    invalid.outputRoot = invalid.outputRoot.replace("stage4-joint-condition-local-transport-controlled-smokes", "stage4-full-backbone-spatial-affine-controlled-smokes")
    assert.throws(
      () => validateJointConditionLocalTransportSmokeExecutionPlan(invalid, { projectRoot: FIXTURE_ROOT, requireFiles: true }),
      /joint transport controlled Smoke namespace|outputRoot must terminate|legacy candidate identity/u,
    )
    negative += 1

    const partialPlan = buildPlan("partial")
    writeJson("fixtures/partial-plan.json", partialPlan)
    fs.mkdirSync(resolveFixture(`${partialPlan.outputRoot}/training-output`), { recursive: true })
    const partialAdapters = createJointConditionLocalTransportSmokeAdapters(makeServices({ visualPass: true, counters: { preflight: 0, activation: 0, trainer: 0 } }))
    const partialResult = await partialAdapters.execute(makeAdapterContext(partialPlan, makePackageSpec(partialPlan, "fixtures/partial-plan.json")))
    assert.equal(partialResult.status, "failed")
    assert.equal(partialResult.failureCode, "partial_training_output_reuse_forbidden")
    negative += 1

    const preflightFailurePlan = buildPlan("preflight-failure")
    const preflightFailurePlanPath = "fixtures/preflight-failure-execution-plan.json"
    writeJson(preflightFailurePlanPath, preflightFailurePlan)
    const preflightFailurePackage = materializeJointConditionLocalTransportSmokePackage(
      preflightFailurePlanPath,
      { root: FIXTURE_ROOT, recordedAtUtc: "2026-08-30T00:00:02.000Z" },
    )
    const preflightFailureSpec = readJson(resolveFixture(preflightFailurePackage.packagePath))
    const preflightFailureCounters = { preflight: 0, activation: 0, trainer: 0 }
    const preflightFailureAdapters = createJointConditionLocalTransportSmokeAdapters(makeServices({
      visualPass: true, counters: preflightFailureCounters,
      plan: preflightFailurePlan, failCommandId: "trainer-readonly-preflight",
    }))
    const preflightFailureState = await runAutonomousClosedLoop({
      root: FIXTURE_ROOT, spec: preflightFailureSpec,
      packageSha256: preflightFailurePackage.packageSha256,
      adapters: preflightFailureAdapters, now: monotonicClock(),
    })
    assert.equal(preflightFailureState.state, "failed_closed")
    assert.equal(preflightFailureCounters.preflight, 1, "failed immutable preflight must not replay")
    const preservedPreflightReport = readJson(resolveFixture(
      `${preflightFailurePlan.outputRoot}/preflight-report.json`,
    ))
    assert.equal(preservedPreflightReport.commandEvidence.at(-1).id, "trainer-readonly-preflight")
    assert.equal(preservedPreflightReport.commandEvidence.at(-1).stderrTail, "fixture preflight failure")
    negative += 1

    const report = {
      status: "passed", positive, negative,
      capabilityVersion: CAPABILITY_VERSION,
      automaticTrainingValidationReviewFinalization: true,
      completedTrainingRecoveryDoesNotRetrain: true,
      visualFailureClosesInFinalize: true,
      ownerAuthorizationRequired: false,
    }
    return report
  } finally {
    const resolved = path.resolve(FIXTURE_ROOT)
    assert.ok(resolved.startsWith(`${path.resolve(FIXTURE_PARENT)}${path.sep}`))
    fs.rmSync(resolved, { recursive: true, force: true })
  }
}

async function runCase({ suffix, visualPass }) {
  const plan = buildPlan(suffix)
  const planPath = `fixtures/${suffix}-execution-plan.json`
  writeJson(planPath, plan)
  const materialized = materializeJointConditionLocalTransportSmokePackage(planPath, {
    root: FIXTURE_ROOT, recordedAtUtc: "2026-08-30T00:00:00.000Z",
  })
  assert.equal(materialized.ownerAuthorizationRequired, false)
  const packageSpec = readJson(resolveFixture(materialized.packagePath))
  const counters = { preflight: 0, activation: 0, trainer: 0 }
  const adapters = createJointConditionLocalTransportSmokeAdapters(makeServices({ visualPass, counters, plan }))
  const state = await runAutonomousClosedLoop({
    root: FIXTURE_ROOT, spec: packageSpec, packageSha256: materialized.packageSha256,
    adapters,
    now: monotonicClock(),
  })
  const dbPath = path.join(
    FIXTURE_ROOT, ".runtime", "ai-painter", "autonomous-closed-loop-executions",
    plan.packageIdentity, "execution.sqlite",
  )
  const db = new DatabaseSync(dbPath, { readOnly: true })
  const states = db.prepare("SELECT to_state FROM transitions ORDER BY sequence").all().map((row) => row.to_state)
  db.close()
  return { plan, packageSpec, materialized, counters, adapters, state, states }
}

function buildPlan(suffix) {
  const runTime = ({ qualified: "120000", "visual-failure": "120001", partial: "120002", "preflight-failure": "120003" })[suffix]
  assert.ok(runTime, `unknown fixture suffix: ${suffix}`)
  const runId = `20260830-${runTime}-joint-condition-local-transport-smoke`
  const packageIdentity = `joint-condition-local-transport-${suffix}-package`
  const outputRoot = `.runtime/ai-painter/stage4-joint-condition-local-transport-controlled-smokes/${runId}`
  const compiledContractPath = `fixtures/${suffix}-compiled-smoke-contract.json`
  const binding = (relativePath) => ({ path: relativePath, sha256: sha256File(resolveFixture(relativePath)) })
  writeJson(compiledContractPath, {
    schemaVersion: "stage4-joint-condition-local-transport-controlled-smoke-contract-v1",
    status: "compiled_not_started", authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION, architectureId: CAPABILITY_VERSION,
    compilationRunId: `20260830-${suffix}-compilation`,
    executionIdentity: {
      runId, resolutionStage: 0, resolution: { width: 256, height: 192 },
    },
    futureEvidenceNamespace: { outputDirectory: outputRoot },
    sourceEvidence: [
      { role: "fixed-validation-condition-pack", ...binding("fixtures/condition-pack.json") },
      { role: "fixed-validation-reference-rgb", ...binding("fixtures/reference.png") },
    ],
  })
  const trainer = binding("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")
  const activation = binding("ml/ai-painter/scripts/materialize_stage4_joint_condition_local_transport_controlled_smoke.py")
  return {
    schemaVersion: "ai-painter-stage4-joint-condition-local-transport-smoke-execution-plan-v1",
    status: "compiled_not_started", authority: "local_ai_pet_world_program",
    capabilityVersion: CAPABILITY_VERSION, architectureId: CAPABILITY_VERSION,
    packageIdentity, runId, outputRoot,
    ownerAuthorizationRequired: false, ownerResponseRequired: false,
    maxInfrastructureRecoveryAttempts: 1,
    trainingRestartAllowed: false, automaticSecondTrainingRunAllowed: false,
    stage0AutomaticStart: false,
    fixedTrainingIdentity: {
      sampleId: SAMPLE_ID, sampleSplit: "validation", seed: 20263722,
      topology: "west", resolutionStage: 0,
      resolution: { width: 256, height: 192 }, epochCount: 30,
      previewEpochs: [...FIXED_PREVIEW_EPOCHS],
      initialization: "fixed_random_denoiser_initialization_without_checkpoint",
      autoencoderFrozen: true,
    },
    commands: {
      preflight: [
        { id: "cpu-contract", runtime: "python", program: trainer, arguments: ["--cpu-contract-check"], expectedExitCode: 0 },
        { id: "active-config-audit", runtime: "python", program: trainer, arguments: ["--active-config-audit"], expectedExitCode: 0 },
        {
          id: "trainer-readonly-preflight", runtime: "python", program: trainer,
          arguments: [
            "--config", "${OUTPUT_ROOT}/preflight-config.json", "--preflight-only",
            "--stage4-joint-condition-local-transport-smoke",
            "--stage4-joint-condition-local-transport-smoke-contract", compiledContractPath,
          ], expectedExitCode: 0,
        },
        { id: "cuda-resource", runtime: "python", program: trainer, arguments: ["--cuda-resource-check"], expectedExitCode: 0 },
        { id: "disk-capacity", runtime: "python", program: trainer, arguments: ["--disk-capacity-check"], expectedExitCode: 0 },
      ],
      activation: {
        id: "materialize-active-config", runtime: "python", program: activation,
        arguments: ["--run-id", "${RUN_ID}", "--output", "${OUTPUT_ROOT}/active-config.json"], expectedExitCode: 0,
      },
      trainer: {
        id: "controlled-smoke-trainer", runtime: "python", program: trainer,
        arguments: [
          "--config", "${OUTPUT_ROOT}/active-config.json",
          "--output-dir", "${TRAINING_OUTPUT}",
          "--overfit-sample-id", SAMPLE_ID, "--overfit-epochs", "30",
          "--stage4-joint-condition-local-transport-smoke",
          "--stage4-joint-condition-local-transport-smoke-contract", compiledContractPath,
        ], expectedExitCode: 0,
      },
    },
    evidenceBindings: {
      compiledSmokeContract: binding(compiledContractPath),
      datasetManifest: binding("fixtures/dataset-manifest.json"),
      sourceIndex: binding("fixtures/source-index.json"),
      frozenAutoencoder: binding("fixtures/frozen-autoencoder.pt"),
      readonlyGpuTerminal: binding("fixtures/readonly-gpu-terminal.json"),
      readonlyGpuReport: binding("fixtures/readonly-gpu-report.json"),
      professionalAestheticProgram: binding("scripts/lib/ai-assisted-professional-aesthetic.mjs"),
      conditionAlignmentProgram: binding("scripts/lib/ai-assisted-condition-alignment.mjs"),
      previewNormalizationProgram: binding("scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs"),
      lateStabilityProgram: binding("scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs"),
    },
    artifacts: {
      activeConfig: "active-config.json", preflightReport: "preflight-report.json",
      trainingOutput: "training-output", trainerManifest: "training-output/manifest.json",
      trainerProgress: "training-output/progress.json",
      resourceTelemetry: "training-output/resource-telemetry.json",
      machineReviewTimeline: "machine-review-timeline.json",
      lateStabilityQualification: "late-stability-qualification.json",
      manifest: "manifest.json", finalization: "finalization/finalization.json",
    },
    reviewWorkRoot: ".runtime/ai-painter/stage4-joint-condition-local-transport-review-work",
    expectedTrainerManifestStatus: EXPECTED_TRAINER_STATUS,
  }
}

function makeServices({ visualPass, counters, plan = null, failCommandId = null }) {
  let nowIndex = 0
  return {
    now: () => new Date(Date.UTC(2026, 7, 30, 0, 0, nowIndex++)).toISOString(),
    runCommand: async (command, options) => {
      if (command.id === "trainer-readonly-preflight") counters.preflight += 1
      if (command.id === failCommandId) {
        return {
          id: command.id, started: true, pid: 4242, exitCode: 1,
          stdout: "fixture preflight stdout", stderr: "fixture preflight failure",
        }
      }
      if (command.id === "materialize-active-config") {
        counters.activation += 1
        assert.equal(
          fs.existsSync(path.join(options.outputRoot, "trainer-launch-intent.json")),
          false,
          "Trainer launch intent must not precede internal ticket consumption",
        )
        writeJson(projectPath(`${options.outputRoot}/active-config.json`), { schemaVersion: "fixture-active-config-v1", runId: options.runId })
      }
      if (command.id === "controlled-smoke-trainer") {
        counters.trainer += 1
        options.onStarted?.({ pid: 4242 })
        createCompletedTrainingOutput(options.outputRoot, options.trainingOutput, plan)
      }
      return { id: command.id, started: true, pid: 4242, exitCode: 0, stdout: "fixture passed", stderr: "" }
    },
    normalizePreview: async ({ sourcePath, finalAssetPath }) => {
      fs.mkdirSync(path.dirname(finalAssetPath), { recursive: true })
      fs.copyFileSync(sourcePath, finalAssetPath)
      return { shortInputPath: sourcePath, shortOutputPath: finalAssetPath, finalAssetPath }
    },
    auditAesthetic: async () => ({ passed: true, issues: [], status: "passed" }),
    auditAlignment: async () => ({
      passed: visualPass, issues: visualPass ? [] : [{ code: "fixture_visual_failure" }],
      channelAudits: [{ passed: visualPass }], objectSemanticAudits: [{ passed: visualPass }],
    }),
  }
}

function createCompletedTrainingOutput(outputRoot, trainingOutput, plan) {
  assert.ok(plan, "fixture execution plan is required")
  fs.mkdirSync(trainingOutput, { recursive: false })
  const checkpointPath = path.join(trainingOutput, "complete-world-ai-assisted-conditional-denoiser.pt")
  fs.writeFileSync(checkpointPath, "opaque checkpoint bytes; never loaded by this test\n")
  const telemetryPath = path.join(trainingOutput, "resource-telemetry.json")
  fs.writeFileSync(telemetryPath, `${JSON.stringify({
    schemaVersion: "fixture-training-resource-telemetry-v1", status: "completed",
    rows: [{ epoch: 1, gpuMemoryBytes: 1024 }], peakGpuMemoryBytes: 1024,
    preflightMemoryIsTrainingPeak: false,
  })}\n`)
  const previews = FIXED_PREVIEW_EPOCHS.map((epoch) => {
    const source = path.join(trainingOutput, "fixed-epoch-previews", `epoch-${epoch}.png`)
    const reproduction = path.join(trainingOutput, "fixed-epoch-previews", `epoch-${epoch}-reproduction.png`)
    fs.mkdirSync(path.dirname(source), { recursive: true })
    const bytes = Buffer.from(`fixture-png-${epoch}`)
    fs.writeFileSync(source, bytes)
    fs.writeFileSync(reproduction, bytes)
    return {
      epoch, path: projectPath(source), sha256: sha256File(source),
      reproductionPath: projectPath(reproduction), reproductionSha256: sha256File(reproduction),
      byteExactReproduced: true,
    }
  })
  writeJson(projectPath(path.join(trainingOutput, "manifest.json")), {
    schemaVersion: "fixture-trainer-manifest-v1", status: EXPECTED_TRAINER_STATUS,
    architectureVersion: TRAINER_ARCHITECTURE_VERSION,
    stage4JointConditionLocalTransportSmoke: {
      architectureId: CAPABILITY_VERSION, runId: plan.runId,
      compiledContract: { ...plan.evidenceBindings.compiledSmokeContract },
      legacySpatialAffineIdentityReused: false,
    },
    trainingStage: "stage4_joint_condition_local_transport_controlled_smoke",
    seed: 20263722, resolutionStage: { width: 256, height: 192 },
    singleSampleOverfitSmoke: { sampleId: SAMPLE_ID, selectedSplit: "validation" },
    parentDenoiserCheckpointPath: null, parentDenoiserCheckpointSha256: null,
    machineReviewPending: true, checkpointPromotionEligible: false,
    stage0InitializationEligible: false,
    modelStateHashEvidence: {
      weightsChanged: true, initialDenoiserStateSha256: "1".repeat(64),
      finalDenoiserStateSha256: "2".repeat(64),
    },
    checkpointPath: projectPath(checkpointPath), checkpointSha256: sha256File(checkpointPath),
    resourceTelemetryPath: projectPath(telemetryPath), resourceTelemetrySha256: sha256File(telemetryPath),
    previewEpochs: [...FIXED_PREVIEW_EPOCHS], fixedPreviews: previews,
  })
  writeJson(projectPath(path.join(trainingOutput, "progress.json")), {
    schemaVersion: "fixture-progress-v1", status: "completed", epoch: 30, epochTarget: 30,
  })
}

function prepareProjectFixture() {
  copyProjectFile("data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json")
  copyProjectFile("scripts/lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs")
  copyProjectFile("scripts/materialize-ai-painter-stage4-joint-condition-local-transport-smoke-package.mjs")
  writeText("ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py", "# CPU fixture; never executed\n")
  writeText("ml/ai-painter/scripts/materialize_stage4_joint_condition_local_transport_controlled_smoke.py", "# CPU fixture; never executed\n")
  for (const relative of [
    "scripts/lib/ai-assisted-professional-aesthetic.mjs",
    "scripts/lib/ai-assisted-condition-alignment.mjs",
    "scripts/lib/ai-assisted-v7-r5-stage3-preview-review.mjs",
    "scripts/lib/ai-painter-stage4-late-convergence-qualification.mjs",
  ]) writeText(relative, "// CPU fixture program identity\n")
  writeJson("fixtures/dataset-manifest.json", { schemaVersion: "fixture-dataset-v1", sampleCount: 64 })
  writeJson("fixtures/condition-pack.json", {
    schemaVersion: "fixture-condition-pack-v1", worldId: "fixture-world", tick: 0,
    channels: Array.from({ length: 23 }, (_, index) => ({ channelIndex: index })),
  })
  writeText("fixtures/reference.png", "fixture-reference")
  const selectedSplits = [
    ...Array(48).fill("train"),
    ...Array(8).fill("validation"),
    ...Array(4).fill("challenge"),
    ...Array(4).fill("regression"),
  ]
  const samples = selectedSplits.map((split, index) => {
    const sampleId = index === 48
      ? SAMPLE_ID
      : `fixture-approved-sample-${String(index).padStart(2, "0")}`
    return {
      sampleId, recordId: sampleId, split,
      v7CapacityContributionRegistered: true,
      conditionBound: true, formalConditionalTrainingEligible: true,
      conditionPackPath: "fixtures/condition-pack.json", imagePath: "fixtures/reference.png",
      imageSha256: sha256File(resolveFixture("fixtures/reference.png")),
      classification: { regionalLandscapeType: "wet-season-drainage-hollow" },
    }
  })
  samples.push(...Array.from({ length: 52 }, (_, index) => ({
    sampleId: `fixture-retired-sample-${String(index).padStart(2, "0")}`,
    recordId: `fixture-retired-sample-${String(index).padStart(2, "0")}`,
    split: "train", v7CapacityContributionRegistered: false,
  })))
  writeJson("fixtures/source-index.json", {
    schemaVersion: "ai-assisted-cold-start-dataset-source-index-v1", sampleCount: 116, samples,
  })
  writeJson("fixtures/readonly-gpu-terminal.json", { status: "passed", capabilityVersion: CAPABILITY_VERSION })
  writeJson("fixtures/readonly-gpu-report.json", { status: "passed", capabilityVersion: CAPABILITY_VERSION })
  const sourceAutoencoder = path.join(PROJECT_ROOT, ".runtime", "ai-painter", "project-owned-complete-world-model-ai-assisted-v2", "ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z", "complete-world-ai-assisted-autoencoder.pt")
  assert.ok(fs.existsSync(sourceAutoencoder), "frozen project Autoencoder fixture source is missing")
  const targetAutoencoder = resolveFixture("fixtures/frozen-autoencoder.pt")
  fs.mkdirSync(path.dirname(targetAutoencoder), { recursive: true })
  try { fs.linkSync(sourceAutoencoder, targetAutoencoder) } catch { fs.copyFileSync(sourceAutoencoder, targetAutoencoder) }
  assert.equal(sha256File(targetAutoencoder), "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba")
}

function makeAdapterContext(plan, packageSpec) {
  return {
    projectRoot: FIXTURE_ROOT, packageIdentity: plan.packageIdentity,
    capabilityVersion: plan.capabilityVersion, outputRoot: plan.outputRoot,
    executionRoot: resolveFixture(`.runtime/ai-painter/autonomous-closed-loop-executions/${plan.packageIdentity}`),
    inputEvidence: packageSpec.inputEvidence, phase: "execute", attempt: 1,
    heartbeat: () => {}, reportProgress: () => {},
  }
}

function makePackageSpec(plan, planPath) {
  return {
    inputEvidence: [
      { path: planPath, sha256: sha256File(resolveFixture(planPath)) },
      ...Object.values(plan.evidenceBindings),
    ],
  }
}

function monotonicClock() {
  let index = 0
  return () => new Date(Date.UTC(2026, 7, 30, 1, 0, index++)).toISOString()
}

function copyProjectFile(relativePath) {
  const target = resolveFixture(relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(PROJECT_ROOT, relativePath), target)
}
function writeJson(relativePath, value) { writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`) }
function writeText(relativePath, value) {
  const target = resolveFixture(relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, value)
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function resolveFixture(relativePath) {
  const absolute = path.resolve(FIXTURE_ROOT, relativePath)
  assert.ok(absolute.startsWith(`${FIXTURE_ROOT}${path.sep}`))
  return absolute
}
function projectPath(filePath) { return path.relative(FIXTURE_ROOT, path.resolve(filePath)).replaceAll("\\", "/") }
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const result = await runJointConditionLocalTransportSmokeClosedLoopCpuSimulation()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
