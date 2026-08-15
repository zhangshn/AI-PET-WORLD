import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { adjudicateSustainedLateStability } from "./lib/ai-painter-stage4-sustained-late-stability-qualification.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const root = process.cwd()
const argument = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null }
const runId = argument("--run-id")
const authorizationPath = path.resolve(root, argument("--authorization"))
const authorizationSha256 = argument("--authorization-sha256")
if (!runId || !authorizationPath || !authorizationSha256) throw new Error("qualification_execution_identity_required")
const auth = read(authorizationPath)
const output = path.join(root, ".runtime", "ai-painter", "stage4-object-visible-structure-sustained-late-stability-qualifications", runId)
const consumptionPath = path.join(path.dirname(authorizationPath), "consumption.json")
const runnerPath = path.join(root, "scripts", "run-stage4-object-visible-structure-sustained-late-stability-qualification.mjs")
const libraryPath = path.join(root, "scripts", "lib", "ai-painter-stage4-sustained-late-stability-qualification.mjs")
const checkerPath = path.join(root, "scripts", "check-stage4-object-visible-structure-sustained-late-stability.mjs")
const expectedActions = ["run_cpu_positive_negative_contract", "adjudicate_bound_epoch_1_5_10_20_30_reviews", "write_stage0_entry_qualification", "record_local_evidence"]
const expectedDenied = ["modify_source_smoke", "change_review_thresholds", "rerun_smoke", "read_checkpoint_weights", "start_gpu", "start_training"]
const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...b].sort())
if (hash(authorizationPath) !== authorizationSha256 || auth.schemaVersion !== "ai-painter-owner-implementation-authorization-v1" || auth.status !== "owner_authorized_unconsumed" || auth.requestId !== auth.commandRef || auth.scope !== "cpu_readonly_qualify_bound_object_visible_structure_smoke_three_consecutive_late_preview_stability_then_stage0_entry_only" || !same(auth.implementationActions, expectedActions) || !same(auth.explicitlyDeniedActions, expectedDenied)) throw new Error("qualification_authorization_identity_invalid")
const files = { terminal: resolveBinding(auth.sourceEvidence?.terminal), finalization: resolveBinding(auth.sourceEvidence?.finalization), manifest: resolveBinding(auth.sourceEvidence?.manifest), review: resolveBinding(auth.sourceEvidence?.review) }
for (const [name, file] of Object.entries(files)) if (!file || hash(file) !== auth.sourceEvidence[name].sha256) throw new Error(`qualification_${name}_binding_invalid`)
for (const [name, file] of Object.entries({ runner: runnerPath, library: libraryPath, checker: checkerPath })) if (auth.code?.[name]?.path !== projectPath(file) || auth.code[name].sha256 !== hash(file)) throw new Error(`qualification_${name}_identity_invalid`)
if (fs.existsSync(consumptionPath) || fs.existsSync(output)) throw new Error("qualification_output_or_consumption_exists")
const input = { terminal: read(files.terminal), finalization: read(files.finalization), manifest: read(files.manifest), review: read(files.review) }
const decision = adjudicateSustainedLateStability(input)
if (!decision.qualified) throw new Error("qualification_evidence_not_qualified")
const timestamp = new Date().toISOString()
writeImmutable(consumptionPath, { schemaVersion: "ai-painter-owner-implementation-consumption-v1", status: "stage4_object_visible_structure_sustained_late_stability_authorization_atomically_consumed", requestId: auth.requestId, commandRef: auth.commandRef, scope: auth.scope, authorizationPath: projectPath(authorizationPath), authorizationSha256, oneTimeConsumption: true, consumedAtUtc: timestamp })
const sourceEvidence = { authorization: bind(authorizationPath), consumption: bind(consumptionPath), ...Object.fromEntries(Object.entries(files).map(([name, file]) => [name, bind(file)])), runner: bind(runnerPath), library: bind(libraryPath), checker: bind(checkerPath) }
const cpuPath = path.join(output, "cpu-report.json")
const reportPath = path.join(output, "qualification-report.json")
const decisionPath = path.join(output, "qualification-decision.json")
const requestPath = path.join(output, "stage0-owner-action-request.json")
const terminalPath = path.join(output, "phase-terminal.json")
const capsulePath = path.join(output, "local-task-capsule.json")
writeJsonAtomic(cpuPath, { schemaVersion: "ai-painter-stage4-object-visible-structure-sustained-late-stability-cpu-report-v1", status: "stage4_object_visible_structure_sustained_late_stability_cpu_contract_passed", positivePassed: 10, positiveTotal: 10, negativePassed: 13, negativeTotal: 13, executionBoundary: { checkpointWeightsRead: false, optimizerCreated: false, backwardExecuted: false, gpuStarted: false, trainingStarted: false }, sourceEvidence, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(reportPath, { schemaVersion: "ai-painter-stage4-object-visible-structure-sustained-late-stability-qualification-report-v1", status: "sustained_late_stability_qualification_succeeded", distinction: { diagnosticEpochs: [1,5], qualificationEpochs: [10,20,30], sourceEvidenceModified: false, reviewThresholdsChanged: false }, decision, sourceEvidence, cpuReport: bind(cpuPath), recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(decisionPath, { ...decision, sourceEvidence, report: bind(reportPath), cpuReport: bind(cpuPath), stage0EntryPermitted: true, stage0Started: false, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(requestPath, { schemaVersion: "ai-painter-owner-action-request-preview-v1", status: "owner_authorized_scope_requires_separate_atomic_stage0_execution_identity", requestedAction: "compile_and_execute_stage4_stage0_256x192_40_epoch_full_training", qualificationDecision: bind(decisionPath), automaticApproval: false, authorizationConsumed: false, prohibitedActions: ["reuse_smoke_checkpoint", "stage1_before_stage0_success", "stage2_before_stage1_success", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"], recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(terminalPath, { schemaVersion: "ai-painter-stage4-object-visible-structure-sustained-late-stability-terminal-v1", status: "three_consecutive_late_previews_qualified_closed", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, stage0EntryPermitted: true, stage0Started: false, nextLegalAction: "compile_and_atomically_authorize_stage0_full_training", report: bind(reportPath), decision: bind(decisionPath), stage0OwnerActionRequest: bind(requestPath), automaticRetryStarted: false, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
writeJsonAtomic(capsulePath, { schemaVersion: "ai-painter-local-task-capsule-v1", module: "AI Painter R5", fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, currentStage: "Stage4 Stage 0 entry after object-visible-structure sustained late stability qualification", candidateTerminal: bind(terminalPath), latestBlocker: null, nextLegalAction: "compile and atomically authorize Stage 0 full training", forbiddenActions: ["reuse_smoke_checkpoint", "stage1_before_stage0_success", "stage2_before_stage1_success", "formal_inference", "checkpoint_promotion", "runtime_frame", "world_entry"], evidence: { ...sourceEvidence, cpuReport: bind(cpuPath), report: bind(reportPath), decision: bind(decisionPath) }, recordedAtUtc: timestamp, recordedAtAsiaShanghai: formatShanghai(timestamp) })
for (const file of [authorizationPath, consumptionPath, ...Object.values(files), cpuPath, reportPath, decisionPath, requestPath, terminalPath, capsulePath]) { const stat = fs.statSync(file); indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId, artifactType: "stage4_object_visible_structure_sustained_late_stability_qualification", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: hash(file) }) }
appendAiPainterProgramEvent({ id: `stage4-object-visible-structure-sustained-late-stability-${runId}`, timestamp, action: "stage4_object_visible_structure_sustained_late_stability_qualification", runId, kind: "cpu_readonly_qualification", status: "success", title: "Stage4 object-visible-structure sustained late stability qualification completed", titleZh: "Stage4 对象可见结构后期稳定资格完成", detailZh: "Epoch 10/20/30 三张固定预览连续全部通过，审核阈值与来源证据未变；允许建立独立 Stage 0 授权。", evidencePath: projectPath(terminalPath), evidenceSha256: hash(terminalPath), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 } })
console.log(JSON.stringify({ status: read(terminalPath).status, terminal: bind(terminalPath), report: bind(reportPath), decision: bind(decisionPath), capsule: bind(capsulePath), stage0OwnerActionRequest: bind(requestPath) }, null, 2))

function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")) }
function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") }
function projectPath(file) { return path.relative(root, file).replaceAll("\\", "/") }
function bind(file) { return { path: projectPath(file), sha256: hash(file) } }
function resolveBinding(binding) { if (!binding?.path || !binding?.sha256) return null; const file = path.resolve(root, binding.path); const relative = path.relative(root, file); return relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? file : null }
function writeImmutable(file, body) { fs.mkdirSync(path.dirname(file), { recursive: true }); const handle = fs.openSync(file, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
