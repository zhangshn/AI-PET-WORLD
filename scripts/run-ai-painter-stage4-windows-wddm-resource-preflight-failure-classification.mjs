import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  ensureAiPainterProgramEventCommitted,
  formatShanghai,
  projectPath,
  verifyAiPainterProgramEventCommitted,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  indexArtifact,
  openStorageCatalog,
} from "./lib/ai-pet-world-storage-catalog.mjs"
import { catalogPath, logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  finalizePreparedCurrentExecutionRegistryAdvance,
  prepareCurrentExecutionRegistryAdvance,
  readCurrentExecutionRegistry,
  recoverPreparedCurrentExecutionRegistryAdvance,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "full-backbone-spatial-affine-readonly-gpu-20260829-022348295-bd7c317d"
const CAPABILITY = "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1"
const CURRENT_TASK = "classify_stage4_full_backbone_spatial_affine_readonly_gpu_failure"
const NEXT_TASK = "qualify_stage4_full_backbone_spatial_affine_readonly_gpu_after_wddm_correction"
const CLASSIFICATION = "wddm_resource_preflight_process_classification_defect_confirmed_and_corrected"
const RUN_ID = newRunId()
const PYTHON = inside("ml/ai-painter/.venv/Scripts/python.exe")
const OUTPUT_PARENT = inside(".runtime/ai-painter/stage4-windows-wddm-resource-preflight-failure-classifications")
const OUTPUT_ROOT = path.join(OUTPUT_PARENT, RUN_ID)
const TRANSACTION_PARENT = inside(".runtime/ai-painter/stage4-windows-wddm-resource-preflight-failure-classification-transactions")
const TRANSACTION_ROOT = path.join(TRANSACTION_PARENT, RUN_ID)
const TRANSACTION_JOURNAL = path.join(TRANSACTION_ROOT, "transaction.json")
const STAGED_PLAN = path.join(TRANSACTION_ROOT, "next-plan.md")
const COMMAND_TIMEOUT_MS = 30_000

const FILES = Object.freeze({
  registry: inside(".runtime/ai-painter/current-execution-registry/current.json"),
  plan: inside("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
  sourceFormalTerminal: inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-failures/${SOURCE_RUN_ID}/phase-terminal.json`),
  sourceGateFailure: inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${SOURCE_RUN_ID}/failure-report.json`),
  sourceResourcePreflight: inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${SOURCE_RUN_ID}/resource-preflight.json`),
  sourceCudaPreflight: inside(`.runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts/${SOURCE_RUN_ID}/python-cuda-preflight.json`),
  gate: inside("ml/ai-painter/scripts/execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate.py"),
  gateTest: inside("ml/ai-painter/tests/test_stage4_full_backbone_spatial_affine_readonly_gpu_gate.py"),
  gpuRunner: inside("ml/ai-painter/scripts/run_stage4_full_backbone_spatial_affine_readonly_gpu_qualification.py"),
  gpuRunnerTest: inside("ml/ai-painter/tests/test_stage4_full_backbone_spatial_affine_readonly_gpu_runner.py"),
  cpuChecker: inside("ml/ai-painter/scripts/check_stage4_full_backbone_spatial_affine_cpu.py"),
  eventStore: inside("scripts/lib/ai-painter-program-event-store.mjs"),
  registryHelper: inside("src/server/ai-painter-current-execution-registry.mjs"),
  runner: inside("scripts/run-ai-painter-stage4-windows-wddm-resource-preflight-failure-classification.mjs"),
  test: inside("scripts/tests/test-ai-painter-stage4-windows-wddm-resource-preflight-failure-classification.mjs"),
})

const EXPECTED = Object.freeze({
  registry: "d4599399d435b51230c4dd437543526193de516f0b6f669c30821e27bfefdd45",
  plan: "116984a779cc35edf45622d57eaf25d00cee59cd5f1a805ecbe4255af47b568b",
  sourceFormalTerminal: "821ac370d743666c290181068da89f0c241bd083a0af86a0c41b56508036e39f",
  sourceGateFailure: "72ba92a0d90e20da664b0ca8f02c505cdbd8d825fbcabb1b49da4f87f2e25856",
  sourceResourcePreflight: "345a3fb4531248ad37b94c21e7cbc1670fe32c69375a7947cd24f0c34b3a073e",
  sourceCudaPreflight: "ba6a908d520576ce2366beb04ccb532fcf9f3620a7e138d31bc8b623f64b7851",
  gate: "60ee0cf985528f87e1c1103f94eb31c12f97cb7156d90e5f21e6f3203da29701",
  gateTest: "ea20fe7f3d92110205397b550496cf69ec18777d969a2fbb57e6337fb525a9fe",
  gpuRunner: "13fc06d06c361fe2a7a7501656b129571730fd89ae8e8f098f96a68704622682",
  gpuRunnerTest: "b8166dcdc0a918591cad4d357c7fb8538d0cca716f2376efcc66cfe14b12a9d0",
  cpuChecker: "ec66dd52085d07540ecae4b8d9ff56b621ad01ad6ac43512beb7290ba7fe6de6",
  eventStore: "d86c8e363802b3b912ff0aa44312ed2738ac6580d7437cc320cabc244a8f6dca",
  registryHelper: "e7a58f1fab2d435263fa6fd3aaa94365f5452c5cd29558041128407c3be16e52",
})
const DYNAMIC_PROGRAM_FREEZE = Object.freeze({
  runner: sha(FILES.runner),
  test: sha(FILES.test),
})

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  main().catch((error) => {
    recordFailure(error)
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}

async function main() {
  const recovered = await recoverIncompleteTransactions()
  if (recovered.length > 0) {
    process.stdout.write(`${JSON.stringify({
      status: "recovered_wddm_failure_classification_transaction",
      recovered,
      ownerAuthorizationRequired: false,
      gpuStarted: false,
      qualificationReplayed: false,
    }, null, 2)}\n`)
    return
  }
  verifyFrozenInputs()
  await verifyRegistry()
  assert.equal(fs.existsSync(OUTPUT_ROOT), false, "classification output reuse is forbidden")
  assert.equal(fs.existsSync(TRANSACTION_ROOT), false, "classification transaction reuse is forbidden")
  fs.mkdirSync(OUTPUT_PARENT, { recursive: true })
  fs.mkdirSync(OUTPUT_ROOT, { recursive: false })
  fs.mkdirSync(TRANSACTION_PARENT, { recursive: true })
  fs.mkdirSync(TRANSACTION_ROOT, { recursive: false })

  const syntax = runNodeCheck()
  const tests = runMockTests()
  verifyFrozenInputs()
  const formalValidation = runFormalCpuValidation()
  verifyFrozenInputs()
  const diagnostics = collectWddmDiagnostics()
  const formalTerminal = read(FILES.sourceFormalTerminal)
  const gateFailure = read(FILES.sourceGateFailure)
  const resourcePreflight = read(FILES.sourceResourcePreflight)
  const cudaPreflight = read(FILES.sourceCudaPreflight)
  const classification = classifyWddmResourcePreflightFailure({
    formalTerminal,
    gateFailure,
    resourcePreflight,
    cudaPreflight,
    diagnostics,
    correctedResourcePreflight: formalValidation.correctedResourcePreflight,
  })
  const journal = prepareArtifacts({
    syntax,
    tests,
    formalValidation,
    diagnostics,
    classification,
  })
  const completed = await completeTransaction(journal, TRANSACTION_JOURNAL)
  process.stdout.write(`${JSON.stringify({
    status: completed.resultStatus,
    runId: completed.runId,
    sourceRunId: SOURCE_RUN_ID,
    classification: CLASSIFICATION,
    terminal: completed.terminal,
    registrySha256: completed.registryCommit.registrySha256,
    nextLegalAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    qualificationReplayed: false,
    trainingStarted: false,
  }, null, 2)}\n`)
}

function verifyFrozenInputs() {
  for (const [role, expected] of Object.entries(EXPECTED)) {
    assert.equal(fs.existsSync(FILES[role]), true, `${role} is missing`)
    assert.equal(sha(FILES[role]), expected, `${role} SHA-256 mismatch`)
  }
  for (const role of ["runner", "test"]) assert.equal(fs.existsSync(FILES[role]), true, `${role} is missing`)
  verifyDynamicPrograms()
}

function verifyDynamicPrograms() {
  for (const [role, expected] of Object.entries(DYNAMIC_PROGRAM_FREEZE)) {
    assert.equal(fs.existsSync(FILES[role]), true, `${role} is missing`)
    assert.equal(sha(FILES[role]), expected, `${role} changed after module freeze`)
  }
}

async function verifyRegistry() {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, EXPECTED.registry)
  assert.equal(current.registry.registryRevision, 43)
  assert.equal(current.registry.eventSequence, 43)
  assert.equal(current.registry.capabilityVersion, CAPABILITY)
  assert.equal(current.registry.taskId, CURRENT_TASK)
  assert.equal(current.registry.taskKind, "readonly_gpu_failure_classification")
  assert.equal(current.registry.runId, SOURCE_RUN_ID)
  assert.equal(current.registry.activeExecution, null)
  assert.equal(current.registry.terminalEvidence.sha256, EXPECTED.sourceFormalTerminal)
  return current
}

function collectWddmDiagnostics() {
  assert.equal(process.platform, "win32", "WDDM classifier is Windows-only")
  const driverModel = runReadOnlyCommand("nvidia-smi", [
    "--query-gpu=driver_model.current",
    "--format=csv,noheader",
  ], "NVIDIA driver model").trim()
  const gpuLine = runReadOnlyCommand("nvidia-smi", [
    "--query-gpu=utilization.gpu,memory.used,memory.free,memory.total",
    "--format=csv,noheader,nounits",
  ], "GPU snapshot").trim()
  const pmon = runReadOnlyCommand("nvidia-smi", ["pmon", "-c", "1"], "NVIDIA pmon", { allowEmpty: true })
  const compute = runReadOnlyCommand("nvidia-smi", [
    "--query-compute-apps=pid,process_name,used_gpu_memory",
    "--format=csv,noheader,nounits",
  ], "NVIDIA compute applications", { allowEmpty: true })
  const pmonProcesses = parsePmon(pmon)
  const computeApplications = parseComputeApplications(compute)
  const observedProcessIds = [...new Set([
    ...pmonProcesses.map((item) => item.processId),
    ...computeApplications.map((item) => item.processId),
  ].filter((processId) => Number.isInteger(processId) && processId > 0))].sort((left, right) => left - right)
  let processValue = []
  let wmiResolutionStatus = "not_required"
  if (observedProcessIds.length > 0) {
    const powershell = [
      "$ErrorActionPreference='Stop'",
      `$targetPids=@(${observedProcessIds.join(",")})`,
      "$p=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop | Where-Object { $targetPids -contains [int]$_.ProcessId } | Select-Object ProcessId,Name,ExecutablePath,CommandLine)",
      "ConvertTo-Json -InputObject @($p) -Compress -Depth 4",
    ].join("; ")
    const processJson = runReadOnlyCommand("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      powershell,
    ], "WDDM process identity")
    processValue = JSON.parse(processJson.replace(/^\uFEFF/u, ""))
    wmiResolutionStatus = "completed"
  }
  const gpuParts = gpuLine.split(",").map((part) => Number(part.trim()))
  assert.equal(gpuParts.length, 4)
  assert.equal(gpuParts.every(Number.isFinite), true)
  const processIdentities = (Array.isArray(processValue) ? processValue : [processValue])
    .filter((item) => item !== null)
    .map((item) => ({
      processId: Number(item.ProcessId),
      name: item.Name,
      executablePath: item.ExecutablePath ?? null,
      commandLine: item.CommandLine ?? null,
    }))
    .sort((left, right) => left.processId - right.processId)
  const coveredProcessIds = new Set(processIdentities.map((item) => item.processId))
  const missingProcessIds = observedProcessIds.filter((processId) => !coveredProcessIds.has(processId))
  return {
    schemaVersion: "stage4-windows-wddm-resource-classifier-diagnostic-v1",
    status: "completed",
    driverModel,
    gpu: {
      utilizationPercent: gpuParts[0],
      usedMemoryMiB: gpuParts[1],
      freeMemoryMiB: gpuParts[2],
      totalMemoryMiB: gpuParts[3],
    },
    pmonProcesses,
    computeApplications,
    observedProcessIds,
    processIdentities,
    missingProcessIds,
    wmiResolution: {
      status: wmiResolutionStatus,
      requestedProcessCount: observedProcessIds.length,
      resolvedProcessCount: processIdentities.length,
    },
    commandsAreReadOnly: true,
    gpuWorkloadStarted: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

export function parsePmon(source) {
  return String(source).split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const fields = line.split(/\s+/u)
      assert.ok(fields.length >= 10, `invalid pmon row: ${line}`)
      return {
        gpuIndex: Number(fields[0]),
        processId: Number(fields[1]),
        processType: fields[2],
        command: fields.slice(9).join(" "),
        raw: line,
      }
    })
}

export function parseComputeApplications(source) {
  return String(source).split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const first = line.indexOf(",")
      const last = line.lastIndexOf(",")
      assert.ok(first > 0 && last > first)
      return {
        processId: Number(line.slice(0, first).trim()),
        processName: line.slice(first + 1, last).trim(),
        usedMemory: line.slice(last + 1).trim(),
        raw: line,
      }
    })
}

export function classifyWddmResourcePreflightFailure({
  formalTerminal,
  gateFailure,
  resourcePreflight,
  cudaPreflight,
  diagnostics,
  correctedResourcePreflight,
}) {
  assert.equal(formalTerminal.executionState, "completed")
  assert.equal(formalTerminal.qualificationExecutionState, "failed_closed")
  assert.equal(formalTerminal.runId, SOURCE_RUN_ID)
  assert.equal(formalTerminal.ownerAuthorizationRequired, false)
  assert.equal(formalTerminal.optimizerCreated, false)
  assert.equal(formalTerminal.backwardExecuted, false)
  assert.equal(formalTerminal.trainingStarted, false)
  assert.equal(gateFailure.status, "failed_closed")
  assert.equal(gateFailure.runId, SOURCE_RUN_ID)
  assert.equal(gateFailure.failedStep, "resource_preflight")
  assert.equal(gateFailure.error, "preflight_failed:gpu_compute_process_present")
  assert.equal(resourcePreflight.status, "failed")
  assert.deepEqual(resourcePreflight.blockers, ["gpu_compute_process_present"])
  assert.equal(resourcePreflight.gpuWorkloadStarted, false)
  assert.equal(cudaPreflight.status, "passed")
  assert.equal(cudaPreflight.details?.cudaAvailable, true)
  assert.ok(cudaPreflight.details?.cudaDeviceCount >= 1)
  assert.equal(cudaPreflight.gpuWorkloadStarted, false)

  const original = resourcePreflight.gpu
  const limits = resourcePreflight.limits
  assert.equal(original.utilizationPercent, 3)
  assert.equal(original.usedMemoryMiB, 1213)
  assert.equal(original.freeMemoryMiB, 6699)
  assert.equal(original.totalMemoryMiB, 8151)
  assert.equal(original.computeProcesses.length, 26, "historical immutable process count changed")
  assert.ok(original.computeProcesses.includes("1888, [Insufficient Permissions], [N/A]"))
  assert.ok(original.computeProcesses.includes("25688, [Insufficient Permissions], [N/A]"))
  assert.ok(original.utilizationPercent <= limits.maximumIdleGpuUtilizationPercent)
  assert.ok(original.usedMemoryMiB <= limits.maximumNonqualificationGpuMemoryMiB)
  assert.ok(original.freeMemoryMiB >= limits.minimumFreeGpuMemoryMiB)
  assert.ok(original.computeProcesses.length > 0)
  assert.equal(original.computeProcesses.every((line) => line.endsWith("[N/A]")), true)
  assert.equal(original.computeProcesses.some((line) => /python/i.test(line)), false)

  assert.equal(diagnostics.status, "completed")
  assert.equal(diagnostics.driverModel.trim().toUpperCase(), "WDDM")
  assert.equal(diagnostics.pmonProcesses.every((item) => item.processType === "C+G"), true)
  assert.equal(diagnostics.pmonProcesses.some((item) => /python/i.test(item.command)), false)
  assert.equal(diagnostics.computeApplications.every((item) => item.usedMemory === "[N/A]"), true)
  assert.equal(diagnostics.computeApplications.some((item) => /python/i.test(item.processName)), false)
  validateDynamicProcessCoverage(diagnostics)
  assert.equal(
    diagnostics.wmiResolution?.status,
    diagnostics.observedProcessIds.length === 0 ? "not_required" : "completed",
  )
  assert.equal(diagnostics.commandsAreReadOnly, true)
  assert.equal(diagnostics.gpuWorkloadStarted, false)

  assert.equal(correctedResourcePreflight.status, "passed")
  assert.deepEqual(correctedResourcePreflight.blockers, [])
  assert.equal(correctedResourcePreflight.gpuWorkloadStarted, false)
  assert.equal(
    correctedResourcePreflight.gpu?.processClassificationContract,
    "windows_wddm_pmon_wmi_compute_conflict_v1",
  )
  assert.equal(Number.isInteger(correctedResourcePreflight.gpu?.safeWddmGraphicsProcessCount), true)
  assert.ok(correctedResourcePreflight.gpu.safeWddmGraphicsProcessCount >= 0)
  assert.equal(correctedResourcePreflight.gpu?.conflictingComputeProcessCount, 0)
  assert.ok(
    correctedResourcePreflight.gpu?.utilizationPercent
      <= correctedResourcePreflight.limits?.maximumIdleGpuUtilizationPercent,
  )
  assert.ok(
    correctedResourcePreflight.gpu?.usedMemoryMiB
      <= correctedResourcePreflight.limits?.maximumNonqualificationGpuMemoryMiB,
  )
  assert.ok(
    correctedResourcePreflight.gpu?.freeMemoryMiB
      >= correctedResourcePreflight.limits?.minimumFreeGpuMemoryMiB,
  )

  return {
    schemaVersion: "stage4-windows-wddm-resource-preflight-failure-classification-v1",
    status: "classified",
    sourceRunId: SOURCE_RUN_ID,
    classification: CLASSIFICATION,
    modelFailureConfirmed: false,
    gpuCapabilityFailureConfirmed: false,
    cudaCapabilityAvailable: true,
    defectBoundary: "nvidia_smi_compute_apps_wddm_graphics_processes_were_treated_as_cuda_compute_blockers",
    causalFacts: {
      failureOccurredBeforeGpuWorkload: true,
      driverModelIsWddm: true,
      allPmonProcessesAreCombinedGraphicsContexts: true,
      computeQueryMemoryIsUnavailableForEveryEntry: true,
      noPythonProcessPresent: true,
      historicalUnresolvedPidsRemainBoundToImmutableFailureEvidence: true,
      currentProcessIdentitiesWereDynamicallyResolvedWithoutHistoricalPidAssumptions: true,
      utilizationWithinIdleLimit: true,
      memoryWithinResourceLimits: true,
    },
    correctionImplementedAndCpuVerified: true,
    correctedProcessClassificationContract: "windows_wddm_pmon_wmi_compute_conflict_v1",
    onlyLegalNextAction: NEXT_TASK,
    automaticQualificationReplayAllowed: false,
    controlledSmokeAdmissionAllowed: false,
    ownerAuthorizationRequired: false,
  }
}

export function validateDynamicProcessCoverage(diagnostics) {
  const expected = [...new Set([
    ...diagnostics.pmonProcesses.map((item) => item.processId),
    ...diagnostics.computeApplications.map((item) => item.processId),
  ])].sort((left, right) => left - right)
  assert.deepEqual(diagnostics.observedProcessIds, expected)
  assert.equal(diagnostics.processIdentities.length, expected.length)
  const actual = diagnostics.processIdentities.map((item) => item.processId).sort((left, right) => left - right)
  assert.deepEqual(actual, expected)
  assert.deepEqual(diagnostics.missingProcessIds, [])
  assert.equal(diagnostics.processIdentities.every((item) => typeof item.name === "string" && item.name.trim() !== ""), true)
  const identityByPid = new Map(diagnostics.processIdentities.map((item) => [item.processId, item]))
  for (const pmon of diagnostics.pmonProcesses) {
    const identity = identityByPid.get(pmon.processId)
    assert.notEqual(identity, undefined, `pmon PID ${pmon.processId} lacks WMI identity`)
    const pmonName = normalizeProcessName(pmon.command)
    const wmiName = normalizeProcessName(identity.name)
    assert.ok(pmonName.length > 0, `pmon PID ${pmon.processId} has no usable process name`)
    assert.ok(wmiName.length > 0, `WMI PID ${pmon.processId} has no usable process name`)
    assert.ok(
      pmonName.startsWith(wmiName) || wmiName.startsWith(pmonName),
      `PID ${pmon.processId} changed identity between pmon and WMI`,
    )
  }
  return true
}

function normalizeProcessName(value) {
  const basename = String(value ?? "").replace(/\\/gu, "/").split("/").at(-1) ?? ""
  return basename.toLowerCase().replace(/\.exe$/u, "").replace(/[^a-z0-9]+/gu, "")
}

function prepareArtifacts({ syntax, tests, formalValidation, diagnostics, classification }) {
  const recordedAtUtc = new Date().toISOString()
  const commitMarkerPath = path.join(OUTPUT_ROOT, "transaction-commit-marker.json")
  const outputs = {
    freeze: path.join(OUTPUT_ROOT, "input-and-program-freeze.json"),
    diagnostic: path.join(OUTPUT_ROOT, "wddm-resource-diagnostic.json"),
    correctedResourcePreflight: path.join(OUTPUT_ROOT, "corrected-resource-preflight.json"),
    cpuValidation: path.join(OUTPUT_ROOT, "cpu-correction-validation.json"),
    classification: path.join(OUTPUT_ROOT, "failure-classification.json"),
    correction: path.join(OUTPUT_ROOT, "resource-classifier-correction-action.json"),
    nextAction: path.join(OUTPUT_ROOT, "local-next-action.json"),
    planSync: path.join(OUTPUT_ROOT, "plan-sync-record.json"),
    terminal: path.join(OUTPUT_ROOT, "phase-terminal.json"),
    capsule: path.join(OUTPUT_ROOT, "local-task-capsule.json"),
  }
  const receipt = path.join(OUTPUT_ROOT, "plan-commit-receipt.json")
  writeExclusive(outputs.freeze, {
    schemaVersion: "stage4-windows-wddm-resource-preflight-classification-freeze-v1",
    status: "verified",
    runId: RUN_ID,
    sourceRunId: SOURCE_RUN_ID,
    inputs: Object.fromEntries(Object.keys(EXPECTED).map((role) => [role, bind(FILES[role])])),
    programs: {
      runner: bind(FILES.runner),
      test: bind(FILES.test),
      gate: bind(FILES.gate),
      gateTest: bind(FILES.gateTest),
      gpuRunner: bind(FILES.gpuRunner),
      gpuRunnerTest: bind(FILES.gpuRunnerTest),
      cpuChecker: bind(FILES.cpuChecker),
    },
    dynamicProgramFreeze: DYNAMIC_PROGRAM_FREEZE,
    syntax,
    tests,
    formalValidation: {
      gateTests: formalValidation.gateTests,
      gpuRunnerTests: formalValidation.gpuRunnerTests,
      cpuChecker: {
        status: formalValidation.cpuChecker.status,
        positivePassed: formalValidation.cpuChecker.positivePassed,
        positiveTotal: formalValidation.cpuChecker.positiveTotal,
        negativePassed: formalValidation.cpuChecker.negativePassed,
        negativeTotal: formalValidation.cpuChecker.negativeTotal,
      },
    },
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.diagnostic, diagnostics)
  writeExclusive(outputs.correctedResourcePreflight, formalValidation.correctedResourcePreflight)
  writeExclusive(outputs.cpuValidation, {
    schemaVersion: "stage4-windows-wddm-resource-classifier-correction-cpu-validation-v1",
    status: "passed",
    gateTests: formalValidation.gateTests,
    gpuRunnerTests: formalValidation.gpuRunnerTests,
    cpuChecker: formalValidation.cpuChecker,
    correctedResourcePreflight: bind(outputs.correctedResourcePreflight),
    gpuWorkloadStarted: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.classification, { ...classification, recordedAtUtc })
  writeExclusive(outputs.correction, {
    schemaVersion: "stage4-windows-wddm-resource-classifier-correction-action-v1",
    status: "cpu_correction_implemented_and_verified",
    classification: CLASSIFICATION,
    sourceRunId: SOURCE_RUN_ID,
    scope: {
      implemented: [
        "classify_wddm_c_plus_g_contexts_separately_from_cuda_compute_workloads",
        "use_pmon_process_type_wmi_identity_and_memory_availability_as_classification_evidence",
        "retain_existing_utilization_memory_and_disk_limits",
        "gate_and_runner_cpu_positive_and_negative_regression",
      ],
      forbidden: [
        "disable_resource_preflight",
        "raise_or_remove_resource_limits",
        "ignore_python_or_cuda_compute_workloads",
        "change_model_loss_data_review_thresholds_or_training_plan",
        "replay_failed_qualification_or_reuse_failed_run_id",
        "start_gpu_smoke_or_stage0",
      ],
    },
    ownerAuthorizationRequired: false,
    automaticQualificationReplayAllowed: false,
    correctedResourcePreflight: bind(outputs.correctedResourcePreflight),
    cpuValidation: bind(outputs.cpuValidation),
    gpuStarted: false,
    recordedAtUtc,
  })
  writeExclusive(outputs.nextAction, {
    schemaVersion: "ai-painter-local-next-action-v1",
    status: "ready",
    nextAction: NEXT_TASK,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticExecutionAllowed: true,
    automaticQualificationReplayAllowed: false,
    sourceFailedRunReusable: false,
    recordedAtUtc,
  })

  const beforeSha256 = sha(FILES.plan)
  assert.equal(beforeSha256, EXPECTED.plan)
  const nextPlan = updateUniquePlan(fs.readFileSync(FILES.plan, "utf8"), recordedAtUtc)
  const afterSha256 = shaText(nextPlan)
  const receiptRecord = {
    schemaVersion: "stage4-windows-wddm-resource-preflight-classification-plan-receipt-v1",
    status: "plan_committed",
    runId: RUN_ID,
    beforeSha256,
    afterSha256,
    expectedPreviousRegistryRevision: 43,
    expectedCommittedRegistryRevision: 44,
    recordedAtUtc,
  }
  const receiptBinding = { path: projectPath(receipt), sha256: shaJson(receiptRecord) }
  writeExclusive(outputs.planSync, {
    schemaVersion: "stage4-windows-wddm-resource-preflight-classification-plan-sync-v1",
    status: "prepared_for_atomic_projection",
    planPath: projectPath(FILES.plan),
    beforeSha256,
    afterSha256,
    nextLegalAction: NEXT_TASK,
    currentFixedProgress: progress(),
    recordedAtUtc,
  })
  writeExclusive(outputs.terminal, {
    schemaVersion: "stage4-windows-wddm-resource-preflight-failure-classification-terminal-v1",
    executionState: "completed",
    status: "stage4_windows_wddm_resource_preflight_failure_classified_and_corrected",
    runId: RUN_ID,
    sourceRunId: SOURCE_RUN_ID,
    classification: CLASSIFICATION,
    failureClassification: bind(outputs.classification),
    correctionAction: bind(outputs.correction),
    diagnostic: bind(outputs.diagnostic),
    correctedResourcePreflight: bind(outputs.correctedResourcePreflight),
    cpuValidation: bind(outputs.cpuValidation),
    inputFreeze: bind(outputs.freeze),
    nextAction: bind(outputs.nextAction),
    planSyncRecord: bind(outputs.planSync),
    planCommitReceipt: receiptBinding,
    outerTransaction: {
      path: projectPath(TRANSACTION_JOURNAL),
      requiredState: "complete",
      commitMarker: {
        path: projectPath(commitMarkerPath),
        schemaVersion: "stage4-windows-wddm-resource-preflight-classification-commit-marker-v1",
      },
    },
    nextLegalAction: NEXT_TASK,
    currentFixedProgress: progress(),
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    automaticQualificationReplayAllowed: false,
    controlledSmokeAdmissionAllowed: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  const evidence = Object.entries(outputs)
    .filter(([role]) => role !== "capsule")
    .map(([kind, file]) => ({ kind, ...bind(file), expectedSha256: sha(file), sha256Verified: true }))
  writeExclusive(outputs.capsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${RUN_ID}`,
    generatedFrom: "program_saved_evidence",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { ...progress(), source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, status: "wddm_resource_classifier_correction_verified_new_qualification_ready" },
    latestBlocker: {
      code: CLASSIFICATION,
      summaryZh: "Windows WDDM图形上下文误判已确认并完成CPU修正验证；旧资格保持失败关闭，需用全新Run执行只读资格。",
    },
    nextAllowedAction: {
      code: NEXT_TASK,
      ownerAuthorizationRequired: false,
      automaticExecutionAllowed: true,
      planEvidenceConfirmed: true,
    },
    forbiddenActions: ["reuse_failed_qualification", "reuse_failed_run_id", "compile_smoke", "start_training"],
    taskIdentity: { modelId: CAPABILITY, runId: RUN_ID, sourceRunId: SOURCE_RUN_ID },
    evidence,
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
      migrationRegistryStatus: "current_execution_registry_active",
    },
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  writeExclusiveText(STAGED_PLAN, nextPlan)

  const registryAdvance = {
    capabilityVersion: CAPABILITY,
    packageId: RUN_ID,
    taskId: NEXT_TASK,
    taskKind: "readonly_gpu_qualification",
    runId: RUN_ID,
    lifecycleStage: "readonly_gpu_qualification_ready_after_wddm_correction",
    executionState: "completed",
    activity: "windows_wddm_resource_preflight_defect_confirmed_and_corrected",
    taskCapsulePath: projectPath(outputs.capsule),
    terminalEvidencePath: projectPath(outputs.terminal),
    expectedPreviousRegistryRevision: 43,
    expectedPreviousRegistrySha256: EXPECTED.registry,
  }
  const programEvent = {
    id: `stage4-wddm-resource-preflight-classified-and-corrected-${RUN_ID}`,
    timestamp: recordedAtUtc,
    action: "stage4_windows_wddm_resource_preflight_failure_classified_and_corrected",
    runId: RUN_ID,
    kind: "readonly_gpu_failure_classification",
    status: "success",
    title: "Stage4 Windows WDDM resource preflight defect classified and corrected",
    titleZh: "Stage4 Windows WDDM资源预检分类缺陷已确认并修正",
    detailZh: "失败发生在GPU工作负载启动前；WDDM C+G图形上下文误判已修正，真实只读资源预检确认全部当前WDDM图形上下文安全、0个冲突进程。",
    evidencePath: projectPath(outputs.terminal),
    evidenceSha256: sha(outputs.terminal),
    fixedTotalProgress: progress(),
  }
  const journal = {
    schemaVersion: "stage4-windows-wddm-resource-preflight-classification-transaction-v1",
    transactionId: RUN_ID,
    journalPath: projectPath(TRANSACTION_JOURNAL),
    runId: RUN_ID,
    sourceRunId: SOURCE_RUN_ID,
    state: "artifacts_ready",
    outputRoot: projectPath(OUTPUT_ROOT),
    artifacts: Object.values(outputs).map(bind),
    registryAdvance,
    plan: {
      path: projectPath(FILES.plan),
      stagedPath: projectPath(STAGED_PLAN),
      beforeSha256,
      afterSha256,
      receiptPath: projectPath(receipt),
      receiptSha256: receiptBinding.sha256,
      receiptRecord,
    },
    programEvent,
    catalogFiles: [...Object.values(outputs).map(projectPath), projectPath(receipt)],
    terminal: bind(outputs.terminal),
    resultStatus: "stage4_windows_wddm_resource_preflight_failure_classified_and_corrected",
    nextLegalAction: NEXT_TASK,
    recordedAtUtc,
  }
  writeJournal(journal)
  return read(TRANSACTION_JOURNAL)
}

async function completeTransaction(initial, journalPath) {
  let journal = initial
  verifyJournalIdentity(journal, journalPath)
  verifyJournalArtifacts(journal, false)
  if (journal.state === "artifacts_ready") {
    const planCommit = ensurePlanCommitted(journal)
    journal = transition(journalPath, journal, "plan_committed", { planCommit })
  }
  if (journal.state === "plan_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = ensureProgramEventCommitted(journal)
    journal = transition(journalPath, journal, "event_committed", {
      programEvent: eventCommit.event,
      eventCommit: eventCommit.receipt,
    })
  }
  if (journal.state === "event_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = verifyProgramEventCommitted(journal)
    for (const logicalPath of journal.catalogFiles) index(inside(logicalPath), journal.runId)
    const catalogCommit = verifyIndexedCatalogFiles(journal)
    journal = transition(journalPath, journal, "dependencies_committed", { eventCommit, catalogCommit })
  }
  if (journal.state === "dependencies_committed") {
    verifyPlanCommitted(journal)
    const eventCommit = verifyProgramEventCommitted(journal)
    verifyIndexedCatalogFiles(journal)
    const registryPrepare = await ensureRegistryPrepared({ ...journal, eventCommit })
    journal = transition(journalPath, journal, "registry_prepared", { eventCommit, registryPrepare })
  }
  if (journal.state === "registry_prepared") {
    verifyPlanCommitted(journal)
    verifyProgramEventCommitted(journal)
    verifyIndexedCatalogFiles(journal)
    const registryCommit = await ensureRegistryPublished(journal)
    const commitMarkerPath = projectPath(path.join(inside(journal.outputRoot), "transaction-commit-marker.json"))
    const commitMarkerRecord = buildCommitMarkerRecord(journal, registryCommit)
    journal = transition(journalPath, journal, "registry_committed", {
      registryCommit,
      commitMarkerPath,
      commitMarkerRecord,
    })
  }
  if (journal.state === "registry_committed") {
    await verifyRegistryCommit(journal)
    verifyPlanCommitted(journal)
    verifyProgramEventCommitted(journal)
    verifyIndexedCatalogFiles(journal)
    verifyJournalArtifacts(journal, true)
    const commitMarker = ensureCommitMarker(journal)
    journal = transition(journalPath, journal, "complete", {
      commitMarker,
      completedAtUtc: new Date().toISOString(),
    })
  }
  assert.equal(journal.state, "complete")
  verifyCommitMarker(journal)
  return journal
}

async function recoverIncompleteTransactions() {
  if (!fs.existsSync(TRANSACTION_PARENT)) return []
  const recovered = []
  for (const entry of fs.readdirSync(TRANSACTION_PARENT, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const journalPath = path.join(TRANSACTION_PARENT, entry.name, "transaction.json")
    if (!fs.existsSync(journalPath)) continue
    const journal = read(journalPath)
    if (journal.schemaVersion !== "stage4-windows-wddm-resource-preflight-classification-transaction-v1") continue
    if (journal.state === "complete") {
      verifyJournalIdentity(journal, journalPath)
      verifyCommitMarker(journal)
      const current = await readCurrentExecutionRegistry(ROOT)
      if (current.ok === true && current.registry.runId === journal.runId && current.registry.terminalEvidence.path === journal.terminal.path) {
        recovered.push({ runId: journal.runId, state: journal.state, registryCommit: journal.registryCommit })
      }
      continue
    }
    verifyJournalIdentity(journal, journalPath)
    const completed = await completeTransaction(journal, journalPath)
    recovered.push({ runId: completed.runId, state: completed.state, registryCommit: completed.registryCommit })
  }
  return recovered
}

async function ensureRegistryPrepared(journal) {
  const recovered = readMatchingPreparedRegistryClaim(journal)
  if (recovered !== null) return recovered
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registry.registryRevision, 43)
  assert.equal(current.registrySha256, EXPECTED.registry)
  const dependencyManifest = buildRegistryDependencyManifest(journal)
  return prepareCurrentExecutionRegistryAdvance({
    ...journal.registryAdvance,
    projectRoot: ROOT,
    dependencyManifest,
  })
}

async function ensureRegistryPublished(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  if (
    current.ok === true
    && current.registry.runId === journal.runId
    && current.registry.terminalEvidence.path === journal.registryAdvance.terminalEvidencePath
  ) return registryIdentity(current)
  assert.equal(typeof journal.registryPrepare?.transactionId, "string")
  try {
    const published = await finalizePreparedCurrentExecutionRegistryAdvance({
      projectRoot: ROOT,
      transactionId: journal.registryPrepare.transactionId,
    })
    assert.equal(published.ok, true, published.errorCode)
    return registryIdentity(published)
  } catch (error) {
    const message = String(error?.message ?? error)
    if (!message.includes("registry_writer_claim_not_owned_by_current_process") && !message.includes("registry_writer_claim_process_identity_mismatch")) throw error
    const recovered = await recoverPreparedCurrentExecutionRegistryAdvance({
      projectRoot: ROOT,
      transactionId: journal.registryPrepare.transactionId,
    })
    assert.equal(recovered.ok, true, recovered.errorCode)
    return registryIdentity(recovered)
  }
}

async function verifyRegistryCommit(journal) {
  const current = await readCurrentExecutionRegistry(ROOT)
  assert.equal(current.ok, true, current.errorCode)
  assert.equal(current.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(current.registry.registryRevision, journal.registryCommit.registryRevision)
  assert.equal(current.registry.runId, journal.runId)
  assert.equal(current.registry.taskId, NEXT_TASK)
  assert.equal(current.registry.terminalEvidence.path, journal.registryAdvance.terminalEvidencePath)
}

function registryIdentity(current) {
  return {
    registryRevision: current.registry.registryRevision,
    eventSequence: current.registry.eventSequence,
    registrySha256: current.registrySha256,
    transactionId: current.registry.transactionId,
    terminalEvidence: current.registry.terminalEvidence,
  }
}

function verifyJournalIdentity(journal, journalPath) {
  assert.equal(journal?.schemaVersion, "stage4-windows-wddm-resource-preflight-classification-transaction-v1")
  assert.match(journal.runId, /^stage4-wddm-resource-classification-\d{17}-[0-9a-f]{8}$/u)
  assert.equal(journal.transactionId, journal.runId)
  assert.equal(journal.sourceRunId, SOURCE_RUN_ID)
  assert.ok([
    "artifacts_ready",
    "plan_committed",
    "event_committed",
    "dependencies_committed",
    "registry_prepared",
    "registry_committed",
    "complete",
  ].includes(journal.state), `unsupported classification transaction state: ${journal.state}`)

  const expectedJournalPath = path.join(TRANSACTION_PARENT, journal.runId, "transaction.json")
  assert.equal(path.resolve(journalPath), path.resolve(expectedJournalPath))
  assert.equal(journal.journalPath, projectPath(expectedJournalPath))
  const expectedOutputRoot = path.join(OUTPUT_PARENT, journal.runId)
  assert.equal(journal.outputRoot, projectPath(expectedOutputRoot))

  assert.equal(journal.registryAdvance?.runId, journal.runId)
  assert.equal(journal.registryAdvance?.packageId, journal.runId)
  assert.equal(journal.registryAdvance?.capabilityVersion, CAPABILITY)
  assert.equal(journal.registryAdvance?.taskId, NEXT_TASK)
  assert.equal(journal.registryAdvance?.taskKind, "readonly_gpu_qualification")
  assert.equal(journal.registryAdvance?.expectedPreviousRegistryRevision, 43)
  assert.equal(journal.registryAdvance?.expectedPreviousRegistrySha256, EXPECTED.registry)
  assert.equal(journal.plan?.path, projectPath(FILES.plan))
  assert.equal(journal.plan?.beforeSha256, EXPECTED.plan)
  assert.equal(journal.plan?.stagedPath, projectPath(path.join(TRANSACTION_PARENT, journal.runId, "next-plan.md")))
  assert.equal(journal.programEvent?.id, `stage4-wddm-resource-preflight-classified-and-corrected-${journal.runId}`)
  assert.equal(journal.programEvent?.runId, journal.runId)
  assert.equal(journal.programEvent?.evidencePath, journal.terminal?.path)
  assert.equal(journal.programEvent?.evidenceSha256, journal.terminal?.sha256)

  assert.ok(Array.isArray(journal.artifacts) && journal.artifacts.length >= 10)
  const artifactPaths = new Set()
  for (const binding of journal.artifacts) {
    assert.equal(typeof binding?.path, "string")
    assert.match(binding.sha256, /^[0-9a-f]{64}$/u)
    assertPathInside(binding.path, journal.outputRoot)
    assert.equal(artifactPaths.has(binding.path), false, `duplicate journal artifact: ${binding.path}`)
    artifactPaths.add(binding.path)
  }
  assert.equal(artifactPaths.has(journal.terminal.path), true)
  assert.equal(artifactPaths.has(journal.registryAdvance.taskCapsulePath), true)
  assert.deepEqual(
    [...journal.catalogFiles].sort(),
    [...artifactPaths, journal.plan.receiptPath].sort(),
  )

  const terminal = read(inside(journal.terminal.path))
  assert.equal(terminal.runId, journal.runId)
  assert.equal(terminal.sourceRunId, SOURCE_RUN_ID)
  assert.equal(terminal.executionState, "completed")
  assert.equal(terminal.status, journal.resultStatus)
  assert.equal(terminal.outerTransaction?.path, journal.journalPath)
  assert.equal(terminal.outerTransaction?.requiredState, "complete")
  assert.equal(
    terminal.outerTransaction?.commitMarker?.path,
    projectPath(path.join(expectedOutputRoot, "transaction-commit-marker.json")),
  )
  assert.equal(
    terminal.outerTransaction?.commitMarker?.schemaVersion,
    "stage4-windows-wddm-resource-preflight-classification-commit-marker-v1",
  )
  if (["registry_committed", "complete"].includes(journal.state)) {
    assert.equal(journal.commitMarkerPath, terminal.outerTransaction.commitMarker.path)
    assert.equal(journal.commitMarkerRecord?.transactionId, journal.transactionId)
  }
}

function assertPathInside(candidate, parent) {
  const candidatePath = inside(candidate)
  const parentPath = inside(parent)
  const relative = path.relative(parentPath, candidatePath)
  assert.equal(relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)), true, `path escapes namespace: ${candidate}`)
}

