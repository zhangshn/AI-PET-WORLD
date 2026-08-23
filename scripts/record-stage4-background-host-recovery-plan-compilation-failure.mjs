import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = "20260823-100500000"
const authRoot = path.resolve(ROOT, `.runtime/ai-painter/owner-action-requests/owner-authorized-stage4-background-host-recovery-continuation-${runId}`)
const planRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/${runId}`)
const outputRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-background-host-recovery-continuation-compilations/${runId}`)
if (fs.existsSync(outputRoot)) throw new Error("failure_output_exists")
fs.mkdirSync(outputRoot, { recursive: true })
const bind = (file) => ({ path: path.relative(ROOT, file).replaceAll("\\", "/"), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") })
const now = new Date().toISOString()
const terminalPath = path.join(outputRoot, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-background-host-recovery-plan-compilation-failure-v1",
  status: "stage4_background_host_recovery_plan_compilation_failed_closed",
  errorCode: "host_execution_negative_hash_fixture_did_not_trigger_in_no_file_verification_mode",
  authorization: bind(path.join(authRoot, "authorization.json")),
  consumption: bind(path.join(authRoot, "consumption.json")),
  partialPlan: fs.existsSync(path.join(planRoot, "execution-plan.json")) ? bind(path.join(planRoot, "execution-plan.json")) : null,
  gpuStarted: false,
  trainingStarted: false,
  outputReusable: false,
  authorizationReusable: false,
  automaticRetry: false,
  nextRunMustUseFreshRunId: true,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
appendAiPainterProgramEvent({ id: `stage4-background-host-recovery-plan-failure-${runId}`, timestamp: now, action: "stage4_background_host_recovery_plan_compilation", runId, kind: "cpu_negative_fixture_failure", status: "failed", title: "Background continuation plan CPU fixture failed", titleZh: "后台连续计划CPU负向夹具失败", detailZh: "哈希伪造夹具未在no-file模式触发；未启动GPU或训练，本授权和runId已关闭不复用。", evidencePath: bind(terminalPath).path, evidenceSha256: bind(terminalPath).sha256, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_background_host_recovery_plan_compilation_failed_closed", terminal: bind(terminalPath) }, null, 2))
