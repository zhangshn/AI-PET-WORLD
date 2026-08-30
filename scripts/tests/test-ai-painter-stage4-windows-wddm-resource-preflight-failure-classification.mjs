import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  classifyWddmResourcePreflightFailure,
  parseComputeApplications,
  parsePmon,
  updateUniquePlan,
} from "../run-ai-painter-stage4-windows-wddm-resource-preflight-failure-classification.mjs"

const ROOT = process.cwd()
const SOURCE_RUN_ID = "full-backbone-spatial-affine-readonly-gpu-20260829-022348295-bd7c317d"
const SOURCE_ATTEMPT = path.join(
  ROOT,
  ".runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-attempts",
  SOURCE_RUN_ID,
)
const SOURCE_FORMAL = path.join(
  ROOT,
  ".runtime/ai-painter/stage4-full-backbone-spatial-affine-readonly-gpu-formal-failures",
  SOURCE_RUN_ID,
  "phase-terminal.json",
)

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""))
}

function immutableInputs() {
  return {
    formalTerminal: readJson(SOURCE_FORMAL),
    gateFailure: readJson(path.join(SOURCE_ATTEMPT, "failure-report.json")),
    resourcePreflight: readJson(path.join(SOURCE_ATTEMPT, "resource-preflight.json")),
    cudaPreflight: readJson(path.join(SOURCE_ATTEMPT, "python-cuda-preflight.json")),
  }
}

function diagnosticFixture() {
  return {
    schemaVersion: "stage4-windows-wddm-resource-classifier-diagnostic-v1",
    status: "completed",
    driverModel: "WDDM",
    gpu: {
      utilizationPercent: 3,
      usedMemoryMiB: 1213,
      freeMemoryMiB: 6699,
      totalMemoryMiB: 8151,
    },
    pmonProcesses: [
      { gpuIndex: 0, processId: 1888, processType: "C+G", command: "dwm.exe" },
      { gpuIndex: 0, processId: 25688, processType: "C+G", command: "TabTip.exe" },
      { gpuIndex: 0, processId: 4284, processType: "C+G", command: "ChatGP" },
    ],
    computeApplications: [
      { processId: 1888, processName: "[Insufficient Permissions]", usedMemory: "[N/A]" },
      { processId: 25688, processName: "[Insufficient Permissions]", usedMemory: "[N/A]" },
      { processId: 4284, processName: "ChatGPT.exe", usedMemory: "[N/A]" },
    ],
    observedProcessIds: [1888, 4284, 25688],
    processIdentities: [
      { processId: 1888, name: "dwm.exe" },
      { processId: 4284, name: "ChatGPT.exe" },
      { processId: 25688, name: "TabTip.exe" },
    ],
    missingProcessIds: [],
    wmiResolution: {
      status: "completed",
      requestedProcessCount: 3,
      resolvedProcessCount: 3,
    },
    commandsAreReadOnly: true,
    gpuWorkloadStarted: false,
  }
}

function correctedResourcePreflightFixture() {
  return {
    schemaVersion: "stage4-full-backbone-spatial-affine-readonly-gpu-resource-preflight-v1",
    status: "passed",
    gpu: {
      name: "NVIDIA GeForce RTX 5050",
      utilizationPercent: 3,
      usedMemoryMiB: 1213,
      freeMemoryMiB: 6699,
      totalMemoryMiB: 8151,
      processClassificationContract: "windows_wddm_pmon_wmi_compute_conflict_v1",
      computeProcesses: Array.from({ length: 26 }, (_, index) => ({
        pid: 1000 + index,
        classification: "idle_wddm_graphics",
        blockingReasons: [],
      })),
      safeWddmGraphicsProcessCount: 26,
      conflictingComputeProcessCount: 0,
    },
    limits: {
      maximumIdleGpuUtilizationPercent: 10,
      maximumNonqualificationGpuMemoryMiB: 3000,
      minimumFreeGpuMemoryMiB: 4096,
      maximumIdleProcessSmUtilizationPercent: 10,
    },
    blockers: [],
    gpuWorkloadStarted: false,
  }
}

function classify(overrides = {}) {
  const inputs = immutableInputs()
  return classifyWddmResourcePreflightFailure({
    ...inputs,
    diagnostics: diagnosticFixture(),
    correctedResourcePreflight: correctedResourcePreflightFixture(),
    ...overrides,
  })
}

