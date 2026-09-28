import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFile, execFileSync } from "node:child_process"
import { promisify } from "node:util"
import { pathToFileURL } from "node:url"

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"


const execFileAsync = promisify(execFile)
const V2_CAPABILITY = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"
const V3_CAPABILITY = "stage4_mvp_object_semantic_closure_v3"
const V4_CAPABILITY = "stage4_mvp_object_trajectory_closure_v4"
const V5_CAPABILITY = "stage4_mvp_short_trajectory_closure_v5"
const V6_CAPABILITY = "stage4_mvp_native_complete_rgb_renderer_v6"
const V7_CAPABILITY = "stage4_mvp_native_complete_rgb_detail_renderer_v7"
const V8_CAPABILITY = "stage4_mvp_native_complete_rgb_object_crop_renderer_v8"
const V10_CAPABILITY = "stage4_mvp_native_complete_rgb_aperiodic_detail_renderer_v10"
const V11_CAPABILITY = "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
const V12_CAPABILITY = "stage4_mvp_native_complete_rgb_local_texture_renderer_v12"
const V9_CAPABILITY = "stage4_mvp_native_complete_rgb_detail_recovery_renderer_v9"
const WORKER = "ml/ai-painter/scripts/train_stage4_mvp_denoiser_stage0.py"
const V6_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_renderer_v6_stage0.py"
const V7_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_detail_renderer_v7_stage0.py"
const V8_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_object_crop_renderer_v8_stage0.py"
const V10_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10_stage0.py"
const V11_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_object_context_renderer_v11_stage0.py"
const V12_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_local_texture_v12_stage0.py"
const V9_WORKER = "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_detail_recovery_renderer_v9_stage0.py"
const QUALIFIER = "ml/ai-painter/scripts/qualify_stage4_mvp_denoiser_execution.py"
const STAGE_EXECUTION = "ml/ai-painter/scripts/stage4_formal_stage_execution.py"
const SUPPORT = "ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const BASE_PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-denoiser-stage0.mjs", WORKER, QUALIFIER,
  STAGE_EXECUTION, SUPPORT, TRAINER,
  "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/mvp_denoiser_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
])
const V3_PROGRAMS = Object.freeze([
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_object_semantic_closure_v3.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_object_semantic_closure_v3_runtime.py",
  "data/ai-painter/system-governance/stage4-mvp-object-semantic-closure-v3-contract.json",
])
const V4_PROGRAMS = Object.freeze([
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_object_semantic_closure_v3.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_object_semantic_closure_v3_runtime.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_object_trajectory_closure_v4.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_object_trajectory_closure_v4_runtime.py",
  "data/ai-painter/system-governance/stage4-mvp-object-semantic-closure-v3-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-object-trajectory-closure-v4-contract.json",
])
const V5_PROGRAMS = Object.freeze([
  ...V4_PROGRAMS,
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_short_trajectory_closure_v5.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_short_trajectory_closure_v5_runtime.py",
  "data/ai-painter/system-governance/stage4-mvp-short-trajectory-closure-v5-contract.json",
])
const V6_PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-denoiser-stage0.mjs",
  V6_WORKER,
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_renderer_v6.py",
  "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_renderer_v6_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_renderer_v6_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-renderer-v6-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-renderer-v6-gpu-qualification-policy.json",
])
const V7_PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-denoiser-stage0.mjs",
  V7_WORKER,
  V6_WORKER,
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_detail_renderer_v7.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_renderer_v6.py",
  "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_detail_renderer_v7_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_detail_renderer_v7_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-detail-renderer-v7-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-detail-renderer-v7-gpu-qualification-policy.json",
])
const V8_PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-denoiser-stage0.mjs",
  V8_WORKER,
  V6_WORKER,
  "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_detail_renderer_v7_stage0.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_detail_renderer_v7.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_renderer_v6.py",
  "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_object_crop_renderer_v8_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_object_crop_renderer_v8_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-object-crop-renderer-v8-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-object-crop-renderer-v8-gpu-qualification-policy.json",
])
const V9_PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-denoiser-stage0.mjs",
  V9_WORKER,
  V8_WORKER,
  V6_WORKER,
  "ml/ai-painter/scripts/train_stage4_mvp_native_rgb_detail_renderer_v7_stage0.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_detail_recovery_renderer_v9.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_object_crop_renderer_v8.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_detail_renderer_v7.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_renderer_v6.py",
  "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_detail_recovery_renderer_v9_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_detail_recovery_renderer_v9_readonly_gpu_qualification.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_detail_renderer_v7_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_recovery_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-detail-recovery-renderer-v9-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-detail-recovery-renderer-v9-gpu-qualification-policy.json",
])
const V10_PROGRAMS = Object.freeze([
  ...V9_PROGRAMS.filter(p => ![V9_WORKER,
    "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_detail_recovery_renderer_v9_cpu.py",
    "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_detail_recovery_renderer_v9_readonly_gpu_qualification.py",
    "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-detail-recovery-renderer-v9-contract.json",
    "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-detail-recovery-renderer-v9-gpu-qualification-policy.json"].includes(p)),
  V10_WORKER,
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10.py",
  "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
  "ml/ai-painter/tests/test_stage4_mvp_aperiodic_detail_v10.py",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-aperiodic-detail-renderer-v10-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-aperiodic-detail-renderer-v10-gpu-qualification-policy.json",
])
const V11_PROGRAMS = Object.freeze([
  "scripts/run-ai-painter-stage4-mvp-denoiser-stage0.mjs",
  V11_WORKER, V6_WORKER,
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_object_context_renderer_v11.py",
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_renderer_v6.py",
  "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_object_context_renderer_v11_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_object_context_renderer_v11_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_context_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_aperiodic_detail_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_recovery_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_detail_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_renderer.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
  "ml/ai-painter/tests/test_stage4_mvp_object_context_cpu_prototype.py",
  "ml/ai-painter/tests/test_stage4_mvp_object_context_v11_contract.py",
  "ml/ai-painter/tests/test_stage4_mvp_object_context_v11_training_entry.py",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-object-context-renderer-v11-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-object-context-renderer-v11-gpu-qualification-policy.json",
])
const V12_PROGRAMS = Object.freeze([
  ...V11_PROGRAMS.filter(value => ![
    V11_WORKER,
    "ml/ai-painter/scripts/check_stage4_mvp_native_rgb_object_context_renderer_v11_cpu.py",
    "ml/ai-painter/scripts/run_stage4_mvp_native_rgb_object_context_renderer_v11_readonly_gpu_qualification.py",
    "data/ai-painter/system-governance/stage4-mvp-native-complete-rgb-object-context-renderer-v11-gpu-qualification-policy.json",
  ].includes(value)),
  V12_WORKER,
  "ml/ai-painter/scripts/ai_painter_stage4_mvp_native_rgb_aperiodic_detail_renderer_v10.py",
  "ml/ai-painter/scripts/check_stage4_mvp_local_texture_v12_cpu.py",
  "ml/ai-painter/scripts/check_stage4_mvp_local_texture_v12_execution_cpu.py",
  "ml/ai-painter/scripts/run_stage4_mvp_local_texture_v12_readonly_gpu_qualification.py",
  "ml/ai-painter/src/ai_painter/complete_world/native_rgb_local_texture_objective_v12.py",
  "ml/ai-painter/tests/test_stage4_mvp_local_texture_objective_v12.py",
  "data/ai-painter/system-governance/stage4-mvp-native-rgb-local-texture-v12-contract.json",
  "data/ai-painter/system-governance/stage4-mvp-native-rgb-local-texture-v12-gpu-qualification-policy.json",
])
const STAGE = Object.freeze({ stage: 0, width: 256, height: 192, epochCount: 40 })
const V9_STAGE = Object.freeze({ stage: 0, width: 256, height: 192, epochCount: 24 })
const RESOURCE_BUDGET = Object.freeze({
  maxGpuMemoryFraction: 0.70,
  maxEpochs: 40,
  maxOptimizerSteps: 1920,
  timeoutSeconds: 43_200,
})
const V8_RESOURCE_BUDGET = Object.freeze({
  maxGpuMemoryFraction: 0.70,
  maxEpochs: 40,
  maxOptimizerSteps: 3840,
  timeoutSeconds: 43_200,
})
const V9_RESOURCE_BUDGET = Object.freeze({
  maxGpuMemoryFraction: 0.70,
  maxEpochs: 24,
  maxOptimizerSteps: 2304,
  timeoutSeconds: 43_200,
})
const V11_RESOURCE_BUDGET = Object.freeze({
  maxGpuMemoryFraction: 0.70,
  maxEpochs: 24,
  maxOptimizerSteps: 1152,
  timeoutSeconds: 43_200,
})


