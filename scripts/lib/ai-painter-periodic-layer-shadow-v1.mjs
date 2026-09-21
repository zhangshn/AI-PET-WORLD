// Paired periodic-layer diagnosis through the EXISTING six-phase runner.
// Current-registry source only. No training dispatch or capability release.
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

export const ADAPTER = "scripts/lib/ai-painter-periodic-layer-shadow-v1.mjs";
export const WORKER = "ml/ai-painter/scripts/diagnose_paired_periodic_layers.py";
export const NODE_TEST = "scripts/tests/test-ai-painter-periodic-layer-shadow.mjs";
export const PY_TEST = "ml/ai-painter/tests/test_paired_periodic_layers.py";
const PHASES = ["preflight", "execute", "validate", "review", "adjudicate", "finalize"];
const LIMITS = Object.freeze({ wallSeconds: 300, cpuThreads: 4, optimizerSteps: 0,
  fixedSeedRollouts: 12, automaticRetries: 0, maxOutputMiB: 4 });
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
  assert.equal(request.schemaVersion, "ai-painter-periodic-layer-shadow-request-v1");
  assert.equal(request.identity, context.packageIdentity);
  assert.equal(request.outputRoot, context.outputRoot);
  assert.equal(request.mode, "cpu_paired_periodic_layer_diagnosis_no_training_or_release");
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

export async function preparePeriodicLayerShadowPackage(root = process.cwd()) {
  const current = await readCurrentExecutionRegistry(root);
  assert(current.ok, "current registry unavailable; no historical fallback");
  assert.equal(current.registry.activeExecution, null, "another execution is active");
  const sourceCurrent = { path: current.registry.terminalEvidence.path, sha256: current.registry.terminalEvidence.sha256 };
  const previous = boundJson(root, sourceCurrent);
  assert.equal(previous.schemaVersion, "ai-painter-training-result-shadow-result-v1", "current task is not the prerequisite replay");
  assert.equal(previous.executionState, "completed");
  assert.equal(previous.status, "training_result_shadow_completed_not_visual_qualified");
  assert.equal(previous.runId, current.registry.runId);
  const sourceResult = previous.sourceResult;
  assert.deepEqual(sourceResult, {path: current.registry.latestTrainingTerminal.path, sha256: current.registry.latestTrainingTerminal.sha256});
  const source = boundJson(root, sourceResult);
  assert.equal(source.schemaVersion, "ai-painter-timestep-ab-result-v1", "current task is not the supported paired training result");
  assert.equal(source.executionState, "completed");
  assert.equal(source.status, "experiment_executed_not_visual_qualified");
  assert.equal(current.registry.latestTrainingTerminal.runId, source.runId, "source is not the current training terminal");
  assert.equal(source.optimizerSteps, 2000); assert.equal(source.checkpointReloadExact, true);
  assert.equal(sourceResult.path, `.runtime/ai-painter/learning-capacity-experiments/${source.runId}/result.json`);
  const sourcePackage = bind(root, path.posix.dirname(sourceResult.path) + "/experiment.json");
  const modelPackage = boundJson(root, sourcePackage);
  assert.equal(modelPackage.experimentIdentity, source.runId);
  assert.equal(modelPackage.schemaVersion, "ai-painter-timestep-ab-package-v1");
  assert(modelPackage.selectedRows.every(row => row.split === "train") && modelPackage.selectedRows.length === 2);
  const files = [ADAPTER, WORKER, NODE_TEST, PY_TEST,
    "scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs",
    "scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs", "scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs",
    "scripts/lib/ai-painter-local-autonomy-governance-v3.mjs", "scripts/run-ai-painter-autonomous-closed-loop-package.mjs",
    "src/server/ai-painter-current-execution-registry.mjs", "package-lock.json",
    "scripts/lib/ai-painter-training-result-shadow-v1.mjs", "ml/ai-painter/scripts/verify_timestep_experiment_replay.py"];
  const receipts = [...modelPackage.inputReceipts, sourceCurrent, sourceResult, sourcePackage, ...source.artifacts, ...files.map(f => bind(root, f))];
  verifyBindings(root, receipts);
  const inputReceipts = [...new Map(receipts.map(b => [b.path, b])).values()];
  const payload = { schemaVersion: "ai-painter-periodic-layer-shadow-request-v1",
    mode: "cpu_paired_periodic_layer_diagnosis_no_training_or_release", sourceCurrent, sourceResult, sourcePackage,
    expectedPreviousRevision: current.registry.registryRevision, expectedPreviousSha256: current.registrySha256,
    latestTrainingRunId: current.registry.latestTrainingTerminal.runId,
    selectedRows: modelPackage.selectedRows, inputReceipts, limits: LIMITS };
  const identity = "periodic-layer-shadow-" + sha(bytes(payload));
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

async function processResult(root, executable, args, timeout = 240000) {
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
    evidence: [bind(root, `${context.outputRoot}/diagnostic-request.json`), evidence].map((b, i) => ({ ...b, kind: `periodic_layer_shadow_${i}`, sha256Verified: true })) });
  const prepared = await prepareCurrentExecutionRegistryAdvance({ projectRoot: root, capabilityVersion: request.identity,
    packageId: request.identity, taskId: request.identity, runId: request.identity, taskKind: "cpu_periodic_layer_shadow",
    taskGoal: "Locate periodic residuals across frozen reconstruction, generated decode and RGB composition; no repair or training",
    queueStatus: begin ? "running" : value.executionState, nextMachineAction: null, lifecycleStage: "isolated_implementation",
    executionState: begin ? "executing" : value.executionState, activity: begin ? "periodic_layer_shadow_running" : value.status,
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
    context.reportProgress({ message: `CPU frozen-result replay: ${context.phase}; no training`, optimizerStep: 0 });
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
      status: "periodic_layer_shadow_failed_closed", executionState: "failed_closed", runId: context.packageIdentity,
      phase: context.phase, error: String(error.stack ?? error), gpuStarted: false, trainingStarted: false,
      formalQualificationAllowed: false, recordedAtUtc: new Date().toISOString() });
    const current = await readCurrentExecutionRegistry(context.projectRoot);
    if (request && current.ok && current.registry.runId === request.identity && current.registry.activeExecution?.processId === process.pid) {
      await register(context, request, artifact, false);
    }
    return { status: "failed", failureKind: "evidence", failureCode: "periodic_layer_shadow_check_failed", artifact };
  } finally { clearInterval(timer); if (heartbeatInFlight) await heartbeatInFlight; }
}