function readMatchingPreparedRegistryClaim(journal) {
  const claimPath = inside(".runtime/ai-painter/current-execution-registry/writer.claim.json")
  if (!fs.existsSync(claimPath)) return null
  const claim = read(claimPath)
  assert.equal(claim.schemaVersion, "ai-painter-current-execution-registry-writer-claim-v1")
  assert.match(claim.transactionId, /^current-execution-registry-advance-[A-Za-z0-9-]+$/u)
  const transactionRoot = `.runtime/ai-painter/current-execution-registry/transactions/${claim.transactionId}`
  const pendingPath = inside(`${transactionRoot}/transaction.pending.json`)
  assert.equal(fs.existsSync(pendingPath), true, "registry writer claim has no pending transaction")
  const pending = read(pendingPath)
  assert.equal(pending.schemaVersion, "ai-painter-current-execution-registry-transaction-v1")
  assert.equal(pending.status, "pending")
  assert.equal(pending.transactionId, claim.transactionId)
  assert.equal(pending.registryRevision, 44)
  assert.equal(pending.eventSequence, 44)
  assert.equal(pending.previousRegistryRevision, 43)
  assert.equal(pending.previousCurrentSha256, EXPECTED.registry)
  assert.equal(sha(inside(pending.currentStaged.path)), pending.currentStaged.sha256)
  assert.equal(pending.currentSha256, pending.currentStaged.sha256)
  assert.equal(sha(inside(pending.registryEventStaged.path)), pending.registryEventStaged.sha256)
  assert.equal(sha(inside(pending.dependencyManifest.path)), pending.dependencyManifest.sha256)

  const stagedCurrent = read(inside(pending.currentStaged.path))
  assert.equal(stagedCurrent.runId, journal.runId)
  assert.equal(stagedCurrent.packageId, journal.runId)
  assert.equal(stagedCurrent.taskId, NEXT_TASK)
  assert.equal(stagedCurrent.capabilityVersion, CAPABILITY)
  assert.equal(stagedCurrent.registryRevision, 44)
  assert.equal(stagedCurrent.eventSequence, 44)
  assert.equal(stagedCurrent.terminalEvidence.path, journal.registryAdvance.terminalEvidencePath)
  assert.equal(stagedCurrent.terminalEvidence.sha256, journal.terminal.sha256)
  const manifest = read(inside(pending.dependencyManifest.path))
  assert.equal(manifest.schemaVersion, "ai-painter-current-execution-registry-dependency-manifest-v1")
  assert.equal(manifest.outerJournal?.path, journal.journalPath)
  assert.equal(manifest.outerJournal?.requiredState, "registry_prepared")
  assert.equal(manifest.programEvent?.eventId, journal.programEvent.id)
  return {
    ok: true,
    status: "prepared_not_published",
    transactionId: claim.transactionId,
    registryRevision: pending.registryRevision,
    eventSequence: pending.eventSequence,
    currentSha256: pending.currentSha256,
    previousCurrentSha256: pending.previousCurrentSha256,
    transactionRoot,
    writerClaim: claim,
    recoveredFromDurablePrepare: true,
  }
}

