import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const capabilityVersion = option("--capability-version");
const attemptDirectory = inside(option("--attempt-directory"));
const failureCode = option("--failure-code");
assert.match(capabilityVersion ?? "", /^[a-z0-9][a-z0-9-]{7,127}$/);
assert.match(failureCode ?? "", /^[a-z0-9][a-z0-9._:-]{7,255}$/);
const consumption = path.join(attemptDirectory, "internal-consumption.json");
const report = path.join(attemptDirectory, "gpu-failure-report.json");
const terminal = path.join(attemptDirectory, "phase-terminal.json");
assert.ok(fs.existsSync(consumption));
assert.equal(fs.existsSync(path.join(attemptDirectory, "gpu-report.json")), false);
assert.equal(fs.existsSync(report), false);
assert.equal(fs.existsSync(terminal), false);
const now = new Date().toISOString();
writeJsonAtomic(report, { schemaVersion: "stage4-authoritative-semantic-carrier-readonly-gpu-failure-report-v1", status: "failed_closed", failureCode, classification: "diagnostic_sample_semantic_mask_absent_not_model_gradient_failure", capabilityVersion, internalConsumption: bind(consumption), modelWeightsModified: false, optimizerCreated: false, backwardExecuted: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(terminal, { schemaVersion: "stage4-authoritative-semantic-carrier-readonly-gpu-failure-terminal-v1", executionState: "failed_closed", status: "readonly_gpu_qualification_attempt_failed_closed", failureCode, capabilityVersion, failureReport: bind(report), internalConsumption: bind(consumption), lifecycleAdvanced: false, retrySameConsumptionAllowed: false, ownerAuthorizationRequired: false, ownerResponseRequired: false, modelWeightsModified: false, trainingStarted: false, recordedAtUtc: now });
for (const file of [report, terminal]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: capabilityVersion, artifactType: "stage4_authoritative_semantic_carrier_readonly_gpu_failed_attempt_v1", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) }); }
appendAiPainterProgramEvent({ id: `stage4-authoritative-semantic-carrier-readonly-gpu-failure-${capabilityVersion}`, timestamp: now, action: "stage4_authoritative_semantic_carrier_readonly_gpu_failed_attempt_recorded", runId: capabilityVersion, kind: "readonly_gpu_qualification_failed_attempt", status: "failed", title: "Stage4 readonly GPU attempt failed closed", titleZh: "Stage4权威语义载体只读GPU首轮资格已保存失败证据", detailZh: "固定首条train记录缺少terrain_water掩码，零梯度被诊断入口误判；模型未修改，生命周期未推进。", evidencePath: relative(terminal), evidenceSha256: sha(terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } });
process.stdout.write(`${JSON.stringify({ status: "failed_attempt_recorded", terminal: bind(terminal), failureReport: bind(report), lifecycleAdvanced: false }, null, 2)}\n`);
function inside(relativePath) { assert.ok(typeof relativePath === "string" && relativePath && !path.isAbsolute(relativePath) && !/^[A-Za-z]:[\\/]/.test(relativePath) && !relativePath.split(/[\\/]/).includes("..")); const target = path.resolve(root, relativePath); assert.ok(target.startsWith(`${root}${path.sep}`)); return target; }
function relative(file) { return path.relative(root, file).replaceAll("\\", "/"); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function bind(file) { return { path: relative(file), sha256: sha(file) }; }

