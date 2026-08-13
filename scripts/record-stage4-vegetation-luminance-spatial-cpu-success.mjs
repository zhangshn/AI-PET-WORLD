import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const runId = "20260813-034000000"
const output = path.join(root, ".runtime", "ai-painter", "stage4-vegetation-luminance-spatial-structure-supervision", runId)
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const projectPath = (file) => path.relative(root, file).replace(/\\/g, "/")
const bind = (file) => ({ path: projectPath(file), sha256: sha256(file) })
const configPath = path.join(output, "inactive-config.json")
const cpuPath = path.join(output, "cpu-report.json")
const authPath = path.join(root, ".runtime", "ai-painter", "owner-action-requests", "owner-authorized-stage4-vegetation-luminance-spatial-structure-supervision-20260813-034000000", "implementation-authorization.json")
const consumptionPath = path.join(path.dirname(authPath), "implementation-consumption.json")
for (const file of [configPath, cpuPath, authPath, consumptionPath]) if (!fs.existsSync(file)) throw new Error(`missing evidence: ${projectPath(file)}`)
const cpu = JSON.parse(fs.readFileSync(cpuPath, "utf8"))
if (cpu.status !== "stage4_vegetation_luminance_spatial_structure_cpu_regression_passed") throw new Error("CPU report is not successful")
const timestamp = new Date().toISOString()
const common = {
  runId, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  inactiveConfig: bind(configPath), cpuReport: bind(cpuPath), implementationAuthorization: bind(authPath), implementationConsumption: bind(consumptionPath),
  checkpointRead: false, optimizerCreated: false, backwardExecuted: false, gpuUsed: false, trainingStarted: false,
}
const supportPath = path.join(output, "training-objective-support-contract.json")
const ownerPath = path.join(output, "owner-action-request.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
for (const file of [supportPath, ownerPath, terminalPath, capsulePath]) if (fs.existsSync(file)) throw new Error(`immutable output exists: ${projectPath(file)}`)
writeJsonAtomic(supportPath, {
  schemaVersion: "ai-painter-stage4-vegetation-luminance-spatial-structure-support-contract-v1",
  status: "stage4_vegetation_luminance_spatial_structure_cpu_support_verified_inactive",
  contractId: "stage4_vegetation_luminance_spatial_structure_supervision_v1",
  legalSupervision: "original_owner_approved_reference_rgb_and_object_vegetation_mask",
  lossFunction: "one_minus_masked_zero_mean_normalized_luminance_correlation",
  luminanceCoefficients: [0.2126, 0.7152, 0.0722], derivedWeight: 0.23529411764705882,
  diagnosticManifestFieldCount: 29, reviewThresholdUsedAsTrainingTarget: false,
  ...common,
})
writeJsonAtomic(ownerPath, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "not_executed", requestedAction: "one_readonly_gpu_vegetation_luminance_spatial_gradient_qualification", nextAfterSuccess: "one_new_configuration_30_epoch_smoke", ...common })
const support = bind(supportPath), owner = bind(ownerPath)
writeJsonAtomic(terminalPath, { schemaVersion: "ai-painter-stage4-vegetation-luminance-spatial-structure-terminal-v1", status: "stage4_vegetation_luminance_spatial_structure_cpu_succeeded_closed", nextLegalAction: "separately_authorized_readonly_gpu_qualification", supportContract: support, ownerActionRequest: owner, ...common })
const terminal = bind(terminalPath)
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: common.fixedTotalProgress, currentStage: "Stage4 vegetation luminance-spatial supervision CPU complete", candidateTerminal: terminal, latestBlocker: null, nextLegalAction: "readonly GPU gradient qualification", forbiddenActions: ["review_threshold_training_target", "failed_preview_training_target", "free_hyperparameter_selection"], evidence: { inactiveConfig: common.inactiveConfig, cpuReport: common.cpuReport, supportContract: support }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: common.recordedAtAsiaShanghai })
for (const file of [supportPath, ownerPath, terminalPath, capsulePath]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha256(file) }) }
appendAiPainterProgramEvent({ id: `stage4-vegetation-luminance-spatial-cpu-${runId}`, timestamp, action: "stage4_vegetation_luminance_spatial_structure_cpu_support", runId, kind: "cpu_validation", status: "success", title: "Stage4 vegetation luminance-spatial supervision CPU support completed", titleZh: "Stage4 植被亮度—空间结构监督 CPU 支持完成", detailZh: "仅使用原始批准参考 RGB 与 object_vegetation 掩码；CPU 正向 11/11、反向 22/22。", evidencePath: projectPath(terminalPath), evidenceSha256: sha256(terminalPath), fixedTotalProgress: common.fixedTotalProgress })
console.log(JSON.stringify({ status: "recorded", terminal, supportContract: support, localTaskCapsule: bind(capsulePath) }, null, 2))
