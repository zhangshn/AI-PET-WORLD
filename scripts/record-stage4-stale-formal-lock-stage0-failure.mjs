import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const runId = "20260823-111000000"
const evidence = {
  coordinatorTerminal: [".runtime/ai-painter/stage4-stage0-to-80-continuation-executions/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823020439903/finalization/phase-terminal.json", "ecab771c0598fdb059c1b85c3078ad4f868c956bed1e64bb017ca833cde318f1"],
  stage0Terminal: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-103000000-capacity-stage0/finalization/phase-terminal.json", "2e750e22e02a2b1542efb1c455d4295dd5a365ad631424a33bcb52ecd7e00861"],
  backgroundTerminal: [".runtime/ai-painter/stage4-background-continuation-jobs/owner-authorized-ai-painter-stage4-stage0-to-80-continuation-20260823020439903/phase-terminal.json", "82ca79a27eeb1e57dfce64f3524d6be861d7178484e5aa07435dd20fc825f05c"],
  staleLock: [".runtime/ai-painter/stage4-semantic-mixture-formal-training/.formal-stage.lock", "d8c2a7143fa753afe3d94bdfd2d53dd3d9e5889c276f841ca52a61c44eac68e0"],
  hostInterruption: [".runtime/ai-painter/stage4-host-session-training-interruptions/20260823-095700000/phase-terminal.json", "7b7da7cbb454904aa53032531126b1c0eda695d8cef7e3e65bf88a0812d64630"],
}
const bind = (relative) => { const file = path.resolve(ROOT, relative); const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); if (digest !== evidence[Object.keys(evidence).find((key) => evidence[key][0] === relative)][1]) throw new Error(`evidence_hash_mismatch:${relative}`); return { path: relative, sha256: digest } }
const lock = JSON.parse(fs.readFileSync(path.resolve(ROOT, evidence.staleLock[0]), "utf8"))
const processCheck = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$p=Get-CimInstance Win32_Process -Filter \"ProcessId=${lock.pid}\" -ErrorAction SilentlyContinue; if($p){'alive'}else{'absent'}`], { encoding: "utf8", windowsHide: true })
if (processCheck.status !== 0 || processCheck.stdout.trim() !== "absent") throw new Error("stale_lock_pid_not_proven_absent")
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-stale-formal-lock-failures/${runId}`)
if (fs.existsSync(output)) throw new Error("output_exists")
fs.mkdirSync(output, { recursive: true })
const now = new Date().toISOString()
const terminalPath = path.join(output, "phase-terminal.json")
writeJsonAtomic(terminalPath, { schemaVersion: "stage4-stale-formal-lock-stage0-failure-terminal-v1", status: "stale_formal_lock_from_host_interruption_confirmed_closed", classification: "execution_infrastructure_residue_not_model_training_or_visual_failure", facts: { stage0ReadonlyPreflightPassed: true, coordinatorAuthorizationConsumed: true, stage0AuthorizationConsumed: true, optimizerCreated: false, gpuTrainingStarted: false, progressCreated: false, oldLockPid: lock.pid, oldLockRunId: lock.runId, oldLockProcessAlive: false }, evidence: Object.fromEntries(Object.entries(evidence).map(([key, [relative]]) => [key, bind(relative)])), currentPackageReusable: false, automaticRetry: false, requiredCorrection: "atomically_quarantine_exact_stale_lock_before_next_coordinator_consumption", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
const terminalBinding = { path: path.relative(ROOT, terminalPath).replaceAll("\\", "/"), sha256: crypto.createHash("sha256").update(fs.readFileSync(terminalPath)).digest("hex") }
appendAiPainterProgramEvent({ id: `stage4-stale-formal-lock-failure-${runId}`, timestamp: now, action: "stage4_stale_formal_lock_failure_adjudication", runId, kind: "execution_infrastructure_residue", status: "failed", title: "Stale formal Stage4 lock blocked Stage0", titleZh: "宿主中断遗留锁阻止了Stage 0", detailZh: "资源预检已通过，但旧PID 18560遗留锁导致执行在训练开始前关闭；不是模型或视觉失败，当前包不可复用。", evidencePath: terminalBinding.path, evidenceSha256: terminalBinding.sha256, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "stale_formal_lock_from_host_interruption_confirmed_closed", terminal: terminalBinding }, null, 2))
