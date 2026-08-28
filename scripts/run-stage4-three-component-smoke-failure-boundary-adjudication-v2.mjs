import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { adjudicateThreeComponentSmokeFailure } from "./lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs";
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs";
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs";
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs";

const ROOT = process.cwd();
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const file = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return target; };
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex");
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/");
const bind = (value) => ({ path: rel(value), sha256: sha(value) });
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"));

const packageArg = arg("--package");
const packageSha256 = arg("--package-sha256");
assert.ok(packageArg && packageSha256, "local_internal_package_arguments_required");
const packagePath = file(packageArg);
assert.equal(sha(packagePath), packageSha256, "local_internal_package_sha256_mismatch");
const taskPackage = read(packagePath);
assert.equal(taskPackage.schemaVersion, "stage4-three-component-smoke-failure-boundary-local-package-v2");
assert.equal(taskPackage.status, "package_materialized");
assert.equal(taskPackage.generatedBy, "local_ai_pet_world_program");
assert.equal(taskPackage.ownerAuthorizationRequired, false);
assert.equal(taskPackage.action, "stage4_three_component_smoke_failure_boundary_causal_adjudication");
assert.match(taskPackage.runId, /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,159}$/);
for (const key of ["checkpointWeightsReadAllowed", "gpuAllowed", "optimizerAllowed", "backwardAllowed", "trainingAllowed"]) assert.equal(taskPackage[key], false, `${key}_must_be_false`);