export const preflight = context => phase(context, async request => {
  assert.equal(path.resolve(process.cwd()), context.projectRoot, "alignment checker requires project cwd");
  const nodeTests = await processResult(context.projectRoot, process.execPath, ["--test", NODE_TEST], Math.min(60000, remainingMilliseconds(context, request)));
  const pythonTests = await processResult(context.projectRoot, python(context.projectRoot), ["-m", "unittest", "discover",
    "-s", "ml/ai-painter/tests", "-p", path.basename(PY_TEST), "-v"], Math.min(60000, remainingMilliseconds(context, request)));
  const artifact = persist(context.projectRoot, phaseFile(context, "preflight"), { status: "periodic_layer_shadow_preflight_passed",
    executionState: "completed", nodeTests, pythonTests, mode: request.mode });
  await register(context, request, artifact, true);
  return { status: "passed", artifact };
});

export const execute = context => phase(context, async request => {
  const result = await processResult(context.projectRoot, python(context.projectRoot), [WORKER,
    "--source", request.sourceResult.path, "--source-sha256", request.sourceResult.sha256],
    Math.min(240000, remainingMilliseconds(context, request)));
  const replay = JSON.parse(result.stdout);
  const artifact = persist(context.projectRoot, phaseFile(context, "execute"), { replay });
  return { status: "passed", artifact };
});

