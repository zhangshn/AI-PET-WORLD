// MVP shadow adapter for the EXISTING six-phase runner. Not a training scheduler
// or a capability release. Input selection comes only from the current registry.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { readCurrentExecutionRegistry, prepareCurrentExecutionRegistryAdvance, finalizePreparedCurrentExecutionRegistryAdvance } from "../../src/server/ai-painter-current-execution-registry.mjs";
import { materializeAutonomousClosedLoopPackage } from "./ai-painter-autonomous-package-materializer-v1.mjs";
import { adjudicateBoundedDecision } from "./ai-painter-autonomous-package-decision-core-v3.mjs";
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs";

export const ADAPTER = "scripts/lib/ai-painter-diagnostic-shadow-v1.mjs";
export const WORKER = "ml/ai-painter/scripts/verify_learning_capacity_diagnostic_shadow.py";
export const NODE_TEST = "scripts/tests/test-ai-painter-diagnostic-shadow.mjs";
export const PY_TEST = "ml/ai-painter/tests/test_diagnostic_shadow.py";
const PHASES = ["preflight", "execute", "validate", "review", "adjudicate", "finalize"];
const LIMITS = Object.freeze({ wallSeconds: 180, cpuThreads: 4, optimizerSteps: 0,
  newRollouts: 0, automaticRetries: 0, maxOutputMiB: 4 });
const exec = promisify(execFile);
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");

