// Target-free endpoint RGB gradient validation through the EXISTING six-phase runner.
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

export const ADAPTER = "scripts/lib/ai-painter-endpoint-gradient-shadow-v1.mjs";
export const WORKER = "ml/ai-painter/scripts/verify_endpoint_rgb_experiment.py";
export const NODE_TEST = "scripts/tests/test-ai-painter-endpoint-gradient-shadow.mjs";
export const PY_TEST = "ml/ai-painter/tests/test_endpoint_rgb_experiment.py";
const PHASES = ["preflight", "execute", "validate", "review", "adjudicate", "finalize"];
const LIMITS = Object.freeze({ wallSeconds: 300, cpuThreads: 4, optimizerSteps: 0,
  fixedSeedRollouts: 6, automaticRetries: 0, maxOutputMiB: 4 });
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
  assert.equal(request.schemaVersion, "ai-painter-endpoint-gradient-shadow-request-v1");
  assert.equal(request.identity, context.packageIdentity);
  assert.equal(request.outputRoot, context.outputRoot);
  assert.equal(request.mode, "cpu_endpoint_rgb_gradient_probe_no_optimizer");
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
  assert.equal(envelope.result?.status, "passed", "upstream phase did not pass");
  const binding = envelope.result?.artifact;
  assert.equal(binding?.path, phaseFile(context, phase));
  return boundJson(context.projectRoot, binding);
}