import { summarizeTrainingComparison } from "./ai-painter-training-result-shadow-v1.mjs";
const COMPONENTS = ["reconstruction","generatedDecodeIncrement","compositionIncrement"];
const VECTOR_NAMES = [...COMPONENTS,"baseResidual","finalResidual"];
const PHASE_METRIC = "phase4ResidualRmsAfterGlobalBiasRemoval";
function finite(v) { assert(typeof v==="number" && Number.isFinite(v),"nonfinite numeric evidence"); return v; }
function close(a,b,tolerance=1e-12) { assert(Math.abs(finite(a)-finite(b))<=tolerance,"numeric identity mismatch"); }
function energy(v) { return v.reduce((n,x)=>n+x*x,0)/v.length; }
export function verifyPhaseDecomposition(d, row) {
  assert.deepEqual(Object.keys(d.vectors).sort(), [...VECTOR_NAMES].sort());
  const v={};
  for(const name of VECTOR_NAMES) {
    assert.equal(d.vectors[name].length,16);
    assert(d.vectors[name].every(p=>Array.isArray(p)&&p.length===3));
    v[name]=d.vectors[name].flat().map(finite);
    for(let c=0;c<3;c++) close(v[name].filter((_,i)=>i%3===c).reduce((a,b)=>a+b,0)/16,0,1e-10);
    close(d.energies[name],energy(v[name]));
  }
  let maxError=0;
  for(let i=0;i<48;i++) {
    close(v.baseResidual[i],v.reconstruction[i]+v.generatedDecodeIncrement[i],1e-10);
    maxError=Math.max(maxError,Math.abs(COMPONENTS.reduce((n,k)=>n+v[k][i],0)-v.finalResidual[i]));
  }
  assert(maxError<1e-10); close(d.telescopingMaxError,maxError);
  let sum=COMPONENTS.reduce((n,k)=>n+energy(v[k]),0);
  const keys=[];
  for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) {
    const a=COMPONENTS[i],b=COMPONENTS[j],key=a+"__"+b;keys.push(key);
    const cross=2*v[a].reduce((n,x,k)=>n+x*v[b][k],0)/48;
    close(d.crossTerms[key],cross);sum+=cross;
  }
  assert.deepEqual(Object.keys(d.crossTerms).sort(),keys.sort());
  close(d.summedEnergy,sum);close(sum,energy(v.finalResidual));
  // Float64 attribution vs the existing float32 metric: numerical tolerance only.
  for(const [name,label] of [["reconstruction","reconstruction"],["baseResidual","base"],["finalResidual","final"]])
    close(Math.sqrt(energy(v[name])),row[label][PHASE_METRIC],1e-8);
}
export function summarizePeriodicLayers(source,replay) {
  const paired=summarizeTrainingComparison(source,replay);
  assert.equal(replay.schemaVersion,"ai-painter-paired-periodic-layer-diagnosis-v1");
  assert.equal(replay.modelAndNormalizationUnchanged,true);assert.equal(replay.sourcePngPixelsReproduced,12);
  assert.equal(replay.reconstructions.length,2);assert.equal(replay.layers.length,12);
  assert(/^[a-f0-9]{64}$/.test(replay.commonFrozenStateSha256));
  const rows=replay.layers.map((r,i)=>{
    const saved=source.rows[i],recon=replay.reconstructions[Math.floor((i%6)/3)];
    assert.deepEqual([r.arm,r.sampleId,r.seed],[saved.arm,saved.sampleId,saved.seed]);
    assert.equal(recon.sampleId,r.sampleId);assert.equal(recon.split,"train");
    assert.equal(recon.purpose,"target_reconstruction_diagnostic_only");
    assert.deepEqual(r.reconstruction,recon.metrics);assert.equal(r.reconstructionTensorSha256,recon.tensorSha256);
    for(const k of ["tensorSha256"]) assert(/^[a-f0-9]{64}$/.test(recon[k]));
    assert.deepEqual(r.base,saved.measurements.base);assert.deepEqual(r.final,saved.measurements.final);
    assert.equal(r.pngPixelsExact,true);assert(source.artifacts.some(b=>b.path===r.baselinePng.path&&b.sha256===r.baselinePng.sha256));
    assert.equal(r.outsideCoverageMaxAbsoluteChange,0);
    assert.equal(r.coverageFraction,saved.measurements.coverageFraction);
    assert.deepEqual(r.regions,saved.measurements.regions);
    for(const k of ["rgbMae","laplacianMae",PHASE_METRIC]) for(const layer of ["reconstruction","base","final"])
      assert(finite(r[layer][k])>=0);
    assert(finite(r.normalizedLatentMseAgainstEncodedTarget)>=0);
    assert(/^[a-f0-9]{64}$/.test(r.noiseStateSha256)&&/^[a-f0-9]{64}$/.test(r.generatedLatentSha256));
    if(i>=6)assert.equal(r.noiseStateSha256,replay.layers[i-6].noiseStateSha256);
    verifyPhaseDecomposition(r.phaseDecomposition,r);
    return {arm:r.arm,sampleId:r.sampleId,seed:r.seed,
      reconstruction:r.reconstruction[PHASE_METRIC],base:r.base[PHASE_METRIC],final:r.final[PHASE_METRIC],
      baseMinusReconstruction:r.base[PHASE_METRIC]-r.reconstruction[PHASE_METRIC],
      finalMinusBase:r.final[PHASE_METRIC]-r.base[PHASE_METRIC],
      rgb:{reconstruction:r.reconstruction.rgbMae,base:r.base.rgbMae,final:r.final.rgbMae},
      laplacian:{reconstruction:r.reconstruction.laplacianMae,base:r.base.laplacianMae,final:r.final.laplacianMae}};
  });
  return {paired,rows,reconstructionCount:2,layerComparisonCount:12,formalQualification:false,
    scope:"layer_boundary_priority_not_unique_architectural_root_cause",
    limitations:replay.limitations};
}

