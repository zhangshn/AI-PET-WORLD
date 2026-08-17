import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { closeStorageCatalog, indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = process.cwd()
const TERMINAL = ".runtime/ai-painter/stage4-current-candidate-continuous-plan-convergences/20260816-015440530/phase-terminal.json"
const TERMINAL_SHA256 = "e297163a4d113069b9d41ed55edb7920870ec526a83ddec5bbdeb7e1e604d145"
const REPORT = ".runtime/ai-painter/stage4-current-candidate-continuous-plan-convergences/20260816-015440530/cpu-failure-report.json"
const REPORT_SHA256 = "f8e50d048a370573e2d2b8a51adffccc6cb94aa99694b4a2e7ade3e1f0531146"

function sha256(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, relativePath))).digest("hex")
}

function index(relativePath, runId) {
  const absolute = path.resolve(ROOT, relativePath)
  const stat = fs.statSync(absolute)
  indexArtifact({
    logicalPath: logicalProjectPath(absolute),
    physicalUri: fs.realpathSync(absolute),
    storageLayer: "hot",
    runId,
    artifactType: path.extname(absolute).slice(1) || "file",
    byteSize: stat.size,
    modifiedAtUtc: stat.mtime.toISOString(),
    sha256: sha256(relativePath),
  })
}

export function recordPreviousConvergenceFailure() {
  if (sha256(TERMINAL) !== TERMINAL_SHA256 || sha256(REPORT) !== REPORT_SHA256) throw new Error("bound_previous_failure_evidence_changed")
  const terminal = JSON.parse(fs.readFileSync(path.resolve(ROOT, TERMINAL), "utf8"))
  if (terminal.status !== "stage4_current_candidate_plan_convergence_cpu_failed_closed" || terminal.failedCheck !== "negative_case_not_rejected:historical_authorization_binding") throw new Error("bound_previous_failure_identity_invalid")
  const runId = "20260816-015440530"
  index(REPORT, runId)
  index(TERMINAL, runId)
  const event = appendAiPainterProgramEvent({
    id: `stage4-current-candidate-plan-convergence-${runId}-failed`,
    timestamp: terminal.recordedAtUtc,
    action: "stage4_current_candidate_continuous_plan_convergence",
    runId,
    kind: "cpu_contract_regression",
    status: "failed",
    title: "Stage4 current-candidate continuous-plan convergence failed closed",
    titleZh: "Stage4当前候选连续计划收敛CPU门禁失败关闭",
    detail: terminal.failedCheck,
    detailZh: "Smoke实施授权血缘的历史路径注入未被拒绝，未生成五步计划，未启动GPU或训练。",
    evidencePath: TERMINAL,
    evidenceSha256: TERMINAL_SHA256,
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    checkpointWeightsRead: false,
    gpuStarted: false,
    trainingStarted: false,
  })
  closeStorageCatalog()
  return { status: "previous_stage4_plan_convergence_failure_recorded", eventId: event.id, terminal: { path: TERMINAL, sha256: TERMINAL_SHA256 }, report: { path: REPORT, sha256: REPORT_SHA256 } }
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  try {
    console.log(JSON.stringify(recordPreviousConvergenceFailure(), null, 2))
  } finally {
    closeStorageCatalog()
  }
}
