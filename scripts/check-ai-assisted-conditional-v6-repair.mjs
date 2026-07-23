import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const PYTHON = path.join(ROOT, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
const CHECKER = "ml/ai-painter/scripts/check_ai_assisted_conditional_v6_repair.py"
const SOURCES = [
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json",
  "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "ml/ai-painter/src/ai_painter/complete_world/diffusion.py",
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "scripts/train-ai-assisted-conditional-denoiser.mjs",
  "scripts/run-ai-assisted-conditional-inference-validation.mjs",
  "scripts/diagnose-ai-assisted-conditional-v5-failure.mjs",
  CHECKER,
]
const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-conditional-v6-cpu-regression-${createdAtUtc.replace(/[:.]/g, "-")}`
const child = spawnSync(PYTHON, [CHECKER], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  env: { ...process.env, PYTHONUTF8: "1", PYTHONPATH: path.join(ROOT, "ml", "ai-painter", "src"), CUDA_VISIBLE_DEVICES: "" },
})
let result = null
try { result = JSON.parse(child.stdout.trim()) } catch { result = null }
const passed = child.status === 0 && result?.status === "passed" && result?.gpuUsed === false && result?.imageGenerated === false && result?.trainingStarted === false
const record = {
  schemaVersion: "ai-assisted-conditional-v6-repair-cpu-regression-v1",
  status: passed ? "passed" : "failed",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: "owner-authorized-v5-diagnosis-and-repair-20260721",
  repairVersion: "V6",
  sourceV5DiagnosisPath: ".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v5/latest.json",
  result,
  process: { exitCode: child.status, signal: child.signal, stderr: child.stderr },
  sourceEvidence: SOURCES.map((value) => ({ path: value, sha256: sha256File(value) })),
  gpuTrainingStarted: false,
  imageInferenceStarted: false,
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: ".runtime/ai-painter/ai-assisted-conditional-v6-repair-checks",
  runId,
  fileName: "report.json",
  record,
  latest: { repairVersion: "V6", gpuTrainingStarted: false, imageInferenceStarted: false },
})
appendAiPainterProgramEvent({
  action: "check_ai_assisted_conditional_v6_repair",
  runId,
  kind: passed ? "repair_cpu_regression_passed" : "repair_cpu_regression_failed",
  status: passed ? "success" : "failed",
  title: passed ? "V6 repair CPU regression passed" : "V6 repair CPU regression failed",
  titleZh: passed ? "V6 修复 CPU 回归已通过" : "V6 修复 CPU 回归失败",
  detail: `gpuTrainingStarted=false; imageInferenceStarted=false; checks=${JSON.stringify(result?.checks ?? {})}`,
  detailZh: `GPU训练已启动=false；图像推理已启动=false；检查=${JSON.stringify(result?.checks ?? {})}`,
  script: "scripts/check-ai-assisted-conditional-v6-repair.mjs",
  currentStep: "v6_repair_cpu_regression",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: written.runPath,
})
console.log(JSON.stringify({ ...record, reportPath: written.runPath }, null, 2))
if (!passed) process.exit(1)

function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