export function validatePredecessor(previous, registry) {
  assert.equal(previous.schemaVersion, "ai-painter-rgb-composition-shadow-result-v1", "current task is not the prerequisite RGB diagnosis");
  assert.equal(previous.executionState, "completed");
  assert.equal(previous.status, "rgb_composition_shadow_completed_not_visual_qualified");
  assert.equal(previous.runId, registry.runId);
}
export function samplingOutputRoot(binding) {
  assert(typeof binding?.path === "string" && path.posix.basename(binding.path) === "execute.json", "sampling execute binding required");
  projectFile(process.cwd(), binding.path);
  assert(/^[a-f0-9]{64}$/.test(binding.sha256), "sampling evidence hash required");
  return path.posix.dirname(binding.path);
}
export async function prepareEndpointGradientShadowPackage(root = process.cwd()) {
  const current = await readCurrentExecutionRegistry(root);
  assert(current.ok, "current registry unavailable; no historical fallback");
  assert.equal(current.registry.activeExecution, null, "another execution is active");
  const sourceCurrent = { path: current.registry.terminalEvidence.path, sha256: current.registry.terminalEvidence.sha256 };
  const previous = boundJson(root, sourceCurrent);
  validatePredecessor(previous, current.registry);
  const sourceSampling = previous.sourceSampling;
  assert(sourceSampling, "current sampling execute evidence missing");
  const sampled = boundJson(root, sourceSampling).replay;
  const sourceResult = previous.sourceResult;
  assert.deepEqual(sourceResult, {path: current.registry.latestTrainingTerminal.path, sha256: current.registry.latestTrainingTerminal.sha256});
  const source = boundJson(root, sourceResult);
  assert.equal(source.schemaVersion, "ai-painter-timestep-ab-result-v1", "current task is not the supported paired training result");
  assert.equal(source.executionState, "completed");
  assert.equal(source.status, "experiment_executed_not_visual_qualified");
  assert.equal(current.registry.latestTrainingTerminal.runId, source.runId, "source is not the current training terminal");
  assert.equal(source.optimizerSteps, 2000); assert.equal(source.checkpointReloadExact, true);
  assert.equal(sourceResult.path, `.runtime/ai-painter/learning-capacity-experiments/${source.runId}/result.json`);
  summarizePairedSampling(source, sampled, samplingOutputRoot(sourceSampling));
  const parentArm="legacy_global_schedule_control";
  const matches=source.arms.filter(a=>a.arm===parentArm);assert.equal(matches.length,1);
  const parentCheckpoint=matches[0].checkpoint;
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
  const receipts = [...modelPackage.inputReceipts, sourceCurrent, sourceSampling, sourceResult, sourcePackage,
    ...previous.evidence, ...sampled.images, ...source.artifacts,
    bind(root,"scripts/lib/ai-painter-paired-sampling-shadow-v1.mjs"),
    bind(root,"ml/ai-painter/scripts/compare_decoder_adapted_sampling.py"),
    bind(root,"ml/ai-painter/scripts/diagnose_learning_capacity_layers.py"),
    bind(root,"ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py"), ...files.map(f => bind(root, f))];
  verifyBindings(root, receipts);
  const inputReceipts = [...new Map(receipts.map(b => [b.path, b])).values()];
  const payload = { schemaVersion: "ai-painter-endpoint-gradient-shadow-request-v1",
    mode: "cpu_endpoint_rgb_gradient_probe_no_optimizer", sourceCurrent, sourceSampling, sourceResult, sourcePackage, parentArm, parentCheckpoint,
    proposal: { status:"candidate_path_cpu_probe_only", mode:"full_pure_noise_endpoint_rgb_supervision",
      existingTrainingLoopUnchanged:true, trainingDispatchEnabled:false, targetSource:"the_same_two_original_train_RGBs",
      rgbLoss:"existing_11_RGB_terms_and_weights_not_the_full_old_composite_objective",
      frozen:["Autoencoder","five_RGB_heads","normalization","conditions","original_data","default_configuration"],
      candidateTrainable:"Denoiser_except_RGB_heads", inferenceSteps:10,
      nextRequiredEvidence:["exact_candidate_GPU_no_update_forward_backward_and_resource_probe",
        "finite_paired_training_budget_and_baseline_with_original_single_step_training_preserved",
        "all_six_seed_endpoint_and_five_region_comparison_with_regressions_retained"],
      noQualificationOrRuntimeEntry:true },
    expectedPreviousRevision: current.registry.registryRevision, expectedPreviousSha256: current.registrySha256,
    latestTrainingRunId: current.registry.latestTrainingTerminal.runId,
    selectedRows: modelPackage.selectedRows, inputReceipts, limits: LIMITS };
  const identity = "endpoint-gradient-shadow-" + sha(bytes(payload));
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

async function processResult(root, executable, args, timeout = 360000) {
  const { stdout, stderr } = await exec(executable, args, { cwd: root, timeout, windowsHide: true,
    maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CUDA_VISIBLE_DEVICES: "", PYTHONIOENCODING: "utf-8",
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
    evidence: [bind(root, `${context.outputRoot}/diagnostic-request.json`), evidence].map((b, i) => ({ ...b, kind: `endpoint_gradient_shadow_${i}`, sha256Verified: true })) });
  const prepared = await prepareCurrentExecutionRegistryAdvance({ projectRoot: root, capabilityVersion: request.identity,
    packageId: request.identity, taskId: request.identity, runId: request.identity, taskKind: "cpu_endpoint_gradient_shadow",
    taskGoal: "Verify the current control checkpoint's target-free endpoint RGB gradients on CPU; no optimizer or training",
    queueStatus: begin ? "running" : value.executionState, nextMachineAction: null, lifecycleStage: "isolated_implementation",
    executionState: begin ? "executing" : value.executionState, activity: begin ? "endpoint_gradient_shadow_running" : value.status,
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
      status: "endpoint_gradient_shadow_failed_closed", executionState: "failed_closed", runId: context.packageIdentity,
      phase: context.phase, error: String(error.stack ?? error), gpuStarted: false, trainingStarted: false,
      formalQualificationAllowed: false, recordedAtUtc: new Date().toISOString() });
    const current = await readCurrentExecutionRegistry(context.projectRoot);
    if (request && current.ok && current.registry.runId === request.identity && current.registry.activeExecution?.processId === process.pid) {
      await register(context, request, artifact, false);
    }
    return { status: "failed", failureKind: "evidence", failureCode: "endpoint_gradient_shadow_check_failed", artifact };
  } finally { clearInterval(timer); if (heartbeatInFlight) await heartbeatInFlight; }
}

export const preflight = context => phase(context, async request => {
  assert.equal(path.resolve(process.cwd()), context.projectRoot, "alignment checker requires project cwd");
  const nodeTests = await processResult(context.projectRoot, process.execPath, ["--test", NODE_TEST], Math.min(60000, remainingMilliseconds(context, request)));
  const pythonTests = await processResult(context.projectRoot, python(context.projectRoot), ["-m", "unittest", "discover",
    "-s", "ml/ai-painter/tests", "-p", path.basename(PY_TEST), "-v"], Math.min(60000, remainingMilliseconds(context, request)));
  const artifact = persist(context.projectRoot, phaseFile(context, "preflight"), { status: "endpoint_gradient_shadow_preflight_passed",
    executionState: "completed", nodeTests, pythonTests, mode: request.mode });
  await register(context, request, artifact, true);
  return { status: "passed", artifact };
});