export const validate = context => phase(context, async request => {
  const result = loadPhase(context, "execute");
  assert.deepEqual(result.replay.sourceResult, request.sourceResult);
  const summary = summarizePeriodicLayers(boundJson(context.projectRoot, request.sourceResult), result.replay);
  return { status: "passed", artifact: persist(context.projectRoot, phaseFile(context, "validate"), summary) };
});

export const review = context => phase(context, async () => {
  const summary = loadPhase(context, "validate");
  return { status: "passed", artifact: persist(context.projectRoot, phaseFile(context, "review"), {
    scope: "diagnostic_evidence_review_not_visual_judge", summary, visualQualification: "not_assessed",
    automaticRepairAllowed: false, originalImagesRetained: true }) };
});

export function decidePeriodicLayers(summary,evidence) {
  assert.equal(summary?.rows?.length,12,"complete layer matrix required");
  for(const r of summary.rows) {
    for(const k of ["reconstruction","base","final"]) assert(finite(r[k])>=0);
    assert.equal(r.baseMinusReconstruction,r.base-r.reconstruction);
    assert.equal(r.finalMinusBase,r.final-r.base);
  }
  const rows=summary.rows;
  const options=["generated_latent_decode_boundary_priority","rgb_composition_boundary_priority",
    "reconstruction_boundary_priority","indeterminate_layer_attribution"];
  const conditions=[
    rows.every(r=>r.base>r.reconstruction&&r.final<=r.base),
    rows.every(r=>r.final>r.base&&r.final>r.reconstruction),
    rows.every(r=>r.reconstruction>=r.base&&r.reconstruction>=r.final)
  ];
  const matched=conditions.flatMap((v,i)=>v?[options[i]]:[]);
  const option=matched.length===1?matched[0]:options[3];
  return {...adjudicateBoundedDecision({decisionSetId:"periodic-layer-shadow",ruleVersion:"signed-phase-boundary-v1",
    optionIds:options,matchedOptionIds:[option],evidenceReferences:[evidence],evidenceComplete:true}),
    disposition:"diagnostic_priority_only_no_automatic_repair",applied:false,nextMachineAction:null,
    uniqueRootCauseProven:false,
    stopReason:"Layer attribution cannot establish a unique model or objective fix; no optimizer or model mutation is dispatched."};
}

export const adjudicate = context => phase(context, async () => {
  const reviewValue = loadPhase(context, "review"), evidence = bind(context.projectRoot, phaseFile(context, "review"));
  return { status: "passed", artifact: persist(context.projectRoot, phaseFile(context, "adjudicate"), decidePeriodicLayers(reviewValue.summary, evidence)) };
});

export const finalize = context => phase(context, async request => {
  const decision = loadPhase(context, "adjudicate"), reviewValue = loadPhase(context, "review");
  const artifact = persist(context.projectRoot, phaseFile(context, "finalize"), {
    schemaVersion: "ai-painter-periodic-layer-shadow-result-v1", runId: request.identity,
    status: "periodic_layer_shadow_completed_not_visual_qualified", executionState: "completed",
    sourceCurrent: request.sourceCurrent, sourceResult: request.sourceResult, summary: reviewValue.summary, decision,
    evidence: PHASES.slice(0, -1).map(p => bind(context.projectRoot, phaseFile(context, p))),
    gpuStarted: false, trainingStarted: false, optimizerSteps: 0, formalQualificationAllowed: false,
    migrationStatus: "shadow_validated_not_production_cutover", migratedFunctions: ["current_result_binding", "frozen_cpu_layer_replay", "exact_source_png_replay", "signed_periodic_error_decomposition", "independent_layer_boundary_advice", "transactional_finalization"], recordedAtUtc: new Date().toISOString() });
  verifyBindings(context.projectRoot, request.inputReceipts);
  remainingMilliseconds(context, request);
  await register(context, request, artifact, false);
  return { status: "passed", artifact };
});