const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  run({
    projectRoot: process.cwd(),
    capabilityVersion: optionalArgument("--capability-version") ?? V2_CAPABILITY,
    datasetManifest: binding(argument("--dataset-manifest"), argument("--dataset-sha256")),
    cpuQualification: binding(argument("--cpu-qualification"), argument("--cpu-sha256")),
    gpuQualification: binding(argument("--gpu-qualification"), argument("--gpu-sha256")),
    verifyOnly: process.argv.includes("--verify-only"),
  }).then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    if (!new Set(["training_completed_review_pending",
      "stage0_preflight_passed_training_not_started"]).has(result.status)) process.exitCode = 2
  }).catch(error => {
    process.stderr.write(String(error.stack ?? error) + "\n")
    process.exitCode = 1
  })
}


export async function run({ projectRoot, datasetManifest, cpuQualification, gpuQualification,
  capabilityVersion = V2_CAPABILITY, verifyOnly = false }) {
  assert(new Set([V2_CAPABILITY, V3_CAPABILITY, V4_CAPABILITY, V5_CAPABILITY, V6_CAPABILITY, V7_CAPABILITY, V8_CAPABILITY, V9_CAPABILITY, V10_CAPABILITY, V11_CAPABILITY, V12_CAPABILITY]).has(capabilityVersion),
    "unsupported Stage4 MVP capability")
  const root = fs.realpathSync(projectRoot)
  const dataset = readBoundJson(root, datasetManifest)
  const cpu = readBoundJson(root, cpuQualification)
  const gpu = readBoundJson(root, gpuQualification)
  validateInputs(root, datasetManifest, dataset, cpuQualification, cpu, gpuQualification, gpu,
    capabilityVersion)
  const programs = (capabilityVersion === V12_CAPABILITY ? V12_PROGRAMS
    : capabilityVersion === V11_CAPABILITY ? V11_PROGRAMS
    : capabilityVersion === V10_CAPABILITY ? V10_PROGRAMS
    : capabilityVersion === V9_CAPABILITY ? V9_PROGRAMS
    : capabilityVersion === V8_CAPABILITY ? V8_PROGRAMS
    : capabilityVersion === V7_CAPABILITY ? V7_PROGRAMS
    : capabilityVersion === V6_CAPABILITY ? V6_PROGRAMS : [
    ...BASE_PROGRAMS,
    ...(capabilityVersion === V3_CAPABILITY ? V3_PROGRAMS : []),
    ...(capabilityVersion === V4_CAPABILITY ? V4_PROGRAMS : []),
    ...(capabilityVersion === V5_CAPABILITY ? V5_PROGRAMS : []),
  ])
    .map(value => bind(root, value))
  const resourceBudget = (capabilityVersion === V11_CAPABILITY || capabilityVersion === V12_CAPABILITY) ? V11_RESOURCE_BUDGET
    : (capabilityVersion === V9_CAPABILITY || capabilityVersion === V10_CAPABILITY) ? V9_RESOURCE_BUDGET
    : capabilityVersion === V8_CAPABILITY ? V8_RESOURCE_BUDGET : RESOURCE_BUDGET
  const stage = (capabilityVersion === V9_CAPABILITY || capabilityVersion === V10_CAPABILITY || capabilityVersion === V11_CAPABILITY || capabilityVersion === V12_CAPABILITY) ? V9_STAGE : STAGE
  if (verifyOnly) {
    const current = await readCurrentExecutionRegistry(root)
    assert.equal(current.ok, true, "current execution registry unavailable")
    assert.equal(current.registry.activeExecution, null, "another execution is active")
    return { status: "stage0_preflight_passed_training_not_started",
      capabilityVersion, stage, resourceBudget, programBindingsVerified: programs.length,
      currentRegistryRevision: current.registry.registryRevision,
      gpuStarted: false, trainingStarted: false }
  }
  const payload = {
    capabilityVersion,
    stage,
    datasetManifest,
    datasetReleaseIdentity: dataset.datasetReleaseIdentity,
    cpuQualification,
    gpuQualification,
    formalInitializationSha256: capabilityVersion === V12_CAPABILITY
      ? gpu.initialModelStateSha256 : gpu.formalInitializationSha256,
    resourceBudget,
    programBindings: programs,
  }
  const runId = `mvp-stage0-${sha(bytes(payload)).slice(0, 48)}`
  const batchRunId = `mvp-stage0-batch-${sha(bytes(payload)).slice(0, 40)}`
  const packageId = `mvp-stage0-package-${sha(bytes(payload)).slice(0, 40)}`
  const executionNamespace = capabilityVersion === V12_CAPABILITY
    ? "stage4-mvp-native-rgb-local-texture-v12-formal-executions"
    : capabilityVersion === V11_CAPABILITY
    ? "stage4-mvp-native-rgb-object-context-renderer-v11-formal-executions"
    : capabilityVersion === V10_CAPABILITY
    ? "stage4-mvp-native-rgb-aperiodic-detail-renderer-v10-formal-executions"
    : capabilityVersion === V9_CAPABILITY
    ? "stage4-mvp-native-rgb-detail-recovery-renderer-v9-formal-executions"
    : capabilityVersion === V8_CAPABILITY
    ? "stage4-mvp-native-rgb-object-crop-renderer-v8-formal-executions"
    : capabilityVersion === V7_CAPABILITY
    ? "stage4-mvp-native-rgb-detail-renderer-v7-formal-executions"
    : capabilityVersion === V6_CAPABILITY
    ? "stage4-mvp-native-rgb-renderer-v6-formal-executions"
    : capabilityVersion === V5_CAPABILITY
    ? "stage4-mvp-short-trajectory-closure-v5-formal-executions"
    : capabilityVersion === V4_CAPABILITY
    ? "stage4-mvp-object-trajectory-closure-v4-formal-executions"
    : capabilityVersion === V3_CAPABILITY
      ? "stage4-mvp-object-closure-v3-formal-executions"
      : "stage4-v2-formal-executions"
  const outputRoot = `.runtime/ai-painter/${executionNamespace}/${batchRunId}/stages/${runId}`
  const outputDirectory = projectFile(root, outputRoot)
  fs.mkdirSync(path.dirname(outputDirectory), { recursive: true })
  fs.mkdirSync(outputDirectory)
  const request = persist(root, `${outputRoot}/execution-package.json`, {
    schemaVersion: capabilityVersion === V12_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-local-texture-v12-formal-stage-execution-package-v1"
      : capabilityVersion === V11_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-object-context-renderer-v11-formal-stage-execution-package-v1"
      : capabilityVersion === V10_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-aperiodic-detail-renderer-v10-formal-stage-execution-package-v1"
      : capabilityVersion === V9_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-detail-recovery-renderer-v9-formal-stage-execution-package-v1"
      : capabilityVersion === V8_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-object-crop-renderer-v8-formal-stage-execution-package-v1"
      : capabilityVersion === V7_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-detail-renderer-v7-formal-stage-execution-package-v1"
      : capabilityVersion === V6_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-renderer-v6-formal-stage-execution-package-v1"
      : capabilityVersion === V5_CAPABILITY
      ? "ai-painter-stage4-mvp-short-trajectory-closure-v5-formal-stage-execution-package-v1"
      : capabilityVersion === V4_CAPABILITY
      ? "ai-painter-stage4-mvp-object-trajectory-closure-v4-formal-stage-execution-package-v1"
      : capabilityVersion === V3_CAPABILITY
        ? "ai-painter-stage4-mvp-object-closure-v3-formal-stage-execution-package-v1"
        : "ai-painter-stage4-v2-formal-stage-execution-package-v1",
    batchRunId, runId, packageId, capabilityVersion, stage,
    parentStage: null,
    outputRoot,
    outputTerminalPath: `${outputRoot}/phase-terminal.json`,
    datasetManifest,
    cpuQualification,
    gpuQualification,
    formalInitializationSha256: capabilityVersion === V12_CAPABILITY
      ? gpu.initialModelStateSha256 : gpu.formalInitializationSha256,
    resourceBudget,
    programBindings: programs,
    permittedSplits: ["train", "validation"],
    forbiddenSplits: ["challenge", "regression"],
    ticketConsumptionRequired: true,
    recordedAtUtc: new Date().toISOString(),
  })
  let active = false
  let timer = null
  try {
    const preflight = persist(root, `${outputRoot}/preflight-terminal.json`, lifecycle(
      { runId, batchRunId, packageId, capabilityVersion }, "preflight_passed_training_not_started", "completed", {
        executionPackage: request, datasetManifest, cpuQualification, gpuQualification,
        gpuStarted: false, trainingStarted: false,
      }))
    await register(root, { runId, packageId, outputRoot, evidence: preflight, programs,
      capabilityVersion, active: true })
    active = true
    timer = setInterval(() => {
      try { updateHeartbeat(root, outputRoot, runId) } catch {}
    }, 10_000)
    const started = persist(root, `${outputRoot}/training-started-terminal.json`, lifecycle(
      { runId, batchRunId, packageId, capabilityVersion }, "formal_stage0_training_started", "completed", {
        executionPackage: request, datasetManifest, cpuQualification, gpuQualification,
        gpuStarted: true, trainingStarted: true,
      }))
    await updateActivity(root, { runId, packageId, outputRoot, evidence: started, programs,
      capabilityVersion, activity: "formal_stage0_256x192_training" })
    const workerOutput = `${outputRoot}/phase-terminal.json`
    await runWorker(root, capabilityVersion, [
      "--execution-package", request.path,
      "--execution-package-sha256", request.sha256,
      "--output", workerOutput,
    ])
    const worker = bind(root, workerOutput)
    const terminal = readBoundJson(root, worker)
    assert.equal(terminal.status, "training_completed_review_pending")
    assert.equal(terminal.completedEpochs, resourceBudget.maxEpochs)
    assert.equal(terminal.optimizerSteps, resourceBudget.maxOptimizerSteps)
    assert.equal(terminal.nonTrainOptimizerSteps, 0)
    verifyBinding(root, terminal.checkpoint)
    const final = persist(root, `${outputRoot}/finalize.json`, lifecycle(
      { runId, batchRunId, packageId, capabilityVersion }, terminal.status, "completed", {
        executionPackage: request, workerTerminal: worker, checkpoint: terminal.checkpoint,
        gpuStarted: true, trainingStarted: true, machineReviewPending: true,
      }))
    clearInterval(timer)
    timer = null
    await register(root, { runId, packageId, outputRoot, evidence: final, programs,
      capabilityVersion, active: false })
    active = false
    return { status: terminal.status, runId, batchRunId, outputRoot, terminal: final }
  } catch (error) {
    if (timer) clearInterval(timer)
    const failure = persist(root, `${outputRoot}/failure.json`, lifecycle(
      { runId, batchRunId, packageId, capabilityVersion }, "formal_stage0_failed_closed", "failed_closed", {
        error: String(error.stack ?? error),
        gpuStarted: fs.existsSync(projectFile(root, `${outputRoot}/training-started-terminal.json`)),
        trainingStarted: fs.existsSync(projectFile(root, `${outputRoot}/training-started-terminal.json`)),
      }))
    if (active) {
      try { await register(root, { runId, packageId, outputRoot, evidence: failure, programs,
        capabilityVersion, active: false }) }
      catch (registryError) {
        persist(root, `${outputRoot}/registry-finalization-failure.json`, {
          status: "failed_closed", error: String(registryError.stack ?? registryError),
          recordedAtUtc: new Date().toISOString(),
        })
      }
    }
    return { status: "failed_closed", runId, batchRunId, outputRoot,
      failure, error: String(error.message ?? error) }
  }
}