export function projectFile(root, value) {
  assert(typeof value === "string" && value.length > 0 && !path.isAbsolute(value)
    && !/^[A-Za-z]:/.test(value) && !value.includes("\\") && !value.split("/").includes(".."), "unsafe project path");
  const base = path.resolve(root), resolved = path.resolve(base, value);
  assert(resolved.startsWith(base + path.sep), "path escapes project");
  return resolved; // .runtime is the project's intentional data-volume junction.
}
export function boundJson(root, binding) {
  assert(/^[a-f0-9]{64}$/.test(binding?.sha256 ?? ""), "invalid bound hash");
  const data = fs.readFileSync(projectFile(root, binding.path));
  assert.equal(sha(data), binding.sha256, `evidence hash mismatch: ${binding.path}`);
  return JSON.parse(data);
}
function bind(root, name) { return { path: name, sha256: sha(fs.readFileSync(projectFile(root, name))) }; }
function verifyBindings(root, bindings) {
  const seen = new Map();
  for (const b of bindings) {
    assert(/^[a-f0-9]{64}$/.test(b.sha256), "invalid receipt hash");
    assert(!seen.has(b.path) || seen.get(b.path) === b.sha256, "conflicting receipts");
    assert.equal(bind(root, b.path).sha256, b.sha256, `input changed: ${b.path}`);
    seen.set(b.path, b.sha256);
  }
}
function persist(root, name, value) {
  const file = projectFile(root, name), data = bytes(value);
  if (fs.existsSync(file)) {
    assert(fs.readFileSync(file).equals(data), `immutable output conflict: ${name}`);
  } else {
    const fd = fs.openSync(file, "wx");
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  return bind(root, name);
}
export function requestOf(context) {
  const matches = context.inputEvidence.filter(b => b.path === `${context.outputRoot}/diagnostic-request.json`);
  assert.equal(matches.length, 1, "one diagnostic request required");
  const request = boundJson(context.projectRoot, matches[0]);
  assert.equal(request.schemaVersion, "ai-painter-diagnostic-shadow-request-v1");
  assert.equal(request.identity, context.packageIdentity);
  assert.equal(request.outputRoot, context.outputRoot);
  assert.equal(request.mode, "cpu_readonly_shadow_no_training_or_release");
  assert.deepEqual(request.limits, LIMITS, "shadow limits changed");
  return { request, requestBinding: matches[0] };
}
function phaseFile(context, phase) { return `${context.outputRoot}/${phase}.json`; }
export function loadPhase(context, phase) {
  // The runner's immutable phase evidence binds outputs; verify that link too.
  assert(PHASES.includes(phase), "unknown phase");
  const db = new DatabaseSync(path.join(context.executionRoot, "execution.sqlite"), { readOnly: true });
  let record;
  try {
    const rows = db.prepare("SELECT logical_path, sha256 FROM artifacts WHERE package_identity=? AND phase=?").all(context.packageIdentity, phase);
    assert.equal(rows.length, 1, `one ${phase} ledger artifact required`);
    [record] = rows;
  } finally { db.close(); }
  assert.equal(record.logical_path, `phase-evidence/${phase}-attempt-0.json`);
  const envelopeBytes = fs.readFileSync(path.join(context.executionRoot, record.logical_path));
  assert.equal(sha(envelopeBytes), record.sha256, "phase evidence differs from SQLite ledger");
  const envelope = JSON.parse(envelopeBytes);
  const binding = envelope.result?.artifact;
  assert.equal(binding?.path, phaseFile(context, phase));
  return boundJson(context.projectRoot, binding);
}

export async function prepareDiagnosticShadowPackage(root = process.cwd()) {
  const current = await readCurrentExecutionRegistry(root);
  assert(current.ok, "current registry unavailable; no historical fallback");
  assert.equal(current.registry.activeExecution, null, "another execution is active");
  const predecessorTerminal = { path: current.registry.terminalEvidence.path, sha256: current.registry.terminalEvidence.sha256 };
  let sourceResult = predecessorTerminal, source = boundJson(root, sourceResult);
  const predecessorEvidence = [];
  // Explicit failed-shadow succession only. Never search for an older successful
  // run or resurrect the failed package; changed source bytes need exact archives.
  if (source.status === "diagnostic_shadow_failed_closed") {
    assert.equal(source.executionState, "failed_closed");
    assert.equal(source.runId, current.registry.runId);
    const candidates = current.taskCapsule.evidence.filter(b => b.path.endsWith("/diagnostic-request.json"));
    assert.equal(candidates.length, 1, "failed task request is not uniquely bound");
    const requestBinding = { path: candidates[0].path, sha256: candidates[0].sha256 };
    const prior = boundJson(root, requestBinding);
    assert.equal(prior.identity, source.runId);
    assert.equal(prior.mode, "cpu_readonly_shadow_no_training_or_release");
    predecessorEvidence.push(predecessorTerminal, requestBinding);
    for (const receipt of prior.inputReceipts) {
      if (bind(root, receipt.path).sha256 !== receipt.sha256) {
        const snapshot = { path: `${prior.outputRoot}/source-snapshots/${receipt.sha256}/${path.posix.basename(receipt.path)}`, sha256: receipt.sha256 };
        verifyBindings(root, [snapshot]);
        predecessorEvidence.push(snapshot);
      }
    }
    sourceResult = prior.sourceResult;
    source = boundJson(root, sourceResult);
  }
  assert.equal(source.schemaVersion, "ai-painter-layer-diagnosis-result-v1", "current task is not the supported layer diagnostic");
  assert.equal(source.executionState, "completed");
  const plan = boundJson(root, source.plan), parent = boundJson(root, plan.sourcePlan);
  const modelPackage = boundJson(root, parent.adaptationPackage);
  assert.deepEqual(modelPackage.selectedRows.map(row => row.sampleId), plan.settings.samples);
  assert(modelPackage.selectedRows.every(row => row.split === "train") && modelPackage.selectedRows.length === 2);
  const files = [ADAPTER, WORKER, NODE_TEST, PY_TEST,
    "scripts/lib/ai-assisted-condition-alignment.mjs", "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs", "scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs",
    "scripts/lib/ai-painter-local-autonomy-governance-v3.mjs", "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
    "src/server/ai-painter-current-execution-registry.mjs", "package-lock.json"];
  const receipts = [...plan.inputReceipts, sourceResult, source.plan, parent.adaptationPackage, ...predecessorEvidence, ...files.map(f => bind(root, f))];
  verifyBindings(root, receipts);
  const inputReceipts = [...new Map(receipts.map(b => [b.path, b])).values()];
  const payload = { schemaVersion: "ai-painter-diagnostic-shadow-request-v1",
    mode: "cpu_readonly_shadow_no_training_or_release", sourceResult, sourcePlan: source.plan,
    expectedPreviousRevision: current.registry.registryRevision, expectedPreviousSha256: current.registrySha256,
    latestTrainingRunId: current.registry.latestTrainingTerminal.runId, predecessorEvidence,
    selectedRows: modelPackage.selectedRows, inputReceipts,
    limits: LIMITS };
  const identity = "diagnostic-shadow-" + sha(bytes(payload));
  const outputRoot = `.runtime/ai-painter/learning-capacity-experiments/${identity}`;
  fs.mkdirSync(projectFile(root, outputRoot), { recursive: false });
  const requestBinding = persist(root, `${outputRoot}/diagnostic-request.json`, { ...payload, identity, outputRoot });
  return materializeAutonomousClosedLoopPackage({
    schemaVersion: "ai-painter-autonomous-closed-loop-candidate-v1", packageIdentity: identity,
    capabilityVersion: identity, ownerAuthorizationRequired: false, maxInfrastructureRecoveryAttempts: 0,
    outputRoot, programFiles: { adapter: ADAPTER, worker: WORKER },
    inputEvidencePaths: [requestBinding.path, ...inputReceipts.map(b => b.path)],
    phaseAdapters: Object.fromEntries(PHASES.map(phase => [phase, { path: ADAPTER, exportName: phase }])),
  }, { root });
}

async function processResult(root, executable, args, timeout = 90000) {
  const { stdout, stderr } = await exec(executable, args, { cwd: root, timeout, windowsHide: true,
    maxBuffer: 1024 * 1024, env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1", PYTHONDONTWRITEBYTECODE: "1",
      PYTHONPATH: [path.join(root, "ml/ai-painter/src"), path.join(root, "ml/ai-painter/scripts")].join(path.delimiter) } });
  return { stdout, stderr };
}
function python(root) { return projectFile(root, "ml/ai-painter/.venv/Scripts/python.exe"); }

