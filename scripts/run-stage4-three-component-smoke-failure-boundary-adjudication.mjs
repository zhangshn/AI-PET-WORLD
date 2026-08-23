import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateThreeComponentSmokeFailure } from "./lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => { assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const read = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const freshJson = (target, body) => { fs.mkdirSync(path.dirname(target), { recursive: true }); const handle = fs.openSync(target, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }

const authorizationArg = arg("--authorization"); const authorizationSha256 = arg("--authorization-sha256"); const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = file(authorizationArg); const consumptionPath = file(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_sha256_mismatch")
const authorization = read(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-three-component-smoke-failure-boundary-adjudication-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_three_component_smoke_failure_boundary_causal_adjudication")
assert.equal(authorization.oneTimeConsumption, true)
for (const key of ["checkpointWeightsReadAuthorized", "gpuAuthorized", "optimizerAuthorized", "backwardAuthorized", "trainingAuthorized", "smokeAuthorized", "stage0Authorized", "stage1Authorized", "stage2Authorized"]) assert.equal(authorization[key], false, `${key}_must_be_false`)
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")
for (const [name, item] of Object.entries(authorization.sourceEvidence)) { const target = file(item.path); assert.equal(/\.pt$/iu.test(item.path), false, `${name}_checkpoint_forbidden`); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), item.sha256, `${name}_sha256_mismatch`) }
const programs = { runner: file("scripts/run-stage4-three-component-smoke-failure-boundary-adjudication.mjs"), checker: file("scripts/check-stage4-three-component-smoke-failure-boundary-adjudication.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs") }
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), "program_lineage_mismatch")
const output = file(authorization.outputNamespace); assert.equal(fs.existsSync(output), false, "output_namespace_already_exists")
const check = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" }); assert.equal(check.status, 0, `cpu_regression_failed:${check.stderr || check.stdout}`)
const cpu = JSON.parse(check.stdout); assert.equal(cpu.positivePassed, cpu.positiveTotal); assert.equal(cpu.negativePassed, cpu.negativeTotal)

