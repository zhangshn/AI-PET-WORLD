import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = "20260813-025311970"
const output = path.join(
  root, ".runtime", "ai-painter", "stage4-vegetation-final-visible-semantic-repairs", runId,
)
const required = {
  inactiveConfig: "inactive-config.json",
  cpuReport: "cpu-report-passed.json",
  legacyCompatibilityReport: "legacy-final-visible-compatibility-report.json",
}
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const binding = (name) => {
  const file = path.join(output, required[name])
  if (!fs.existsSync(file)) throw new Error(`missing CPU evidence: ${projectPath(file)}`)
  return { path: projectPath(file), sha256: sha256(file) }
}
const sourceTerminal = path.join(
  root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions",
  "20260813-023400498", "finalization", "phase-terminal.json",
)
const sourceManifest = path.join(
  root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions",
  "20260813-023400498", "training-output", "manifest.json",
)
const sourceReview = path.join(
  root, ".runtime", "ai-painter", "stage4-fact-conditioned-semantic-mixture-smoke-executions",
  "20260813-023400498", "training-output", "fixed-preview-reviews.json",
)
const sourceBindings = {
  smokeTerminal: { path: projectPath(sourceTerminal), sha256: sha256(sourceTerminal) },
  manifest: { path: projectPath(sourceManifest), sha256: sha256(sourceManifest) },
  machineReview: { path: projectPath(sourceReview), sha256: sha256(sourceReview) },
}
const expected = {
  smokeTerminal: "2550750455a2b1587ad4916a0ef27cd2e82654bf3c8468c1f96ef772bd8bc32c",
  manifest: "e9a16f8b085802dab6beb1ef2679c2c0ebd74bc906d9edace7fc54583dd64edc",
  machineReview: "253d183f882cb33b105f3ffc7cc5bfca5d687921a8a01fd19b5e96b99ff1369f",
}
for (const key of Object.keys(expected)) {
  if (sourceBindings[key].sha256 !== expected[key]) throw new Error(`source evidence changed: ${key}`)
}
const cpu = JSON.parse(fs.readFileSync(path.join(output, required.cpuReport), "utf8"))
const legacy = JSON.parse(fs.readFileSync(path.join(output, required.legacyCompatibilityReport), "utf8"))
if (
  cpu.status !== "stage4_vegetation_final_visible_semantic_repair_cpu_regression_passed"
  || cpu.positivePassed !== cpu.positiveTotal
  || cpu.negativePassed !== cpu.negativeTotal
  || legacy.status !== "stage4_per_class_final_visible_rgb_obligation_cpu_regression_passed"
) throw new Error("CPU evidence is not successful")

const timestamp = new Date().toISOString()
const common = {
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: formatShanghai(timestamp),
  runId,
  sourceEvidence: sourceBindings,
  inactiveConfig: binding("inactiveConfig"),
  cpuReport: binding("cpuReport"),
  legacyCompatibilityReport: binding("legacyCompatibilityReport"),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  reviewThresholdsChanged: false,
  failedPreviewPixelsUsedAsTargets: false,
  checkpointRead: false,
  gpuUsed: false,
  trainingStarted: false,
}
const supportPath = path.join(output, "training-objective-support-contract.json")
const ownerPath = path.join(output, "owner-action-request.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
for (const file of [supportPath, ownerPath, terminalPath, capsulePath]) {
  if (fs.existsSync(file)) throw new Error(`immutable output already exists: ${projectPath(file)}`)
}
writeJsonAtomic(supportPath, {
  schemaVersion: "ai-painter-stage4-vegetation-final-visible-semantic-repair-support-contract-v1",
  status: "stage4_vegetation_final_visible_semantic_repair_cpu_support_verified_inactive",
  contractId: "stage4_vegetation_final_visible_semantic_repair_v1",
  legalSupervision: "original_owner_approved_reference_rgb_and_object_vegetation_mask",
  lossFunction: "masked_condition_gradient_rgb_loss",
  derivedWeight: 0.23529411764705882,
  derivation: "existing_per_class_final_visible_rgb_vegetation_weight",
  diagnosticManifestFieldCount: 28,
  legacyDiagnosticManifestFieldCount: 27,
  ...common,
})
writeJsonAtomic(ownerPath, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_executed",
  requestedAction: "one_readonly_gpu_vegetation_final_visible_gradient_qualification",
  nextAfterSuccess: "one_new_configuration_30_epoch_smoke",
  ...common,
})
const support = { path: projectPath(supportPath), sha256: sha256(supportPath) }
const owner = { path: projectPath(ownerPath), sha256: sha256(ownerPath) }
writeJsonAtomic(terminalPath, {
  schemaVersion: "ai-painter-stage4-vegetation-final-visible-semantic-repair-terminal-v1",
  status: "stage4_vegetation_final_visible_semantic_repair_cpu_succeeded_closed",
  nextLegalAction: "separately_authorized_readonly_gpu_qualification",
  supportContract: support,
  ownerActionRequest: owner,
  ...common,
})
const terminal = { path: projectPath(terminalPath), sha256: sha256(terminalPath) }
writeJsonAtomic(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: common.fixedTotalProgress,
  currentStage: "Stage4 vegetation final visible semantic repair CPU support complete",
  candidateTerminal: terminal,
  latestBlocker: null,
  nextLegalAction: "readonly GPU gradient qualification",
  forbiddenActions: ["machine_review_threshold_change", "failed_preview_training_target", "free_hyperparameter_selection"],
  evidence: { ...sourceBindings, inactiveConfig: common.inactiveConfig, cpuReport: common.cpuReport, supportContract: support },
  recordedAtUtc: timestamp,
  recordedAtAsiaShanghai: common.recordedAtAsiaShanghai,
})

for (const file of [supportPath, ownerPath, terminalPath, capsulePath]) {
  const stat = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot",
    runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256(file),
  })
}
appendAiPainterProgramEvent({
  id: `stage4-vegetation-final-visible-semantic-repair-cpu-${runId}`,
  timestamp,
  action: "stage4_vegetation_final_visible_semantic_repair_cpu_support",
  runId,
  kind: "cpu_validation",
  status: "success",
  title: "Stage4 vegetation final-visible semantic repair CPU support completed",
  titleZh: "Stage4 植被最终可见语义专项 CPU 支持完成",
  detailZh: "新候选以原始参考 RGB 和 vegetation 掩码增加边缘结构义务，CPU 正向 10/10、反向 20/20，旧 27 字段模式保持兼容。",
  evidencePath: projectPath(terminalPath),
  evidenceSha256: sha256(terminalPath),
  fixedTotalProgress: common.fixedTotalProgress,
})
console.log(JSON.stringify({ status: "recorded", terminal, supportContract: support, localTaskCapsule: { path: projectPath(capsulePath), sha256: sha256(capsulePath) } }, null, 2))