export async function retryTransientIo(operation, { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onRetry = () => {} } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try { return await operation(); } catch (error) {
      if (!["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt === 5) throw error;
      onRetry();
      await sleep(50 * (attempt + 1));
    }
  }
}

async function register(context, request, evidence, begin) {
  const root = context.projectRoot, current = await readCurrentExecutionRegistry(root);
  assert(current.ok, "registry unavailable");
  assert.equal(current.registry.latestTrainingTerminal.runId, request.latestTrainingRunId, "training identity changed");
  let activeExecution = null;
  if (begin) {
    validateLaunchSnapshot(request, current);
    const probe = await processResult(root, "powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${process.pid}'; [string]$p.ProcessId+':'+$p.CreationDate.ToUniversalTime().ToString('o')`], 10000);
    const identity = { capabilityVersion: request.identity, packageId: request.identity, runId: request.identity,
      processId: process.pid, processStartIdentity: probe.stdout.trim() };
    const lock = persist(root, `${context.outputRoot}/execution-lock.json`, { schemaVersion: "ai-painter-current-active-execution-lock-v1", ...identity });
    persist(root, `${context.outputRoot}/heartbeat.json`, { schemaVersion: "ai-painter-current-active-execution-heartbeat-v1",
      ...identity, executionState: "executing", heartbeatAtUtc: new Date().toISOString(), ttlSeconds: 120 });
    activeExecution = { schemaVersion: "ai-painter-current-active-execution-v1", ...identity, executionState: "executing",
      programLineage: { adapter: bind(root, ADAPTER), worker: bind(root, WORKER) }, lock,
      heartbeat: { path: `${context.outputRoot}/heartbeat.json`, ttlSeconds: 120 } };
  } else {
    assert.equal(current.registry.runId, request.identity, "current task changed");
    assert.equal(current.registry.activeExecution?.processId, process.pid, "execution ownership lost");
  }
  const value = boundJson(root, evidence);
  const capsule = persist(root, `${context.outputRoot}/${begin ? "begin" : "finish"}-capsule.json`, {
    schemaVersion: "ai-painter-local-task-capsule-v1", taskId: request.identity, integrity: { status: "verified" },
    evidence: [bind(root, `${context.outputRoot}/diagnostic-request.json`), evidence].map((b, i) => ({ ...b, kind: `diagnostic_shadow_${i}`, sha256Verified: true })) });
  const prepared = await prepareCurrentExecutionRegistryAdvance({ projectRoot: root, capabilityVersion: request.identity,
    packageId: request.identity, taskId: request.identity, runId: request.identity, taskKind: "cpu_diagnostic_shadow",
    taskGoal: "Replay train-only evidence and derive bounded diagnostic advice; no training or qualification",
    queueStatus: begin ? "running" : value.executionState, nextMachineAction: null, lifecycleStage: "isolated_implementation",
    executionState: begin ? "executing" : value.executionState, activity: begin ? "diagnostic_shadow_running" : value.status,
    taskCapsulePath: capsule.path, terminalEvidencePath: evidence.path, activeExecution,
    expectedPreviousRegistryRevision: current.registry.registryRevision, expectedPreviousRegistrySha256: current.registrySha256 });
  // Only finish the SAME prepared transaction again on transient file sharing.
  // Never repeat prepare/advance, the CPU worker, or a training operation.
  let ioRetries = 0;
  const result = await retryTransientIo(() => finalizePreparedCurrentExecutionRegistryAdvance({
    projectRoot: root, transactionId: prepared.transactionId }), { onRetry: () => { ioRetries++; } });
  assert(result.ok, JSON.stringify(result));
  const receipt = { revision: result.registry.registryRevision, sha256: result.registrySha256,
    transactionId: prepared.transactionId, transientCommitRetries: ioRetries };
  persist(root, `${context.outputRoot}/registry-${begin ? "begin" : "finish"}-receipt.json`, receipt);
  return receipt;
}

export function validateLaunchSnapshot(request, current) {
  assert.equal(current.ok, true, "current registry unavailable");
  assert.equal(current.registry.registryRevision, request.expectedPreviousRevision, "stale request revision");
  assert.equal(current.registrySha256, request.expectedPreviousSha256, "stale request identity");
  assert.equal(current.registry.activeExecution, null, "execution already active");
  assert.equal(current.registry.latestTrainingTerminal.runId, request.latestTrainingRunId, "training identity changed");
}

async function heartbeat(context) {
  await retryTransientIo(() => context.heartbeat());
  const target = projectFile(context.projectRoot, `${context.outputRoot}/heartbeat.json`);
  if (!fs.existsSync(target)) return;
  const value = JSON.parse(fs.readFileSync(target));
  assert.equal(value.processId, process.pid, "heartbeat ownership mismatch");
  value.heartbeatAtUtc = new Date().toISOString();
  const staged = target + ".staged";
  fs.writeFileSync(staged, bytes(value));
  await retryTransientIo(() => fs.renameSync(staged, target));
}

function remainingMilliseconds(context, request) {
  const start = JSON.parse(fs.readFileSync(projectFile(context.projectRoot, `${context.outputRoot}/started.json`)));
  assert.equal(start.runId, request.identity);
  const elapsed = Date.now() - Date.parse(start.startedAtUtc);
  assert(Number.isFinite(elapsed) && elapsed >= 0, "invalid run clock");
  const remaining = request.limits.wallSeconds * 1000 - elapsed;
  assert(remaining > 0, "diagnostic wall-time budget exceeded");
  const directory = projectFile(context.projectRoot, context.outputRoot);
  const total = fs.readdirSync(directory, { withFileTypes: true }).filter(e => e.isFile())
    .reduce((sum, e) => sum + fs.statSync(path.join(directory, e.name)).size, 0);
  assert(total <= request.limits.maxOutputMiB * 2 ** 20, "diagnostic output budget exceeded");
  return Math.max(1, Math.floor(remaining));
}

// A passed phase means this diagnostic operation completed, NOT visual approval.
async function phase(context, operation) {
  let request;
  let heartbeatError = null;
  let heartbeatInFlight = null;
  const timer = context.phase === "finalize" ? null : setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = heartbeat(context).then(() => remainingMilliseconds(context, request))
      .catch(error => { heartbeatError = error; }).finally(() => { heartbeatInFlight = null; });
  }, 5000);
  try {
    ({ request } = requestOf(context));
    verifyBindings(context.projectRoot, request.inputReceipts);
    if (context.phase === "preflight") persist(context.projectRoot, `${context.outputRoot}/started.json`, {
      runId: request.identity, startedAtUtc: new Date().toISOString() });
    remainingMilliseconds(context, request);
    await heartbeat(context);
    context.reportProgress({ message: `CPU diagnostic shadow: ${context.phase}; no training`, optimizerStep: 0 });
    const value = await operation(request);
    if (heartbeatInFlight) await heartbeatInFlight;
    if (context.phase !== "finalize") {
      verifyBindings(context.projectRoot, request.inputReceipts);
      remainingMilliseconds(context, request);
    }
    if (heartbeatError) throw heartbeatError;
    return value;
  } catch (error) {
    const artifact = persist(context.projectRoot, `${context.outputRoot}/failure-${context.phase}.json`, {
      status: "diagnostic_shadow_failed_closed", executionState: "failed_closed", runId: context.packageIdentity,
      phase: context.phase, error: String(error.stack ?? error), gpuStarted: false, trainingStarted: false,
      formalQualificationAllowed: false, recordedAtUtc: new Date().toISOString() });
    const current = await readCurrentExecutionRegistry(context.projectRoot);
    if (request && current.ok && current.registry.runId === request.identity && current.registry.activeExecution?.processId === process.pid) {
      await register(context, request, artifact, false);
    }
    return { status: "failed", failureKind: "evidence", failureCode: "diagnostic_shadow_check_failed", artifact };
  } finally { clearInterval(timer); if (heartbeatInFlight) await heartbeatInFlight; }
}