const consumedAtUtc = new Date().toISOString()
freshJson(consumptionPath, { schemaVersion: "stage4-three-component-smoke-failure-boundary-adjudication-consumption-v1", status: "cpu_readonly_adjudication_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorizationPath: authorizationArg, authorizationSha256, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) })
const evidence = authorization.sourceEvidence
const manifests = [read(file(evidence.terrainManifest.path)), read(file(evidence.objectManifest.path)), read(file(evidence.finalManifest.path))]
const review = read(file(evidence.review.path))
const result = adjudicateThreeComponentSmokeFailure({ manifests, review, directWiringDefectEvidence: false, finalErasureComparisonEvidence: false })
assert.equal(result.selectedCause, "A", "bound_evidence_did_not_select_A")
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })
const now = new Date().toISOString()
const files = { problem: path.join(output, "problem-report.json"), analysis: path.join(output, "causal-analysis-report.json"), decision: path.join(output, "adjudication.json"), exit: path.join(output, "route-exit-record.json"), owner: path.join(output, "owner-decision-request.json"), cpu: path.join(output, "cpu-report.json"), terminal: path.join(output, "phase-terminal.json"), capsule: path.join(output, "local-task-capsule.json"), planSync: path.join(output, "plan-sync-record.json") }
const componentSummary = manifests.map((item) => ({ roleId: item.roleId, status: item.status, epochCount: item.epochCount, firstTrainingCompositeLoss: item.metrics[0].trainingCompositeLoss, finalTrainingCompositeLoss: item.metrics.at(-1).trainingCompositeLoss, weightsChanged: item.modelStateHashes.weightsChanged, predecessorConsumption: item.predecessorConsumption, outputIdentity: item.outputIdentity }))
writeJsonAtomic(files.problem, { schemaVersion: "stage4-three-component-smoke-failure-boundary-problem-report-v1", status: "real_visual_failure_confirmed", fixedReviewNodes: review.reviews.map((item) => ({ epoch: item.epoch, passed: item.passed, professionalAestheticPassed: item.professionalAesthetic.passed, conditionAlignmentPassed: item.conditionAlignment.passed, issueCodes: item.issueCodes })), componentSummary, checkpointWeightsRead: false, recordedAtUtc: now })
writeJsonAtomic(files.analysis, { schemaVersion: "stage4-three-component-smoke-failure-boundary-causal-analysis-v1", status: "causal_boundary_converged", ...result, sourceEvidence: evidence, componentSummary, finalErasureComparisonAvailable: false, explanation: "The exact predecessor chain rules out a wiring identity defect. All three losses improve and aesthetic review passes, but water, road-boundary and all four object semantic failures persist at every fixed node. No bound before/after semantic comparison isolates the final component, so C is not proven; the unique supported boundary is A.", recordedAtUtc: now })
writeJsonAtomic(files.decision, { schemaVersion: "stage4-three-component-smoke-failure-boundary-adjudication-v1", status: "unique_decision_recorded", selectedCause: result.selectedCause, selectedDecision: result.selectedDecision, alternativesRejected: { B: "exact predecessor output and consumption hashes match", C: "no bound predecessor-versus-final semantic comparison proves erasure", D: "completion, identity and five-node failure evidence are complete" }, recordedAtUtc: now })
writeJsonAtomic(files.exit, { schemaVersion: "stage4-controlled-three-component-route-exit-record-v1", status: "controlled_three_component_training_route_exited", reason: result.selectedDecision, rerunAllowed: false, additionalSameClassLossAllowed: false, checkpointReuseAllowed: false, stage0Allowed: false, recordedAtUtc: now })
writeJsonAtomic(files.owner, { schemaVersion: "stage4-post-three-component-route-project-owner-decision-request-v1", status: "owner_project_level_route_decision_required", requestedDecision: "select_pause_or_authorize_one_bounded_project_level_generation_or_model_family_review", automaticExpansionAllowed: false, automaticTrainingAllowed: false, prohibited: ["rerun_same_smoke", "add_same_class_loss", "reuse_failed_checkpoint", "free_hyperparameter_search", "lower_review_thresholds"], recordedAtUtc: now })
writeJsonAtomic(files.cpu, { ...cpu, status: "stage4_three_component_smoke_failure_boundary_cpu_passed", authorization: bind(authorizationPath), consumption: bind(consumptionPath), selectedCause: result.selectedCause, checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, recordedAtUtc: now })
writeJsonAtomic(files.terminal, { schemaVersion: "stage4-three-component-smoke-failure-boundary-terminal-v1", status: "three_component_semantic_supervision_insufficient_route_exited", selectedCause: result.selectedCause, fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, problemReport: bind(files.problem), causalAnalysisReport: bind(files.analysis), adjudication: bind(files.decision), routeExitRecord: bind(files.exit), ownerDecisionRequest: bind(files.owner), cpuReport: bind(files.cpu), checkpointWeightsRead: false, gpuStarted: false, trainingStarted: false, nextLegalAction: "owner_project_level_route_decision", recordedAtUtc: now })
writeJsonAtomic(files.capsule, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", currentStage: "Stage4 controlled three-component Smoke failure boundary adjudicated", status: "route_exited_waiting_owner_project_level_decision", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, latestTerminal: bind(files.terminal), nextLegalAction: "owner_project_level_route_decision", recordedAtUtc: now })
const planPath = file("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"); const planBefore = sha(planPath); let plan = fs.readFileSync(planPath, "utf8")
plan = plan.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ").replace("+08:00", " +08:00")}`)
plan = plan.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；Stage4受控三组件Smoke真实视觉失败已完成CPU只读因果裁决，唯一裁决A，当前三组件训练路线正式退出并等待Owner项目级路线决定")
plan = plan.replace(/## 4\. 最近一次模块终态[\s\S]*?## 5\. 当前阻断与唯一下一动作[\s\S]*?(?=## 6\.)/, "## 4. 最近一次模块终态\n\n受控三组件Smoke的三个组件均完成30 Epoch，训练Loss下降、权重变化且前序输出SHA-256逐级匹配，但五张固定预览均只通过专业画面审核，水体、道路边界和四类对象条件语义在全部节点持续失败。CPU只读裁决唯一选择A：现有责任划分或监督语义不足；当前三组件训练路线正式退出。\n\n## 5. 当前阻断与唯一下一动作\n\n当前固定进度保持3/5（60%）。唯一下一动作是Owner项目级路线决定；不得重跑同一Smoke、增加同类Loss、复用失败Checkpoint、自由调参或自动启动Stage 0/1/2。\n\n")
const planTemp = `${planPath}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(planTemp, plan, "utf8"); fs.renameSync(planTemp, planPath)
writeJsonAtomic(files.planSync, { schemaVersion: "stage4-three-component-smoke-failure-boundary-plan-sync-v1", status: "unique_plan_synchronized", planPath: rel(planPath), beforeSha256: planBefore, afterSha256: sha(planPath), terminal: bind(files.terminal), recordedAtUtc: now })
for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) { const stat = fs.statSync(target); indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_three_component_smoke_failure_boundary_adjudication", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(target) }) }
appendAiPainterProgramEvent({ id: `stage4-three-component-smoke-failure-boundary-${authorization.runId}`, timestamp: now, action: "stage4_three_component_smoke_failure_boundary_causal_adjudication", runId: authorization.runId, kind: "cpu_readonly_causal_adjudication", status: "success", title: "Stage4 three-component Smoke failure boundary adjudicated", titleZh: "Stage4三组件Smoke失败边界完成裁决", detailZh: "三个组件训练与前序身份链完整，但五节点条件语义持续失败；唯一裁决A，当前三组件训练路线退出。", evidencePath: rel(files.terminal), evidenceSha256: sha(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
process.stdout.write(`${JSON.stringify({ status: read(files.terminal).status, selectedCause: result.selectedCause, terminal: bind(files.terminal), causalAnalysisReport: bind(files.analysis), adjudication: bind(files.decision), routeExitRecord: bind(files.exit), ownerDecisionRequest: bind(files.owner), cpuReport: bind(files.cpu), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } }, null, 2)}\n`)
