import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { auditAiAssistedProfessionalAesthetic } from "./lib/ai-assisted-professional-aesthetic.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_conditional_v7_repair.py"
const DIAGNOSIS_POINTER = ".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v6/latest.json"
const SOURCES = [
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json",
  "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "ml/ai-painter/src/ai_painter/complete_world/diffusion.py",
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/infer_ai_assisted_conditional_validation.py",
  "scripts/diagnose-ai-assisted-conditional-v6-failure.mjs",
  "scripts/lib/ai-assisted-professional-aesthetic.mjs",
  CHECKER,
]

const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-conditional-v7-cpu-regression-${createdAtUtc.replace(/[:.]/g, "-")}`
const diagnosisPointer = readJson(DIAGNOSIS_POINTER)
const diagnosis = readJson(diagnosisPointer.runPath)
const professionalAudit = await auditAiAssistedProfessionalAesthetic(
  path.resolve(ROOT, diagnosis.sourceValidation.imagePath),
)
const diagnosticWarning = professionalAudit.diagnosticWarnings?.find(
  (value) => value.code === "professional_single_axis_texture_envelope_exceeded_diagnostic",
)

const child = spawnSync(PYTHON, [CHECKER], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  env: {
    ...process.env,
    PYTHONUTF8: "1",
    PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src"),
    CUDA_VISIBLE_DEVICES: "",
  },
})
let result = null
try { result = JSON.parse(child.stdout.trim()) } catch { result = null }

const passed = child.status === 0
  && result?.status === "passed"
  && result?.gpuUsed === false
  && result?.imageGenerated === false
  && result?.trainingStarted === false
  && Boolean(diagnosticWarning)
  && professionalAudit.calibration?.minimumMultiscaleViolationCount === 4

const record = {
  schemaVersion: "ai-assisted-conditional-v7-repair-cpu-regression-v1",
  status: passed ? "passed" : "failed",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: "owner-authorized-v6-failure-diagnosis-and-repair-20260722",
  repairVersion: "V7",
  sourceV6DiagnosisPath: diagnosisPointer.runPath,
  sourceV6ValidationRunId: diagnosis.sourceValidation.runId,
  result,
  professionalAestheticDiagnosticRegression: {
    historicalPassedValuePreserved: professionalAudit.passed,
    existingMinimumMultiscaleViolationCountPreserved: professionalAudit.calibration?.minimumMultiscaleViolationCount,
    diagnosticWarning: diagnosticWarning ?? null,
    issues: professionalAudit.issues,
  },
  process: { exitCode: child.status, signal: child.signal, stderr: child.stderr },
  sourceEvidence: SOURCES.map((value) => ({ path: value, sha256: sha256File(value) })),
  gpuTrainingStarted: false,
  imageInferenceStarted: false,
  dataCapacityDecisionId: "owner-approved-v7-data-capacity-128-20260722",
  trainingAuthorizationStatus: "blocked_pending_approved_128_dataset_implementation",
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: ".runtime/ai-painter/ai-assisted-conditional-v7-repair-checks",
  runId,
  fileName: "report.json",
  record,
  latest: {
    repairVersion: "V7",
    gpuTrainingStarted: false,
    imageInferenceStarted: false,
    dataCapacityDecisionId: "owner-approved-v7-data-capacity-128-20260722",
    trainingAuthorizationStatus: "blocked_pending_approved_128_dataset_implementation",
  },
})

appendAiPainterProgramEvent({
  action: "check_ai_assisted_conditional_v7_repair",
  runId,
  kind: passed ? "repair_cpu_regression_passed" : "repair_cpu_regression_failed",
  status: passed ? "success" : "failed",
  title: passed ? "V7 repair CPU regression passed" : "V7 repair CPU regression failed",
  titleZh: passed ? "V7 修复 CPU 回归已通过" : "V7 修复 CPU 回归失败",
  detail: `allValidationMultiseed=${result?.checks?.allTrajectoriesCovered === true}; aestheticDiagnostic=${Boolean(diagnosticWarning)}; gpuTrainingStarted=false; imageInferenceStarted=false`,
  detailZh: `全验证集多种子覆盖=${result?.checks?.allTrajectoriesCovered === true}；审美诊断预警=${Boolean(diagnosticWarning)}；GPU训练已启动=false；图像推理已启动=false`,
  script: "scripts/check-ai-assisted-conditional-v7-repair.mjs",
  currentStep: "v7_repair_cpu_regression",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: written.runPath,
})

console.log(JSON.stringify({ ...record, reportPath: written.runPath }, null, 2))
if (!passed) process.exit(1)

function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