export const preflight = context => phase(context, async request => {
  assert.equal(path.resolve(process.cwd()), context.projectRoot, "alignment checker requires project cwd");
  const nodeTests = await processResult(context.projectRoot, process.execPath, ["--test", NODE_TEST], Math.min(60000, remainingMilliseconds(context, request)));
  const pythonTests = await processResult(context.projectRoot, python(context.projectRoot), ["-m", "unittest", "discover",
    "-s", "ml/ai-painter/tests", "-p", path.basename(PY_TEST), "-v"], Math.min(60000, remainingMilliseconds(context, request)));
  const artifact = persist(context.projectRoot, phaseFile(context, "preflight"), { status: "diagnostic_shadow_preflight_passed",
    executionState: "completed", nodeTests, pythonTests, mode: request.mode });
  await register(context, request, artifact, true);
  return { status: "passed", artifact };
});

export const execute = context => phase(context, async request => {
  const result = await processResult(context.projectRoot, python(context.projectRoot), [WORKER,
    "--source", request.sourceResult.path, "--source-sha256", request.sourceResult.sha256], Math.min(90000, remainingMilliseconds(context, request)));
  const replay = JSON.parse(result.stdout), alignment = [];
  for (const row of request.selectedRows) {
    remainingMilliseconds(context, request);
    const record = boundJson(context.projectRoot, row.sourceRecord);
    assert.equal(record.conditionBinding.conditionPackPath, row.conditionPack.path);
    assert.equal(bind(context.projectRoot, row.image.path).sha256, row.image.sha256);
    const audit = await auditAiAssistedConditionAlignment({ record, imagePath: projectFile(context.projectRoot, row.image.path) });
    alignment.push({ sampleId: row.sampleId, audit });
  }
  const artifact = persist(context.projectRoot, phaseFile(context, "execute"), { replay, alignment });
  return { status: "passed", artifact };
});

