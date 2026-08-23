import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const packageId = "owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823015925273"
const jobRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-background-continuation-jobs/${packageId}`)
const outputRoot = path.resolve(ROOT, ".runtime/ai-painter/stage4-background-host-launch-failures/20260823-100100000")
if (fs.existsSync(outputRoot)) throw new Error("failure_output_exists")
const packagePath = path.resolve(ROOT, `.runtime/ai-painter/owner-action-requests/${packageId}/package.json`)
const executionRoot = path.resolve(ROOT, `.runtime/ai-painter/stage4-stage0-to-80-continuation-executions/${packageId}`)
if (fs.existsSync(executionRoot)) throw new Error("unexpected_execution_root_exists")
const bind = (file) => ({ path: path.relative(ROOT, file).replaceAll("\\", "/"), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") })
const now = new Date().toISOString()
fs.mkdirSync(outputRoot, { recursive: true })
const terminalPath = path.join(outputRoot, "phase-terminal.json")
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-background-host-launch-failure-v1",
  status: "stage4_background_host_launch_failed_before_authorization_consumption_closed",
  errorCode: "absolute_job_path_rejected_by_background_worker_project_relative_path_contract",
  package: bind(packagePath),
  job: bind(path.join(jobRoot, "job.json")),
  launcherFailure: bind(path.join(jobRoot, "launcher-failure.json")),
  coordinatorAuthorizationConsumed: false,
  stage0AuthorizationConsumed: false,
  executionRootCreated: false,
  gpuStarted: false,
  trainingStarted: false,
  packageReusable: false,
  jobOutputReusable: false,
  automaticRetry: false,
  correction: "Pass the logical project-relative job path through the WMI broker and add an immutable bootstrap failure record.",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
appendAiPainterProgramEvent({ id: "stage4-background-host-launch-failure-20260823-100100000", timestamp: now, action: "stage4_background_host_launch", runId: "20260823-100100000", kind: "background_worker_bootstrap_path_failure", status: "failed", title: "Stage4 background host launch failed before consumption", titleZh: "Stage4后台宿主在授权消费前启动失败", detailZh: "WMI已创建进程，但工作器收到绝对job路径后按项目相对路径合同拒绝；Coordinator和Stage0授权均未消费，GPU和训练未启动。", evidencePath: bind(terminalPath).path, evidenceSha256: bind(terminalPath).sha256, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stage4_background_host_launch_failed_before_authorization_consumption_closed", terminal: bind(terminalPath) }, null, 2))
