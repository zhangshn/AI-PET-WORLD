import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = "20260823-095300000"
const root = path.resolve(ROOT, `.runtime/ai-painter/stage4-host-session-training-interruptions/${runId}`)
const terminalPath = path.join(root, "recorder-failure-terminal.json")
if (fs.existsSync(terminalPath)) throw new Error("failure_terminal_exists")
const bind = (file) => ({ path: path.relative(ROOT, file).replaceAll("\\", "/"), sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") })
const now = new Date().toISOString()
writeJsonAtomic(terminalPath, {
  schemaVersion: "stage4-host-session-interruption-recorder-failure-v1",
  status: "host_session_interruption_recorder_failed_closed",
  errorCode: "generated_absolute_evidence_path_rejected_by_relative_only_binding_helper",
  impact: "recording_attempt_only; no training or GPU action started",
  partialEvidence: [bind(path.join(root, "problem-report.json")), bind(path.join(root, "process-snapshot.json"))],
  outputReusable: false,
  automaticRetry: false,
  nextRunMustUseFreshRunId: true,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
appendAiPainterProgramEvent({ id: `stage4-host-session-interruption-recorder-failure-${runId}`, timestamp: now, action: "stage4_host_session_interruption_recording", runId, kind: "local_governance_recorder_failure", status: "failed", title: "Host interruption recorder failed", titleZh: "宿主中断记录程序路径校验失败", detailZh: "仅本地记录失败；未启动GPU或训练。旧runId和部分输出不复用。", evidencePath: bind(terminalPath).path, evidenceSha256: bind(terminalPath).sha256, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "host_session_interruption_recorder_failed_closed", terminal: bind(terminalPath) }, null, 2))