export function summarizeDiagnostic(source, replay, alignment) {
  assert.equal(replay.status, "replayed_exactly");
  assert.equal(replay.cudaInitialized, false); assert.equal(replay.optimizerSteps, 0); assert.equal(replay.newRollouts, 0);
  assert.equal(replay.modelStateSha256BeforeAndAfter, source.modelStateSha256BeforeAndAfter);
  assert.equal(replay.rowsReplayed, 6); assert.equal(replay.reconstructionControlsReplayed, 2);
  assert.equal(source.rows.length, 6); assert.equal(alignment.length, 2);
  const ids = [...new Set(source.rows.map(row => row.sampleId))];
  assert.equal(ids.length, 2);
  assert.deepEqual(alignment.map(row => row.sampleId), ids);
  const rows = source.rows.map(row => {
    assert.equal(row.targetEncodedForGeneration, false);
    const share = row.attribution.uncoveredShareOfTotalAbsoluteRgbError;
    const laplacianDelta = row.final.laplacianMae - row.base.laplacianMae;
    assert(Number.isFinite(share) && share >= 0 && share <= 1 && Number.isFinite(laplacianDelta), "invalid metrics");
    assert.equal(row.attribution.compositorEquationExact, true);
    return { sampleId: row.sampleId, seed: row.seed, uncoveredErrorShare: share, laplacianDelta };
  });
  for (const id of ids) assert.equal(new Set(rows.filter(row => row.sampleId === id).map(row => row.seed)).size, 3, "missing/duplicate seeds");
  for (const row of alignment) {
    assert.equal(typeof row.audit.passed, "boolean");
    assert.equal(row.audit.formalConditionalTrainingEligible, false);
    assert.equal(row.audit.passed, row.audit.issues.length === 0);
  }
  return { rows, sceneCount: 2, sampleSeedCount: 6, purpose: "train_only_diagnostic_not_generalization",
    uncoveredErrorShareRange: [Math.min(...rows.map(r => r.uncoveredErrorShare)), Math.max(...rows.map(r => r.uncoveredErrorShare))],
    finalLaplacianWorseCount: rows.filter(r => r.laplacianDelta > 0).length,
    coarseAlignmentPassedCount: alignment.filter(r => r.audit.passed).length,
    limitations: ["Coarse alignment is not pixel IoU or semantic VJ-2.", "Target reconstruction is not generation.",
      "Error attribution does not identify a unique root cause or authorize changing original RGB.",
      "This pilot does not publish a capability or schedule training."] };
}