export const execute = context => phase(context, async request => {
  const result = await processResult(context.projectRoot, python(context.projectRoot), [WORKER,
    "--request", `${context.outputRoot}/diagnostic-request.json`, "--request-sha256",
    bind(context.projectRoot,`${context.outputRoot}/diagnostic-request.json`).sha256],
    Math.min(360000, remainingMilliseconds(context, request)));
  const replay = JSON.parse(result.stdout);
  const artifact = persist(context.projectRoot, phaseFile(context, "execute"), { replay });
  return { status: "passed", artifact };
});



import { summarizePairedSampling } from "./ai-painter-paired-sampling-shadow-v1.mjs";
const ARM="legacy_global_schedule_control";
const RGB_KEYS=["decodedRgb","decodedRgbGradient","decodedRgbLaplacian","decodedRgbQuietRegionExcess","sparseRegionDecodedRgb",
  "sparseRegionContrast","spatialGridRgb","pathBoundaryRgb","objectSemanticRgb","pathInteriorRgb","pathForbiddenBoundaryRgb"];
function finite(v){assert(typeof v==="number"&&Number.isFinite(v)&&v>=0,"invalid nonnegative numeric evidence");return v;}
export function summarizeEndpointGradient(sampled,replay,expectedWeights,parentCheckpoint) {
  assert.equal(replay.schemaVersion,"ai-painter-endpoint-rgb-gradient-probe-v1");
  assert.equal(replay.status,"cpu_endpoint_gradient_verified_not_trained");
  for(const [k,v] of Object.entries({fixedSeedRollouts:6,backwardProbes:2,sourcePngPixelsReproduced:6,imagesWritten:0,
    checkpointsWritten:0,optimizerSteps:0,cudaInitialized:false,modelAndNormalizationUnchanged:true}))assert.equal(replay[k],v);
  assert.deepEqual(replay.parentCheckpoint,parentCheckpoint);
  assert(/^[a-f0-9]{64}$/.test(replay.modelStateSha256BeforeAndAfter));
  const weights=Object.fromEntries(Object.entries(expectedWeights).filter(([k])=>RGB_KEYS.includes(k)));
  assert.deepEqual(Object.keys(weights).sort(),[...RGB_KEYS].sort());assert.deepEqual(replay.rgbLossWeights,weights);
  Object.values(weights).forEach(finite);
  const expected=sampled.rows.filter(r=>r.arm===ARM&&r.steps===10);
  assert.equal(expected.length,6);assert.equal(replay.rows.length,6);
  assert.deepEqual(replay.rows.map(r=>[r.arm,r.sampleId,r.seed,r.steps]),expected.map(r=>[r.arm,r.sampleId,r.seed,r.steps]));
  const backward=[];
  for(let i=0;i<6;i++){
    const r=replay.rows[i],e=expected[i];
    for(const [k,v] of Object.entries({split:"train",fullEndpoint:true,targetUsedForInitialization:false,targetEncoded:false,baselineExact:true}))assert.equal(r[k],v);
    assert.equal(r.noiseStateSha256,e.noiseStateSha256);assert.deepEqual(r.image,e.image);assert.deepEqual(r.measurements,e.measurements);
    finite(r.objective);assert.deepEqual(Object.keys(r.objectiveTerms).sort(),[...RGB_KEYS].sort());Object.values(r.objectiveTerms).forEach(finite);
    const sum=Object.entries(weights).reduce((total,[k,w])=>total+w*r.objectiveTerms[k],0);
    assert(Math.abs(sum-r.objective)<=1e-6*Math.max(1,sum),"RGB objective does not match exact existing term weights");
    if(i%3===0){
      const g=r.gradient;assert(g&&g.baseOutputReached===true&&Number.isInteger(g.nonzeroParameterCount)&&g.nonzeroParameterCount>0);
      assert(finite(g.gradientL2)>0);assert.equal(g.frozenAeGradientCount,0);assert.equal(g.frozenHeadGradientCount,0);
      assert.equal(g.activationCheckpointing,true);assert.equal(g.optimizerCreated,false);backward.push({sampleId:r.sampleId,seed:r.seed,...g});
    }else assert.equal(r.gradient,null,"undeclared backward probe");
  }
  return {rowsChecked:6,pngBaselinesExact:6,backwardProbes:backward,existingRgbLossWeights:weights,
    modelStateSha256BeforeAndAfter:replay.modelStateSha256BeforeAndAfter,modelChanged:false,
    cpuCandidatePathVerified:true,gpuCandidateQualified:false,trainingExecuted:false,formalVisualQualification:false,limitations:replay.limitations};
}
export const validate=context=>phase(context,async request=>{
  const replay=loadPhase(context,"execute").replay;
  for(const key of ["sourceResult","sourceSampling","sourcePackage","parentCheckpoint"])assert.deepEqual(replay[key],request[key]);
  assert.equal(replay.inputBindingsReverified,request.inputReceipts.length);
  const sampled=boundJson(context.projectRoot,request.sourceSampling).replay;
  const config=boundJson(context.projectRoot,request.sourcePackage).config;
  const summary=summarizeEndpointGradient(sampled,replay,config.training.denoiserLossWeights,request.parentCheckpoint);
  verifyBindings(context.projectRoot,replay.rows.map(r=>r.image));
  return {status:"passed",artifact:persist(context.projectRoot,phaseFile(context,"validate"),summary)};
});
export const review=context=>phase(context,async request=>{
  const summary=loadPhase(context,"validate");
  return {status:"passed",artifact:persist(context.projectRoot,phaseFile(context,"review"),{
    scope:"gradient_and_source_verification_not_visual_judge",summary,proposal:request.proposal,
    visualQualification:"not_assessed",automaticTrainingAllowed:false})};
});
export function decideEndpointGradient(summary,evidence){
  assert.equal(summary.rowsChecked,6);assert.equal(summary.pngBaselinesExact,6);assert.equal(summary.backwardProbes.length,2);
  assert.equal(summary.cpuCandidatePathVerified,true);assert.equal(summary.gpuCandidateQualified,false);
  assert.equal(summary.trainingExecuted,false);assert.equal(summary.formalVisualQualification,false);
  assert(summary.backwardProbes.every(g=>g.baseOutputReached&&g.gradientL2>0&&g.frozenAeGradientCount===0&&g.frozenHeadGradientCount===0&&!g.optimizerCreated));
  return {...adjudicateBoundedDecision({decisionSetId:"endpoint-gradient-shadow",ruleVersion:"exact_forward_real_cpu_backward_v1",
    optionIds:["cpu_candidate_path_verified","candidate_path_failed"],matchedOptionIds:["cpu_candidate_path_verified"],
    evidenceReferences:[evidence],evidenceComplete:true}),applied:false,nextMachineAction:null,
    disposition:"candidate_implementation_verified_no_training_dispatch",uniqueRootCauseProven:false,
    stopReason:"CPU gradient proof does not authorize or substitute for GPU eligibility or training."};
}
export const adjudicate=context=>phase(context,async()=>{
  const reviewValue=loadPhase(context,"review"),evidence=bind(context.projectRoot,phaseFile(context,"review"));
  return {status:"passed",artifact:persist(context.projectRoot,phaseFile(context,"adjudicate"),decideEndpointGradient(reviewValue.summary,evidence))};
});
export const finalize=context=>phase(context,async request=>{
  const decision=loadPhase(context,"adjudicate"),reviewValue=loadPhase(context,"review");
  const artifact=persist(context.projectRoot,phaseFile(context,"finalize"),{
    schemaVersion:"ai-painter-endpoint-gradient-shadow-result-v1",runId:request.identity,
    status:"endpoint_gradient_shadow_completed_not_visual_qualified",executionState:"completed",
    sourceCurrent:request.sourceCurrent,sourceSampling:request.sourceSampling,sourceResult:request.sourceResult,
    parentCheckpoint:request.parentCheckpoint,summary:reviewValue.summary,proposal:reviewValue.proposal,decision,
    evidence:PHASES.slice(0,-1).map(p=>bind(context.projectRoot,phaseFile(context,p))),
    gpuStarted:false,trainingStarted:false,optimizerSteps:0,formalQualificationAllowed:false,
    migrationStatus:"shadow_validated_not_production_cutover",
    migratedFunctions:["target_free_differentiable_endpoint","frozen_path_gradient_verification","current_checkpoint_replay","transactional_finalization"],
    recordedAtUtc:new Date().toISOString()});
  verifyBindings(context.projectRoot,request.inputReceipts);remainingMilliseconds(context,request);
  await register(context,request,artifact,false);return {status:"passed",artifact};
});