test("pmon rows preserve C+G type, process identity, and command", () => {
  const rows = parsePmon([
    "# gpu        pid  type    sm    mem    enc    dec    jpg    ofa    command",
    "    0       1888   C+G     0      0      -      -      -      -    dwm.exe",
    "    0      25688   C+G     -      -      -      -      -      -    TabTip.exe",
  ].join("\n"))
  assert.deepEqual(rows.map(({ processId, processType, command }) => ({ processId, processType, command })), [
    { processId: 1888, processType: "C+G", command: "dwm.exe" },
    { processId: 25688, processType: "C+G", command: "TabTip.exe" },
  ])
})

test("compute-app rows retain N/A memory without splitting Windows paths", () => {
  const rows = parseComputeApplications([
    "1888, [Insufficient Permissions], [N/A]",
    "4284, C:\\Program Files\\OpenAI\\ChatGPT.exe, [N/A]",
  ].join("\n"))
  assert.deepEqual(rows, [
    {
      processId: 1888,
      processName: "[Insufficient Permissions]",
      usedMemory: "[N/A]",
      raw: "1888, [Insufficient Permissions], [N/A]",
    },
    {
      processId: 4284,
      processName: "C:\\Program Files\\OpenAI\\ChatGPT.exe",
      usedMemory: "[N/A]",
      raw: "4284, C:\\Program Files\\OpenAI\\ChatGPT.exe, [N/A]",
    },
  ])
})

test("fixed evidence uniquely classifies the failure as a WDDM preflight classifier defect", () => {
  const result = classify()
  assert.equal(result.classification, "wddm_resource_preflight_process_classification_defect_confirmed_and_corrected")
  assert.equal(result.modelFailureConfirmed, false)
  assert.equal(result.gpuCapabilityFailureConfirmed, false)
  assert.equal(result.cudaCapabilityAvailable, true)
  assert.equal(result.correctionImplementedAndCpuVerified, true)
  assert.equal(result.automaticQualificationReplayAllowed, false)
  assert.equal(result.controlledSmokeAdmissionAllowed, false)
  assert.equal(result.ownerAuthorizationRequired, false)
})

test("a real CUDA compute context is not reclassified as a WDDM graphics false positive", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.pmonProcesses[2] = {
    gpuIndex: 0,
    processId: 40000,
    processType: "C",
    command: "python.exe",
  }
  assert.throws(
    () => classify({ diagnostics }),
    /Expected values to be strictly equal/,
  )
})

test("numeric per-process GPU memory is rejected", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.computeApplications[2].usedMemory = "512"
  assert.throws(
    () => classify({ diagnostics }),
    /Expected values to be strictly equal/,
  )
})

test("TCC driver mode is outside this WDDM-only classification", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.driverModel = "TCC"
  assert.throws(
    () => classify({ diagnostics }),
    /Expected values to be strictly equal/,
  )
})

test("every dynamically observed process identity must have a nonempty resolved name", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.processIdentities[0].name = ""
  assert.throws(
    () => classify({ diagnostics }),
    /Expected values to be strictly equal/,
  )
})

test("a PID that disappears before WMI identity resolution fails closed", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.processIdentities = diagnostics.processIdentities.filter((item) => item.processId !== 4284)
  diagnostics.missingProcessIds = [4284]
  assert.throws(
    () => classify({ diagnostics }),
    /Expected values to be strictly equal/,
  )
})

test("a reused PID with a different WMI process name fails closed", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.processIdentities[1].name = "python.exe"
  assert.throws(
    () => classify({ diagnostics }),
    /changed identity between pmon and WMI/,
  )
})

test("an observed GPU PID omitted from the declared coverage set fails closed", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.observedProcessIds = diagnostics.observedProcessIds.filter((processId) => processId !== 4284)
  assert.throws(
    () => classify({ diagnostics }),
    /Expected values to be strictly deep-equal/,
  )
})

test("zero current GPU processes is a valid safer WDDM state", () => {
  const diagnostics = diagnosticFixture()
  diagnostics.pmonProcesses = []
  diagnostics.computeApplications = []
  diagnostics.observedProcessIds = []
  diagnostics.processIdentities = []
  diagnostics.missingProcessIds = []
  diagnostics.wmiResolution = {
    status: "not_required",
    requestedProcessCount: 0,
    resolvedProcessCount: 0,
  }
  const correctedResourcePreflight = correctedResourcePreflightFixture()
  correctedResourcePreflight.gpu.computeProcesses = []
  correctedResourcePreflight.gpu.safeWddmGraphicsProcessCount = 0
  const result = classify({ diagnostics, correctedResourcePreflight })
  assert.equal(result.classification, "wddm_resource_preflight_process_classification_defect_confirmed_and_corrected")
  assert.equal(result.gpuCapabilityFailureConfirmed, false)
})

