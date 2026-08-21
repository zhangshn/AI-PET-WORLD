import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const smokeRunId = "20260821-062555429"
const qualificationRunId = "20260821-063008725"
const smokeRoot = path.join(root, ".runtime", "ai-painter", "stage4-per-class-worst-sample-final-visible-luminance-structure-smokes", smokeRunId)
const qualificationRoot = path.join(root, ".runtime", "ai-painter", "stage4-terminal-pass-late-convergence-qualifications", qualificationRunId)
const files = {
  smokeTerminal: path.join(smokeRoot, "finalization", "phase-terminal.json"),
  smokeFinalization: path.join(smokeRoot, "finalization", "finalization-report.json"),
  manifest: path.join(smokeRoot, "training-output", "manifest.json"),
  machineReview: path.join(smokeRoot, "training-output", "fixed-preview-reviews.json"),
  qualificationTerminal: path.join(qualificationRoot, "phase-terminal.json"),
  qualificationReport: path.join(qualificationRoot, "timeline-qualification-report.json"),
  qualificationDecision: path.join(qualificationRoot, "qualification-decision.json"),
  stage0Request: path.join(qualificationRoot, "stage0-owner-action-request.json"),
  capsule: path.join(qualificationRoot, "local-task-capsule.json"),
  plan: path.join(root, "docs", "game-world-generation", "CURRENT_EXECUTION_GUIDE_20260710.md"),
}
for (const file of Object.values(files)) if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
const terminal = JSON.parse(fs.readFileSync(files.qualificationTerminal, "utf8"))
const decision = JSON.parse(fs.readFileSync(files.qualificationDecision, "utf8"))
if (terminal.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed" || terminal.stage0EntryPermitted !== true || decision.qualificationRoute !== "strict_decrease_then_stable_zero" || JSON.stringify(decision.failureCounts) !== JSON.stringify([1, 0, 0])) throw new Error("qualification evidence is not eligible")
const output = path.join(qualificationRoot, "plan-sync-record.json")
if (fs.existsSync(output)) throw new Error("plan sync record already exists")
const timestamp = new Date().toISOString()
writeJsonAtomic(output, {
  schemaVersion: "ai-painter-stage4-plan-sync-record-v1",
  status: "synchronized",
  smokeRunId,
  qualificationRunId,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  uniqueModulePlan: bind(files.plan),
  smokeTerminal: bind(files.smokeTerminal),
  smokeFinalization: bind(files.smokeFinalization),
  manifest: bind(files.manifest),
  machineReview: bind(files.machineReview),
  qualificationTerminal: bind(files.qualificationTerminal),
  qualificationReport: bind(files.qualificationReport),
  qualificationDecision: bind(files.qualificationDecision),
  stage0OwnerActionRequest: bind(files.stage0Request),
  nextLegalAction: "compile_and_atomically_authorize_stage0_full_training_from_fixed_random_initialization",
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
})
for (const file of [...Object.values(files), output]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: qualificationRunId, artifactType: file === files.plan ? "ai_painter_unique_module_plan" : "stage4_smoke_late_stability_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) })
}
appendAiPainterProgramEvent({ id: `stage4-per-class-worst-sample-final-visible-luminance-structure-smoke-qualified-${qualificationRunId}`, timestamp, action: "stage4_per_class_worst_sample_final_visible_luminance_structure_smoke_late_stability_qualified", runId: qualificationRunId, kind: "stage4_smoke_qualification", status: "success", title: "Stage4 per-class worst-sample final-visible luminance Smoke qualified", titleZh: "Stage4逐类别最差样本最终可见亮度结构Smoke后期稳定资格通过", detailZh: "新配置30 Epoch Smoke完整执行；Epoch 10→20→30失败项1→0→0，Epoch 20/30连续通过，独立终态身份及字节复现有效，允许从固定随机初始化建立全新Stage 0授权。", evidencePath: projectPath(files.qualificationTerminal), evidenceSha256: hash(files.qualificationTerminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: "synchronized", smokeTerminal: bind(files.smokeTerminal), qualificationTerminal: bind(files.qualificationTerminal), plan: bind(files.plan), planSyncRecord: bind(output), stage0OwnerActionRequest: bind(files.stage0Request) }, null, 2))

function hash(file) { return createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function projectPath(file) { return path.relative(root, file).replaceAll("\\", "/") }
function bind(file) { return { path: projectPath(file), sha256: hash(file) } }