function buildRegistryDependencyManifest(journal) {
  const bindings = [
    { role: "committed_plan", path: journal.plan.path, sha256: journal.plan.afterSha256 },
    { role: "plan_commit_receipt", path: journal.plan.receiptPath, sha256: journal.plan.receiptSha256 },
    ...journal.artifacts.map((binding, index) => ({ role: `classification_artifact_${index}`, ...binding })),
  ]
  const catalogArtifacts = new Map()
  for (const artifact of journal.catalogCommit.artifacts) catalogArtifacts.set(artifact.logicalPath, artifact)
  for (const artifact of [journal.eventCommit.catalog.ledgerArtifact, journal.eventCommit.catalog.latestArtifact]) {
    catalogArtifacts.set(artifact.path, { logicalPath: artifact.path, sha256: artifact.sha256, byteSize: artifact.byteSize })
  }
  return {
    schemaVersion: "ai-painter-current-execution-registry-dependency-manifest-v1",
    mode: "external",
    outerJournal: {
      path: journal.journalPath,
      requiredState: "registry_prepared",
    },
    bindings,
    programEvent: {
      eventId: journal.programEvent.id,
      event: journal.programEvent,
      ledgerPath: journal.eventCommit.ledger.path,
      latestPath: journal.eventCommit.latest.path,
      catalogDatabasePath: path.resolve(catalogPath),
    },
    catalogArtifacts: [...catalogArtifacts.values()].map((artifact) => ({
      logicalPath: artifact.logicalPath,
      sha256: artifact.sha256,
    })),
  }
}