function validateInputs(root, datasetBinding, dataset, cpuBinding, cpu, gpuBinding, gpu,
  capabilityVersion) {
  assert.equal(dataset.schemaVersion, "ai-painter-stage4-v2-mvp64-denoiser-dataset-release-v1")
  assert.deepEqual(dataset.splitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(dataset.qualification?.denoiserTrainingAllowed, true)
  assert.equal(dataset.qualification?.trainingAllowed, false)
  if (capabilityVersion === V12_CAPABILITY) {
    const contract = readBoundJson(root, cpu.contract)
    const policy = readBoundJson(root, gpu.policy)
    const feasibility = readBoundJson(root, cpu.feasibility)
    verifyBinding(root, cpu.program)
    verifyBinding(root, policy.program)
    assert.equal(contract.capabilityVersion, V12_CAPABILITY)
    assert.deepEqual(contract.datasetManifest, { ...datasetBinding, splitCounts: dataset.splitCounts })
    assert.equal(feasibility.status, "cpu_feasibility_passed_not_gpu_or_training_qualified")
    assert.deepEqual(feasibility.contract, cpu.contract)
    assert.equal(policy.status, "active_single_readonly_qualification")
    assert.equal(policy.capabilityVersion, V12_CAPABILITY)
    assert.deepEqual(policy.candidateContract, cpu.contract)
    assert.deepEqual(policy.cpuExecutionPreflight, cpuBinding)
    assert.equal(policy.execution?.maxGpuMemoryFraction, 0.7)
    assert.equal(policy.execution?.trainingAllowed, false)
    assert.equal(cpu.status, "cpu_execution_preflight_passed_training_still_disabled")
    assert.equal(cpu.capabilityVersion, V12_CAPABILITY)
    assert.deepEqual(cpu.datasetManifest, { ...datasetBinding, splitCounts: dataset.splitCounts })
    assert.equal(cpu.modelStateUnchanged, true)
    assert.equal(cpu.optimizerSteps, 0)
    assert.equal(cpu.trainingStarted, false)
    assert.equal(gpu.status, "readonly_gpu_qualification_passed_training_still_disabled")
    assert.equal(gpu.capabilityVersion, V12_CAPABILITY)
    assert.deepEqual(gpu.datasetManifest, { ...datasetBinding, splitCounts: dataset.splitCounts })
    assert.deepEqual(gpu.cpuExecutionPreflight, cpuBinding)
    assert.deepEqual(gpu.candidateContract, cpu.contract)
    assert.equal(gpu.trainingAllowedByThisArtifact, false)
    assert.equal(gpu.optimizerSteps, 0)
    assert.equal(gpu.weightsModified, false)
    assert.equal(gpu.trainingStarted, false)
    assert.equal(gpu.initialModelStateSha256, cpu.initialModelStateSha256)
    return
  }
  if (capabilityVersion === V11_CAPABILITY) {
    assert.equal(cpu.status, "cpu_contract_passed_training_still_disabled")
    assert.equal(cpu.capabilityVersion, V11_CAPABILITY)
    assert.deepEqual(cpu.dataset, { ...datasetBinding, splitCounts: dataset.splitCounts })
    assert.equal(cpu.stateUnchanged, true)
    assert.equal(cpu.trainingStarted, false)
    assert.equal(gpu.status, "readonly_gpu_qualification_passed")
    assert.equal(gpu.capabilityVersion, V11_CAPABILITY)
    assert.deepEqual(gpu.datasetManifest, datasetBinding)
    assert.deepEqual(gpu.cpuQualification, cpuBinding)
    assert.equal(gpu.trainingAllowedByThisArtifact, false)
    assert.equal(gpu.optimizerSteps, 0)
    assert.equal(gpu.weightsModified, false)
    assert.equal(gpu.trainingStarted, false)
    assert.match(gpu.formalInitializationSha256, /^[a-f0-9]{64}$/u)
    return
  }
  if (capabilityVersion === V6_CAPABILITY || capabilityVersion === V7_CAPABILITY || capabilityVersion === V8_CAPABILITY || capabilityVersion === V9_CAPABILITY || capabilityVersion === V10_CAPABILITY) {
    assert.equal(cpu.status, "cpu_contract_passed_training_still_disabled")
    assert.equal(cpu.capabilityVersion, capabilityVersion)
    assert.deepEqual(cpu.dataset, { ...datasetBinding, splitCounts: dataset.splitCounts })
    assert.equal(cpu.stateUnchanged, true)
    assert.equal(cpu.trainingStarted, false)
    assert.equal(gpu.status, "readonly_gpu_qualification_passed")
    assert.equal(gpu.capabilityVersion, capabilityVersion)
    assert.deepEqual(gpu.datasetManifest, datasetBinding)
    assert.deepEqual(gpu.cpuQualification, cpuBinding)
    assert.equal(gpu.trainingAllowedByThisArtifact, true)
    assert.equal(gpu.optimizerSteps, 0)
    assert.equal(gpu.weightsModified, false)
    assert.match(gpu.formalInitializationSha256, /^[a-f0-9]{64}$/u)
    return
  }
  assert.equal(cpu.status, "cpu_preflight_passed")
  assert.equal(cpu.capabilityVersion ?? V2_CAPABILITY, capabilityVersion)
  assert.deepEqual(cpu.datasetManifest, datasetBinding)
  assert.equal(gpu.status, "readonly_gpu_qualification_passed")
  assert.equal(gpu.capabilityVersion ?? V2_CAPABILITY, capabilityVersion)
  assert.deepEqual(gpu.datasetManifest, datasetBinding)
  assert.deepEqual(gpu.cpuPreflight, cpuBinding)
  assert.equal(gpu.trainingAllowedByThisArtifact, true)
  assert.equal(gpu.optimizerSteps, 0)
  assert.equal(gpu.weightsModified, false)
}


async function runWorker(root, capabilityVersion, args) {
  const executable = projectFile(root, "ml/ai-painter/.venv/Scripts/python.exe")
  const worker = capabilityVersion === V12_CAPABILITY ? V12_WORKER
    : capabilityVersion === V11_CAPABILITY ? V11_WORKER
    : capabilityVersion === V10_CAPABILITY ? V10_WORKER
    : capabilityVersion === V9_CAPABILITY ? V9_WORKER
    : capabilityVersion === V8_CAPABILITY ? V8_WORKER
    : capabilityVersion === V7_CAPABILITY ? V7_WORKER
    : capabilityVersion === V6_CAPABILITY ? V6_WORKER : WORKER
  return execFileAsync(executable, ["-B", projectFile(root, worker), ...args], {
    cwd: root, windowsHide: true, timeout: RESOURCE_BUDGET.timeoutSeconds * 1000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1", PYTHONPATH: path.join(root, "ml/ai-painter/src") },
  })
}


async function register(root, { runId, packageId, outputRoot, evidence, programs,
  capabilityVersion, active }) {
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true, "current execution registry unavailable")
  if (active) assert.equal(current.registry.activeExecution, null, "another execution is active")
  else assert.equal(current.registry.activeExecution?.runId, runId, "active execution ownership changed")
  let activeExecution = null
  if (active) {
    const identity = { capabilityVersion, packageId, runId,
      processId: process.pid, processStartIdentity: processIdentity(process.pid) }
    const lock = persist(root, `${outputRoot}/execution-lock.json`, {
      schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity,
    })
    persist(root, `${outputRoot}/heartbeat.json`, {
      schemaVersion: "ai-painter-current-active-execution-heartbeat-v1", ...identity,
      executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120,
    })
    activeExecution = {
      schemaVersion: "ai-painter-current-active-execution-v1", ...identity,
      executionState: "executing",
      programLineage: Object.fromEntries(programs.map((entry, index) => [`program${index + 1}`, entry])),
      lock, heartbeat: { path: `${outputRoot}/heartbeat.json`, ttlSeconds: 120 },
    }
  }
  const capsule = persist(root, `${outputRoot}/${active ? "begin" : "finish"}-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind: lifecycleKind(capabilityVersion), sha256Verified: true }],
  })
  const terminal = readBoundJson(root, evidence)
  const result = await advanceCurrentExecutionRegistry({
    projectRoot: root, capabilityVersion, packageId, taskId: runId,
    taskKind: taskKind(capabilityVersion),
    taskGoal: taskGoal(capabilityVersion),
    priority: 5, queueStatus: active ? "running" : terminal.executionState === "completed" ? "completed" : "failed_closed",
    nextMachineAction: active ? null : terminal.status === "training_completed_review_pending" ? "run_stage0_machine_review" : null,
    queuedAtUtc: new Date().toISOString(), runId, lifecycleStage: "stage0_256x192",
    executionState: active ? "executing" : terminal.executionState,
    activity: active ? "formal_stage0_preflight" : terminal.status,
    taskCapsulePath: capsule.path, terminalEvidencePath: evidence.path,
    latestTrainingTerminal: active ? undefined : { runId, path: evidence.path, sha256: evidence.sha256,
      status: terminal.status, evidence: {} }, activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true, "registry update failed")
}


async function updateActivity(root, { runId, packageId, outputRoot, evidence, programs,
  capabilityVersion, activity }) {
  const current = await readCurrentExecutionRegistry(root)
  assert.equal(current.ok, true)
  assert.equal(current.registry.activeExecution?.runId, runId)
  const capsule = persist(root, `${outputRoot}/training-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: runId,
    integrity: { status: "verified" },
    evidence: [{ ...evidence, kind: trainingKind(capabilityVersion), sha256Verified: true }],
  })
  const activeExecution = { ...current.registry.activeExecution, executionState: "executing",
    programLineage: Object.fromEntries(programs.map((entry, index) => [`program${index + 1}`, entry])) }
  const result = await advanceCurrentExecutionRegistry({
    projectRoot: root, capabilityVersion, packageId, taskId: runId,
    taskKind: taskKind(capabilityVersion),
    taskGoal: taskGoal(capabilityVersion),
    priority: 5, queueStatus: "running", nextMachineAction: null,
    queuedAtUtc: current.registry.queuedAtUtc, runId, lifecycleStage: "stage0_256x192",
    executionState: "executing", activity,
    taskCapsulePath: capsule.path, terminalEvidencePath: evidence.path, activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision,
    expectedPreviousRegistrySha256: current.registrySha256,
  })
  assert.equal(result.ok, true)
}