test("a corrected preflight with any conflicting process is rejected", () => {
  const correctedResourcePreflight = correctedResourcePreflightFixture()
  correctedResourcePreflight.status = "failed"
  correctedResourcePreflight.blockers = ["compute_only_gpu_context"]
  correctedResourcePreflight.gpu.safeWddmGraphicsProcessCount = 25
  correctedResourcePreflight.gpu.conflictingComputeProcessCount = 1
  assert.throws(
    () => classify({ correctedResourcePreflight }),
    /Expected values to be strictly equal/,
  )
})

test("the corrected preflight must preserve all frozen resource ceilings", () => {
  const correctedResourcePreflight = correctedResourcePreflightFixture()
  correctedResourcePreflight.gpu.usedMemoryMiB = 4096
  assert.throws(
    () => classify({ correctedResourcePreflight }),
    /The expression evaluated to a falsy value/,
  )
})

test("CUDA-unavailable evidence cannot be described as a preflight-only defect", () => {
  const cudaPreflight = immutableInputs().cudaPreflight
  cudaPreflight.details.cudaAvailable = false
  assert.throws(
    () => classify({ cudaPreflight }),
    /Expected values to be strictly equal/,
  )
})

test("a qualification that reached training is not eligible for this classifier", () => {
  const formalTerminal = immutableInputs().formalTerminal
  formalTerminal.trainingStarted = true
  assert.throws(
    () => classify({ formalTerminal }),
    /Expected values to be strictly equal/,
  )
})

test("the immutable resource snapshot remains inside the frozen safety limits", () => {
  const resourcePreflight = immutableInputs().resourcePreflight
  assert.equal(resourcePreflight.gpu.utilizationPercent, 3)
  assert.equal(resourcePreflight.gpu.usedMemoryMiB, 1213)
  assert.equal(resourcePreflight.gpu.freeMemoryMiB, 6699)
  assert.equal(resourcePreflight.gpu.totalMemoryMiB, 8151)
  assert.equal(resourcePreflight.gpu.computeProcesses.length, 26)
  classify({ resourcePreflight })
})

test("plan projection preserves 3/5 and forbids replay while scheduling only a fresh qualification", () => {
  const planPath = path.join(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
  const output = updateUniquePlan(fs.readFileSync(planPath, "utf8"), "2026-08-29T03:00:00.000Z")
  assert.match(output, /固定进度3\/5（60%）/u)
  assert.match(output, /Windows WDDM资源预检分类缺陷已确认并完成CPU修正验证/u)
  assert.match(output, /不得复用旧失败Run、自动重放/u)
  assert.match(output, /不得复用旧失败Run、编译或启动Smoke/u)
  assert.doesNotMatch(output, /固定进度4\/5/u)
})

test("the classifier wrapper cannot launch the qualification runner or training primitives", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "scripts/run-ai-painter-stage4-windows-wddm-resource-preflight-failure-classification.mjs"),
    "utf8",
  )
  assert.doesNotMatch(source, /torch\.optim|optimizer\.step\s*\(/u)
  assert.doesNotMatch(source, /spawnSync\(PYTHON,\s*\[FILES\.gate/u)
  assert.doesNotMatch(source, /--run-id/u)
  assert.match(source, /const DYNAMIC_PROGRAM_FREEZE = Object\.freeze/u)
  assert.match(source, /verifyDynamicPrograms\(\)/u)
  assert.match(source, /classifier mock count changed/u)
  assert.match(source, /ensureAiPainterProgramEventCommitted/u)
  assert.match(source, /verifyAiPainterProgramEventCommitted/u)
  assert.doesNotMatch(source, /function findProgramEvent/u)
  assert.doesNotMatch(source, /indexProgramEvent/u)
  assert.match(source, /prepareCurrentExecutionRegistryAdvance/u)
  assert.match(source, /finalizePreparedCurrentExecutionRegistryAdvance/u)
  assert.match(source, /recoverPreparedCurrentExecutionRegistryAdvance/u)
  assert.match(source, /transaction-commit-marker\.json/u)
  assert.match(source, /outerTransaction/u)
  const states = [
    '"plan_committed"',
    '"event_committed"',
    '"dependencies_committed"',
    '"registry_prepared"',
    '"registry_committed"',
    '"complete"',
  ].map((state) => source.indexOf(`journal.state === ${state}`))
  assert.equal(states.every((index) => index >= 0), true)
  assert.deepEqual([...states].sort((left, right) => left - right), states)
})