function verifyIndexedCatalogFiles(journal) {
  const database = openStorageCatalog()
  const artifacts = []
  for (const sourcePath of journal.catalogFiles) {
    const file = inside(sourcePath)
    const logicalPath = logicalProjectPath(file)
    const stat = fs.statSync(file)
    const digest = sha(file)
    const row = database.prepare("SELECT logical_path, byte_size, sha256 FROM artifacts WHERE logical_path = ?").get(logicalPath)
    assert.notEqual(row, undefined, `catalog artifact missing: ${logicalPath}`)
    assert.equal(row.logical_path, logicalPath)
    assert.equal(Number(row.byte_size), stat.size)
    assert.equal(row.sha256, digest)
    artifacts.push({ logicalPath, byteSize: stat.size, sha256: digest })
  }
  return {
    status: "verified",
    catalogDatabasePath: path.resolve(catalogPath),
    artifactCount: artifacts.length,
    artifacts,
  }
}

function buildCommitMarkerRecord(journal, registryCommit) {
  const freezeBinding = journal.artifacts.find((binding) => binding.path.endsWith("/input-and-program-freeze.json"))
  assert.notEqual(freezeBinding, undefined, "program freeze binding is missing")
  const preparedFreeze = read(inside(freezeBinding.path))
  const finalizationPrograms = {
    runner: bind(FILES.runner),
    eventStore: bind(FILES.eventStore),
    registryHelper: bind(FILES.registryHelper),
  }
  return {
    schemaVersion: "stage4-windows-wddm-resource-preflight-classification-commit-marker-v1",
    status: "committed",
    transactionId: journal.transactionId,
    runId: journal.runId,
    journalPath: journal.journalPath,
    terminal: journal.terminal,
    plan: { path: journal.plan.path, sha256: journal.plan.afterSha256 },
    programEvent: { id: journal.programEvent.id, evidencePath: journal.programEvent.evidencePath, evidenceSha256: journal.programEvent.evidenceSha256 },
    programContinuity: {
      preparedPrograms: {
        runner: preparedFreeze.programs.runner,
        eventStore: preparedFreeze.inputs.eventStore,
        registryHelper: preparedFreeze.inputs.registryHelper,
      },
      finalizationPrograms,
      changedAfterPreparation: Object.keys(finalizationPrograms).filter((role) => (
        preparedFreeze.programs[role]?.sha256 ?? preparedFreeze.inputs[role]?.sha256
      ) !== finalizationPrograms[role].sha256),
      boundedRecoveryReason: "precommit_program_event_store_legacy_idless_history_compatibility",
      classificationArtifactsRecomputed: false,
      immutableClassificationArtifactsReverified: true,
    },
    registry: registryCommit,
    nextLegalAction: journal.nextLegalAction,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc: new Date().toISOString(),
  }
}