export const validate = context => phase(context, async request => {
  const result = loadPhase(context, "execute");
  assert.deepEqual(result.replay.sourceResult, request.sourceResult);
  const summary = summarizeDiagnostic(boundJson(context.projectRoot, request.sourceResult), result.replay, result.alignment);
  return { status: "passed", artifact: persist(context.projectRoot, phaseFile(context, "validate"), summary) };
});

export const review = context => phase(context, async () => {
  const summary = loadPhase(context, "validate");
  return { status: "passed", artifact: persist(context.projectRoot, phaseFile(context, "review"), {
    scope: "diagnostic_evidence_review_not_visual_judge", summary, visualQualification: "not_assessed",
    automaticRepairAllowed: false, originalImagesRetained: true }) };
});

export function decideDiagnostic(summary, evidence) {
  assert.equal(summary?.rows?.length, 6, "six verified measurements required");
  assert(Number.isInteger(summary.coarseAlignmentPassedCount) && summary.coarseAlignmentPassedCount >= 0
    && summary.coarseAlignmentPassedCount <= 2, "invalid alignment summary");
  assert(summary.rows.every(r => Number.isFinite(r.uncoveredErrorShare) && r.uncoveredErrorShare >= 0
    && r.uncoveredErrorShare <= 1), "invalid attribution summary");
  // 0.5 means a mathematical majority of measured error, not a visual gate.
  const options = ["inspect_source_pairing", "inspect_base_generation_and_pairing", "inspect_head_composition_and_pairing", "stop_inconclusive"];
  const option = summary.coarseAlignmentPassedCount < 2 ? options[0]
    : summary.rows.every(r => r.uncoveredErrorShare > 0.5) ? options[1]
    : summary.rows.every(r => r.uncoveredErrorShare < 0.5) ? options[2] : options[3];
  return { ...adjudicateBoundedDecision({ decisionSetId: "train-diagnostic-shadow", ruleVersion: "diagnostic-advice-v1",
    optionIds: options, matchedOptionIds: [option], evidenceReferences: [evidence], evidenceComplete: true }),
    disposition: "advice_only_stop_at_scope_boundary", applied: false, nextMachineAction: null,
    stopReason: "No repair or training executor is included in this CPU diagnostic shadow package." };
}

export const adjudicate = context => phase(context, async () => {
  const reviewValue = loadPhase(context, "review"), evidence = bind(context.projectRoot, phaseFile(context, "review"));
  return { status: "passed", artifact: persist(context.projectRoot, phaseFile(context, "adjudicate"), decideDiagnostic(reviewValue.summary, evidence)) };
});

export const finalize = context => phase(context, async request => {
  const decision = loadPhase(context, "adjudicate"), reviewValue = loadPhase(context, "review");
  const artifact = persist(context.projectRoot, phaseFile(context, "finalize"), {
    schemaVersion: "ai-painter-diagnostic-shadow-result-v1", runId: request.identity,
    status: "diagnostic_shadow_completed_not_visual_qualified", executionState: "completed",
    sourceResult: request.sourceResult, summary: reviewValue.summary, decision,
    evidence: PHASES.slice(0, -1).map(p => bind(context.projectRoot, phaseFile(context, p))),
    gpuStarted: false, trainingStarted: false, optimizerSteps: 0, formalQualificationAllowed: false,
    migrationStatus: "shadow_validated_not_production_cutover", recordedAtUtc: new Date().toISOString() });
  verifyBindings(context.projectRoot, request.inputReceipts);
  remainingMilliseconds(context, request);
  await register(context, request, artifact, false);
  return { status: "passed", artifact };
});
