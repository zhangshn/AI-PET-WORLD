import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = process.argv[2]
if (!/^[0-9]{8}-[0-9]{9}$/.test(runId ?? "")) throw new Error("runId is required")
const output = path.join(root, ".runtime", "ai-painter", "stage4-distribution-aware-visible-spatial-semantic-obligation-cpu", runId)
const authorizationRoot = path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-distribution-aware-visible-spatial-semantic-continuation-20260813-071500000")
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: hash(file) })
const configPath = path.join(output, "inactive-config.json")
const cpuPath = path.join(output, "cpu-report.json")
const authorizationPath = path.join(authorizationRoot, "implementation-authorization.json")
const consumptionPath = path.join(authorizationRoot, "implementation-consumption.json")
for (const file of [configPath, cpuPath, authorizationPath, consumptionPath]) if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
const cpu = JSON.parse(fs.readFileSync(cpuPath, "utf8"))
if (cpu.status !== "stage4_distribution_aware_visible_spatial_semantic_cpu_regression_passed") throw new Error("CPU report is not successful")
const timestamp = new Date().toISOString()
const common = {
  runId, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfig: bind(configPath), cpuReport: bind(cpuPath),
  implementationAuthorization: bind(authorizationPath), implementationConsumption: bind(consumptionPath),
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuUsed: false, trainingStarted: false,
}
const supportPath = path.join(output, "training-objective-support-contract.json")
const ownerPath = path.join(output, "owner-action-request.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
for (const file of [supportPath, ownerPath, terminalPath, capsulePath]) if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
writeJsonAtomic(supportPath, {
  schemaVersion: "ai-painter-stage4-distribution-aware-visible-spatial-semantic-support-contract-v1",
  status: "stage4_distribution_aware_visible_spatial_semantic_cpu_support_verified_inactive",
  contractId: "stage4_distribution_aware_visible_spatial_semantic_obligation_v1",
  objective: "worst_per_sample_per_class_final_visible_rgb_obligation",
  aggregation: { classReduction: "max_existing_derived_weighted_class_obligation", batchReduction: "max_per_sample_worst_class", trajectoryReduction: "max_existing_short_trajectory_decoded_predictions" },
  checkpointQualification: "worst_validation_sample_class_final_visible_rgb",
  newFreeHyperparameterSelected: false, failedPreviewUsedAsTrainingTarget: false, reviewThresholdUsedAsTrainingTarget: false,
  ...common,
})
writeJsonAtomic(ownerPath, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_executed", requestedAction: "one_readonly_gpu_distribution_aware_final_visible_rgb_qualification", nextAfterSuccess: "one_new_configuration_30_epoch_smoke", ...common })
const support = bind(supportPath), owner = bind(ownerPath)
writeJsonAtomic(terminalPath, { schemaVersion: "ai-painter-stage4-distribution-aware-visible-spatial-semantic-terminal-v1", status: "stage4_distribution_aware_visible_spatial_semantic_cpu_succeeded_closed", nextLegalAction: "separately_authorized_readonly_gpu_qualification", supportContract: support, ownerActionRequest: owner, ...common })
const terminal = bind(terminalPath)
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: common.fixedTotalProgress, currentStage: "Stage4 distribution-aware final visible RGB CPU complete", candidateTerminal: terminal, latestBlocker: null, nextLegalAction: "readonly GPU gradient qualification", forbiddenActions: ["historical_failed_run_execution", "review_threshold_training_target", "failed_preview_training_target", "free_hyperparameter_selection"], evidence: { inactiveConfig: common.inactiveConfig, cpuReport: common.cpuReport, supportContract: support }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: common.recordedAtAsiaShanghai })
for (const file of [supportPath, ownerPath, terminalPath, capsulePath]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_distribution_aware_cpu_support", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) }) }
appendAiPainterProgramEvent({ id: `stage4-distribution-aware-cpu-${runId}`, timestamp, action: "stage4_distribution_aware_visible_spatial_semantic_cpu_support", runId, kind: "cpu_validation", status: "success", title: "Stage4 distribution-aware visible semantic CPU support completed", titleZh: "Stage4 分布感知最终可见语义 CPU 支持完成", detailZh: "最差样本/类别约束 CPU 正向 8/8、反向 17/17，未读取 Checkpoint、未启动 GPU。", evidencePath: projectPath(terminalPath), evidenceSha256: hash(terminalPath), fixedTotalProgress: common.fixedTotalProgress })
console.log(JSON.stringify({ status: "recorded", terminal, supportContract: support, localTaskCapsule: bind(capsulePath) }, null, 2))