function ensureCommitMarker(journal) {
  const markerPath = inside(journal.commitMarkerPath)
  if (!fs.existsSync(markerPath)) writeExclusive(markerPath, journal.commitMarkerRecord)
  assert.equal(sha(markerPath), shaJson(journal.commitMarkerRecord))
  index(markerPath, journal.runId)
  const database = openStorageCatalog()
  const logicalPath = logicalProjectPath(markerPath)
  const stat = fs.statSync(markerPath)
  const row = database.prepare("SELECT byte_size, sha256 FROM artifacts WHERE logical_path = ?").get(logicalPath)
  assert.notEqual(row, undefined, "commit marker catalog row is missing")
  assert.equal(Number(row.byte_size), stat.size)
  assert.equal(row.sha256, sha(markerPath))
  return { path: journal.commitMarkerPath, byteSize: stat.size, sha256: sha(markerPath) }
}

function verifyCommitMarker(journal) {
  assert.equal(journal.state, "complete")
  assert.equal(journal.commitMarker?.path, journal.commitMarkerPath)
  assert.equal(sha(inside(journal.commitMarkerPath)), journal.commitMarker.sha256)
  assert.equal(sha(inside(journal.commitMarkerPath)), shaJson(journal.commitMarkerRecord))
  const marker = read(inside(journal.commitMarkerPath))
  assert.deepEqual(marker, journal.commitMarkerRecord)
  assert.equal(marker.registry.registrySha256, journal.registryCommit.registrySha256)
  assert.equal(marker.terminal.sha256, journal.terminal.sha256)
  assert.equal(marker.programContinuity.finalizationPrograms.runner.sha256, sha(FILES.runner))
  assert.equal(marker.programContinuity.finalizationPrograms.eventStore.sha256, sha(FILES.eventStore))
  assert.equal(marker.programContinuity.finalizationPrograms.registryHelper.sha256, sha(FILES.registryHelper))
  assert.equal(marker.programContinuity.immutableClassificationArtifactsReverified, true)
}

function ensurePlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.stagedPath)), journal.plan.afterSha256)
  const current = sha(inside(journal.plan.path))
  if (current === journal.plan.beforeSha256) writeAtomic(inside(journal.plan.path), fs.readFileSync(inside(journal.plan.stagedPath), "utf8"))
  else assert.equal(current, journal.plan.afterSha256)
  if (!fs.existsSync(inside(journal.plan.receiptPath))) writeExclusive(inside(journal.plan.receiptPath), journal.plan.receiptRecord)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
  return { status: "plan_committed", committedPlanSha256: journal.plan.afterSha256 }
}

function verifyPlanCommitted(journal) {
  assert.equal(sha(inside(journal.plan.path)), journal.plan.afterSha256)
  assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

function ensureProgramEventCommitted(journal) {
  const event = ensureAiPainterProgramEventCommitted(journal.programEvent)
  verifyProgramEvent(event, journal.programEvent)
  const receipt = verifyAiPainterProgramEventCommitted(event)
  assert.deepEqual(receipt.event, event)
  return { event, receipt }
}

function verifyProgramEventCommitted(journal) {
  const receipt = verifyAiPainterProgramEventCommitted(journal.programEvent)
  assert.deepEqual(receipt.event, journal.programEvent)
  assert.equal(receipt.catalog.programEventId, journal.programEvent.id)
  return receipt
}

function verifyProgramEvent(actual, expected) {
  for (const key of ["id", "timestamp", "action", "runId", "kind", "status", "evidencePath", "evidenceSha256"]) {
    assert.deepEqual(actual[key], expected[key])
  }
}

function verifyJournalArtifacts(journal, includeReceipt) {
  for (const binding of journal.artifacts) {
    assert.equal(fs.existsSync(inside(binding.path)), true)
    assert.equal(sha(inside(binding.path)), binding.sha256)
  }
  if (includeReceipt) assert.equal(sha(inside(journal.plan.receiptPath)), journal.plan.receiptSha256)
}

export function updateUniquePlan(source, timestamp) {
  let output = source
  output = replaceOnce(output, /^更新时间：.*$/mu, `更新时间：${formatShanghai(timestamp).replace("T", " ").replace("+08:00", " +08:00")}`)
  output = replaceOnce(output, /^状态：.*$/mu, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4 Windows WDDM资源预检分类缺陷已确认并完成CPU修正验证，全新只读GPU资格待执行")
  output = replaceOnce(output, /^\| 2 \| AI Painter R5 \/ Stage4 \|.*$/mu, "| 2 | AI Painter R5 / Stage4 | 从WorldFacts、VisualFactManifest和23通道条件生成可审核完整地图；不以失败预览或审核结果作为训练目标 | 固定进度3/5（60%）；旧全主干空间仿射只读GPU资格保持失败关闭，其原因已确认为Windows WDDM图形上下文误判；修正后CPU门及真实只读资源预检确认当前全部WDDM图形上下文安全、0个冲突进程 | 下一步仅允许使用全新Run执行修正后的只读GPU资格；不得复用旧失败Run、自动重放、编译Smoke或启动Stage 0 |")
  output = replaceOnce(output, /## 5\. 当前阻断与后续实施顺序[\s\S]*?(?=\n## 6\.)/u, "## 5. 当前阻断与后续实施顺序\n\n旧全主干空间仿射只读GPU资格在GPU工作负载启动前被资源预检关闭，旧Run保持`failed_closed`且不可重放。不可变失败证据与CPU只读诊断确认：CUDA可用，失败时GPU利用率3%、显存占用1213 MiB、可用6699 MiB，均在既有上限内；旧compute-apps证据固定26条且显存均为`N/A`，不存在Python进程，其中两个权限受限PID仍按旧失败文件原字节保留，不把当前进程身份反写到历史证据。唯一分类为WDDM资源预检进程分类缺陷，不是模型、CUDA或GPU能力失败。\n\n资源分类器已在同一CPU事务内完成最小修正和正反回归：保留利用率、显存、磁盘及活动计算负载上限，增加WDDM `C+G`、WMI身份和进程级显存证据区分。修正后真实只读资源预检确认当前全部WDDM图形上下文安全、0个冲突进程并通过，未启动GPU工作负载；动态安全进程数量只保存在正式资源预检证据中。下一步只允许以全新Run执行一次修正后的只读GPU资格；不得复用旧失败Run、编译或启动Smoke、创建优化器、执行`.backward()`、写Checkpoint或启动Stage 0。\n")
  return output
}

function runFormalCpuValidation() {
  const gateTests = runPythonUnitTest(FILES.gateTest, 11, "Gate CPU regression")
  const gpuRunnerTests = runPythonUnitTest(FILES.gpuRunnerTest, 7, "GPU runner CPU regression")
  const cpuChecker = runPythonJson([FILES.cpuChecker], "full-backbone CPU checker")
  assert.equal(cpuChecker.status, "passed")
  assert.equal(cpuChecker.positivePassed, 8)
  assert.equal(cpuChecker.positiveTotal, 8)
  assert.equal(cpuChecker.negativePassed, 50)
  assert.equal(cpuChecker.negativeTotal, 50)
  assert.equal(Object.values(cpuChecker.executionBoundary).every((value) => value === false), true)

  const code = [
    "import json, pathlib, sys",
    "gate_path = pathlib.Path(sys.argv[1]).resolve()",
    "sys.path.insert(0, str(gate_path.parent))",
    "import execute_stage4_full_backbone_spatial_affine_readonly_gpu_gate as gate",
    "report = gate.resource_preflight(project_root=pathlib.Path(sys.argv[2]).resolve())",
    "print(json.dumps(report, ensure_ascii=False, indent=2))",
  ].join("; ")
  const correctedResourcePreflight = runPythonJson(
    ["-c", code, FILES.gate, ROOT],
    "corrected WDDM resource preflight",
  )
  assert.equal(correctedResourcePreflight.status, "passed")
  assert.deepEqual(correctedResourcePreflight.blockers, [])
  assert.equal(correctedResourcePreflight.gpuWorkloadStarted, false)
  assert.equal(Number.isInteger(correctedResourcePreflight.gpu?.safeWddmGraphicsProcessCount), true)
  assert.ok(correctedResourcePreflight.gpu.safeWddmGraphicsProcessCount >= 0)
  assert.equal(correctedResourcePreflight.gpu?.conflictingComputeProcessCount, 0)
  return { gateTests, gpuRunnerTests, cpuChecker, correctedResourcePreflight }
}

function runPythonUnitTest(file, expectedCount, label) {
  verifyDynamicPrograms()
  const result = spawnSync(PYTHON, ["-B", "-m", "unittest", file], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    killSignal: "SIGKILL",
  })
  verifyDynamicPrograms()
  assertChildSucceeded(result, label)
  const transcript = `${result.stdout}\n${result.stderr}`
  const match = transcript.match(/Ran\s+(\d+)\s+tests?/u)
  assert.notEqual(match, null, `${label} test count is missing`)
  assert.equal(Number(match[1]), expectedCount, `${label} count changed`)
  assert.match(transcript, /\bOK\b/u)
  return {
    status: "passed",
    testCount: expectedCount,
    testFile: projectPath(file),
    transcriptSha256: shaText(transcript),
  }
}

function runPythonJson(args, label) {
  verifyDynamicPrograms()
  const result = spawnSync(PYTHON, ["-B", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: pythonEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    killSignal: "SIGKILL",
  })
  verifyDynamicPrograms()
  assertChildSucceeded(result, label)
  const stdout = String(result.stdout).replace(/^\uFEFF/u, "").trim()
  assert.notEqual(stdout, "", `${label} returned no JSON`)
  return JSON.parse(stdout)
}

function pythonEnvironment() {
  return {
    ...process.env,
    CUDA_VISIBLE_DEVICES: "",
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONUTF8: "1",
  }
}

function runNodeCheck() {
  verifyDynamicPrograms()
  const result = spawnSync(process.execPath, ["--check", FILES.runner], { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: COMMAND_TIMEOUT_MS })
  verifyDynamicPrograms()
  assertChildSucceeded(result, "Node syntax")
  return { status: "passed", file: projectPath(FILES.runner) }
}

function runMockTests() {
  verifyDynamicPrograms()
  const result = spawnSync(process.execPath, ["--test", FILES.test], { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 })
  verifyDynamicPrograms()
  assertChildSucceeded(result, "classifier mock tests")
  const transcript = `${result.stdout}\n${result.stderr}`
  const passMatch = transcript.match(/(?:#|ℹ)\s*pass\s+(\d+)/u)
  const failMatch = transcript.match(/(?:#|ℹ)\s*fail\s+(\d+)/u)
  assert.notEqual(passMatch, null, "classifier mock pass count is missing")
  assert.notEqual(failMatch, null, "classifier mock fail count is missing")
  assert.equal(Number(passMatch[1]), 18, "classifier mock count changed")
  assert.equal(Number(failMatch[1]), 0, "classifier mock failure count is nonzero")
  return { status: "passed", testCount: 18, testFile: projectPath(FILES.test), stdoutSha256: shaText(result.stdout), stderrSha256: shaText(result.stderr) }
}

function runReadOnlyCommand(command, args, label, { allowEmpty = false } = {}) {
  verifyDynamicPrograms()
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 })
  verifyDynamicPrograms()
  assertChildSucceeded(result, label)
  if (!allowEmpty) assert.equal(String(result.stdout).trim() === "", false, `${label} returned no evidence`)
  return result.stdout
}

function assertChildSucceeded(result, label) {
  assert.equal(result.error, undefined, `${label} failed to start: ${result.error?.message ?? "unknown"}`)
  assert.equal(result.status, 0, `${label} failed (${result.status})\n${result.stdout ?? ""}\n${result.stderr ?? ""}`)
}

function transition(journalPath, journal, state, additions) {
  const next = { ...journal, ...additions, state, updatedAtUtc: new Date().toISOString() }
  writeAtomic(journalPath, `${JSON.stringify(next, null, 2)}\n`)
  return read(journalPath)
}

function runIdTimestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/gu, "").slice(0, 17)
}

function newRunId() {
  return `stage4-wddm-resource-classification-${runIdTimestamp()}-${crypto.randomUUID().slice(0, 8)}`
}

function progress() { return { completedStages: 3, totalStages: 5, percent: 60 } }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "")) }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function shaText(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex") }
function shaJson(value) { return shaText(`${JSON.stringify(value, null, 2)}\n`) }
function bind(file) { return { path: projectPath(file), sha256: sha(file) } }
function inside(relative) { assert.equal(path.isAbsolute(relative), false); const file = path.resolve(ROOT, relative); assert.ok(file.startsWith(`${path.resolve(ROOT)}${path.sep}`)); return file }
function replaceOnce(source, pattern, replacement) {
  const match = source.match(pattern)
  assert.notEqual(match, null)
  if (match[0] === replacement) return source
  const output = source.replace(pattern, replacement)
  assert.notEqual(output, source)
  return output
}
function writeExclusive(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" }) }
function writeExclusiveText(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value, { encoding: "utf8", flag: "wx" }) }
function writeAtomic(file, value) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, value, "utf8"); fs.renameSync(temporary, file) }
function writeJournal(value) { writeAtomic(TRANSACTION_JOURNAL, `${JSON.stringify(value, null, 2)}\n`) }
function index(file, runId) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_windows_wddm_resource_preflight_failure_classification_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }) }

function recordFailure(error) {
  try {
    const root = path.join(OUTPUT_PARENT, `${RUN_ID}-failed`)
    fs.mkdirSync(root, { recursive: false })
    const failure = path.join(root, "orchestrator-failure.json")
    writeExclusive(failure, {
      schemaVersion: "stage4-windows-wddm-resource-preflight-classification-orchestrator-failure-v1",
      executionState: "failed_closed",
      status: "classification_not_completed",
      runId: RUN_ID,
      sourceRunId: SOURCE_RUN_ID,
      error: error instanceof Error ? error.stack : String(error),
      ownerAuthorizationRequired: false,
      automaticQualificationReplayAllowed: false,
      gpuStarted: false,
      recordedAtUtc: new Date().toISOString(),
    })
    index(failure, RUN_ID)
  } catch (recordingError) {
    process.stderr.write(`classification failure recording failed: ${recordingError}\n`)
  }
}