function updateHeartbeat(root, outputRoot, runId) {
  const target = projectFile(root, `${outputRoot}/heartbeat.json`)
  const value = JSON.parse(fs.readFileSync(target, "utf8"))
  assert.equal(value.runId, runId)
  assert.equal(value.processId, process.pid)
  value.heartbeatAtUtc = new Date().toISOString()
  writeJsonAtomic(target, value)
}


function processIdentity(pid) {
  const command = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $p){exit 3}; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", windowsHide: true, timeout: 10_000,
  }).trim()
}


function lifecycle(identity, status, executionState, extra = {}) {
  return { schemaVersion: identity.capabilityVersion === V12_CAPABILITY
      ? "ai-painter-stage4-mvp-stage0-training-lifecycle-v1"
      : identity.capabilityVersion === V11_CAPABILITY
      ? "ai-painter-stage4-mvp-stage0-training-lifecycle-v1"
      : identity.capabilityVersion === V10_CAPABILITY
      ? "ai-painter-stage4-mvp-stage0-training-lifecycle-v1"
      : identity.capabilityVersion === V9_CAPABILITY
      ? "ai-painter-stage4-mvp-stage0-training-lifecycle-v1"
      : identity.capabilityVersion === V8_CAPABILITY
      ? "ai-painter-stage4-mvp-stage0-training-lifecycle-v1"
      : identity.capabilityVersion === V7_CAPABILITY
      ? "ai-painter-stage4-mvp-stage0-training-lifecycle-v1"
      : identity.capabilityVersion === V6_CAPABILITY
      ? "ai-painter-stage4-mvp-native-rgb-renderer-v6-stage0-lifecycle-v1"
      : "ai-painter-stage4-mvp-denoiser-stage0-lifecycle-v1",
    ...identity, stage: (identity.capabilityVersion === V9_CAPABILITY || identity.capabilityVersion === V10_CAPABILITY || identity.capabilityVersion === V11_CAPABILITY || identity.capabilityVersion === V12_CAPABILITY) ? V9_STAGE : STAGE,
    executionState, status, recordedAtUtc: new Date().toISOString(), ...extra }
}
function nativeRgbCapability(capabilityVersion) { return capabilityVersion === V6_CAPABILITY || capabilityVersion === V7_CAPABILITY || capabilityVersion === V8_CAPABILITY || capabilityVersion === V9_CAPABILITY || capabilityVersion === V10_CAPABILITY || capabilityVersion === V11_CAPABILITY || capabilityVersion === V12_CAPABILITY }
function taskKind(capabilityVersion) { return nativeRgbCapability(capabilityVersion) ? "formal_stage0_256x192_native_rgb_training" : "formal_stage0_256x192_denoiser_training" }
function taskGoal(capabilityVersion) { return nativeRgbCapability(capabilityVersion) ? "Train the local Stage4 MVP native complete RGB renderer at 256x192 on the exact qualified train split and select only with validation" : "Train the local Stage4 MVP Denoiser at 256x192 on the exact qualified train split and select only with validation" }
function lifecycleKind(capabilityVersion) { return nativeRgbCapability(capabilityVersion) ? "mvp_native_rgb_stage0_lifecycle" : "mvp_denoiser_stage0_lifecycle" }
function trainingKind(capabilityVersion) { return nativeRgbCapability(capabilityVersion) ? "mvp_native_rgb_stage0_training_started" : "mvp_denoiser_stage0_training_started" }
function argument(name) { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`); return process.argv[index + 1] }
function optionalArgument(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
function binding(filePath, sha256) { assert.equal(typeof filePath, "string"); assert.match(sha256, /^[a-f0-9]{64}$/u); return { path: filePath.replaceAll("\\", "/"), sha256 } }
function projectFile(root, logical) { assert.equal(typeof logical, "string"); assert(logical && !logical.includes("\\") && !path.isAbsolute(logical)); const target = path.resolve(root, logical); assert(target.startsWith(root + path.sep)); return target }
function bytes(value) { return Buffer.from(JSON.stringify(value), "utf8") }
function sha(value) { return crypto.createHash("sha256").update(value).digest("hex") }
function hashFile(target) { return sha(fs.readFileSync(target)) }
function bind(root, logical) { const target = projectFile(root, logical); assert(fs.statSync(target).isFile(), "bound path is not a file: " + logical); return { path: logical, sha256: hashFile(target) } }
function verifyBinding(root, value) { assert.deepEqual(bind(root, value.path), value, "bound file changed: " + value.path) }
function readBoundJson(root, value) { verifyBinding(root, value); return JSON.parse(fs.readFileSync(projectFile(root, value.path), "utf8")) }
function persist(root, logical, value) { const target = projectFile(root, logical); fs.mkdirSync(path.dirname(target), { recursive: true }); writeJsonAtomic(target, value); return bind(root, logical) }
function writeJsonAtomic(target, value) { const staged = target + `.staged-${process.pid}`; fs.writeFileSync(staged, JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); fs.renameSync(staged, target) }