const programs = {
  runner: file("scripts/run-stage4-three-component-smoke-failure-boundary-adjudication-v2.mjs"),
  checker: file("scripts/check-stage4-three-component-smoke-failure-boundary-adjudication-v2.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs"),
};
assert.deepEqual(taskPackage.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch");
for (const [name, item] of Object.entries(taskPackage.sourceEvidence)) {
  const target = file(item.path);
  assert.equal(/\.(pt|pth|ckpt|safetensors)$/iu.test(item.path), false, `${name}_checkpoint_forbidden`);
  assert.equal(fs.existsSync(target), true, `${name}_missing`);
  assert.equal(sha(target), item.sha256, `${name}_sha256_mismatch`);
}
const output = file(taskPackage.outputNamespace);
assert.equal(fs.existsSync(output), false, "output_namespace_already_exists");
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" });
assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr || check.stdout}`);
const cpu = JSON.parse(check.stdout);
assert.equal(cpu.positivePassed, cpu.positiveTotal);
assert.equal(cpu.negativePassed, cpu.negativeTotal);

const evidence = taskPackage.sourceEvidence;
const manifests = [read(file(evidence.terrainManifest.path)), read(file(evidence.objectManifest.path)), read(file(evidence.finalManifest.path))];
const review = read(file(evidence.review.path));
const result = adjudicateThreeComponentSmokeFailure({
  manifests,
  review,
  directWiringDefectEvidence: taskPackage.directWiringDefectEvidence === true,
  finalErasureComparisonEvidence: taskPackage.finalErasureComparisonEvidence === true,
});

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.mkdirSync(output, { recursive: false });
const now = new Date().toISOString();
const files = {
  problem: path.join(output, "problem-report.json"),
  analysis: path.join(output, "causal-analysis-report.json"),
  decision: path.join(output, "adjudication.json"),
  action: path.join(output, "local-next-action.json"),
  cpu: path.join(output, "cpu-report.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
};
const componentSummary = manifests.map((item) => ({
  roleId: item.roleId,
  status: item.status,
  epochCount: item.epochCount,
  firstTrainingCompositeLoss: item.metrics[0].trainingCompositeLoss,
  finalTrainingCompositeLoss: item.metrics.at(-1).trainingCompositeLoss,
  weightsChanged: item.modelStateHashes.weightsChanged,
  predecessorConsumption: item.predecessorConsumption,
  outputIdentity: item.outputIdentity,
}));
writeJsonAtomic(files.problem, { schemaVersion: "stage4-three-component-smoke-failure-boundary-problem-report-v2", status: "real_visual_failure_confirmed", fixedReviewNodes: review.reviews.map((item) => ({ epoch: item.epoch, passed: item.passed, professionalAestheticPassed: item.professionalAesthetic.passed, conditionAlignmentPassed: item.conditionAlignment.passed, issueCodes: item.issueCodes })), componentSummary, checkpointWeightsRead: false, recordedAtUtc: now });
writeJsonAtomic(files.analysis, { schemaVersion: "stage4-three-component-smoke-failure-boundary-causal-analysis-v2", status: "causal_boundary_converged", ...result, sourceEvidence: evidence, componentSummary, recordedAtUtc: now });
writeJsonAtomic(files.decision, { schemaVersion: "stage4-three-component-smoke-failure-boundary-adjudication-v2", status: result.selectedCause === "D" ? "failed_closed" : "uniquely_adjudicated", failureCode: result.selectedCause === "D" ? "evidence_ambiguous" : null, selectedCause: result.selectedCause, selectedDecision: result.selectedDecision, ownerResponseRequired: false, recordedAtUtc: now });

const nextLocalAction = result.selectedCause === "A"
  ? "local_ai_materialize_bounded_generation_or_model_family_change_candidate"
  : result.selectedCause === "B" || result.selectedCause === "C"
    ? "local_ai_materialize_bounded_inactive_wiring_repair_candidate"
    : "failed_closed_preserve_evidence_no_automatic_expansion";
writeJsonAtomic(files.action, { schemaVersion: "stage4-local-autonomous-next-action-v1", status: result.selectedCause === "D" ? "failed_closed" : "materialized_not_started", action: nextLocalAction, selectedCause: result.selectedCause, ownerAuthorizationRequired: false, ownerResponseRequired: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_three_component_smoke_failure_boundary_cpu_passed", localInternalPackage: bind(packagePath), selectedCause: result.selectedCause, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-three-component-smoke-failure-boundary-terminal-v2", executionState: result.selectedCause === "D" ? "failed_closed" : "completed", status: "three_component_smoke_failure_boundary_adjudicated", failureCode: result.selectedCause === "D" ? "evidence_ambiguous" : null, selectedCause: result.selectedCause, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, problemReport: bind(files.problem), causalAnalysisReport: bind(files.analysis), adjudication: bind(files.decision), localNextAction: bind(files.action), cpuReport: bind(files.cpu), ownerAuthorizationRequired: false, ownerResponseRequired: false, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now });
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v2", module: "AI Painter R5", currentStage: "Stage4 controlled three-component Smoke failure boundary adjudicated", status: result.selectedCause === "D" ? "failed_closed" : "local_next_action_materialized_not_started", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, latestTerminal: bind(files.terminal), nextLocalAction, ownerAuthorizationRequired: false, ownerResponseRequired: false, recordedAtUtc: now });

const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md");
const planBefore = sha(planPath);
let plan = fs.readFileSync(planPath, "utf8");
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ").replace("+08:00", " +08:00")}`);
plan = plan.replace(/^状态：.*$/m, `状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4三组件Smoke失败边界已由本地程序裁决为${result.selectedCause}，不等待Owner授权`);
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-three-component-smoke-failure-boundary-plan-sync-v2", status: "plan_status_projection_recorded", planPath: rel(planPath), beforeSha256: planBefore, projectedStatusLine: plan.match(/^状态：.*$/m)?.[0] ?? null, markdownMutationDeferredToDocumentGovernance: true, terminal: bind(files.terminal), recordedAtUtc: now });

for (const target of [packagePath, ...Object.values(files)]) {
  const stat = fs.statSync(target);
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: taskPackage.runId, artifactType: "stage4_three_component_smoke_failure_boundary_adjudication_v2", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) });
}
appendAiPainterProgramEvent({ id: `stage4-three-component-smoke-failure-boundary-v2-${taskPackage.runId}`, timestamp: now, action: "stage4_three_component_smoke_failure_boundary_causal_adjudication", runId: taskPackage.runId, kind: "cpu_readonly_causal_adjudication", status: "success", title: "Stage4 three-component Smoke failure boundary adjudicated locally", titleZh: "Stage4三组件Smoke失败边界已由本地程序裁决", detailZh: `唯一裁决${result.selectedCause}；不生成Owner请求，不等待人工授权。`, evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } });
process.stdout.write(`${JSON.stringify({ status: read(files.terminal).status, selectedCause: result.selectedCause, terminal: bind(files.terminal), causalAnalysisReport: bind(files.analysis), adjudication: bind(files.decision), localNextAction: bind(files.action), ownerAuthorizationRequired: false, cpuReport: bind(files.cpu), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2)}\n`);
