// Read-only evidence composition, not a replacement qualification gate.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createReader, sha256} from './ai-painter-stage4-dataset-audit.mjs';
import {preflightSplitSmoke} from './ai-painter-stage4-split-smoke-preflight.mjs';

const POLICY = {path:'data/ai-painter/system-governance/ai-painter-foundation-cpu-load-probe-policy-v1.json',
  sha256:'e01ada89734708bd3bca15b52b2fec9954a7d87e913da9b30f93a63f9c8ab46c'};
const STATUS = 'cpu_load_and_probe_freeze_verified_not_training_qualified';
const PROGRAMS = [
  'ml/ai-painter/scripts/probe_foundation_cpu_load.py',
  'ml/ai-painter/tests/test_foundation_cpu_load_probe.py',
  'ml/ai-painter/scripts/ai_painter_stage4_semantic_transport_v2_trainer_support.py',
  'ml/ai-painter/src/ai_painter/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/__init__.py',
  'ml/ai-painter/src/ai_painter/complete_world/model.py',
  'ml/ai-painter/src/ai_painter/complete_world/stage4_semantic_transport_v2.py',
  'ml/ai-painter/src/ai_painter/complete_world/diffusion.py',
  'ml/ai-painter/src/ai_painter/training/__init__.py',
  'ml/ai-painter/src/ai_painter/training/torch_runtime.py',
  'data/ai-painter/system-governance/stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json',
  'data/ai-painter/system-governance/stage4-formal-diffusion-objective-and-checkpoint-contract-v1.json',
  'scripts/check-ai-painter-foundation-cpu-load.mjs',
  'scripts/lib/ai-painter-cpu-checkpoint-worker.mjs',
  'scripts/lib/ai-painter-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-owned-worker-native-v1.mjs',
  'scripts/windows/ai-painter-owned-worker-owner.cs',
];
const binding = v => ({path:v.path, sha256:v.sha256});

// Pure semantic validation; deliberately does not claim authentic execution.
export function validateFoundationProbeResult(v, {runId, checkpoint}) {
  assert.equal(v.schemaVersion,'foundation-cpu-load-probe-result-v1');
  assert.equal(v.runId,runId); assert.equal(v.status,STATUS);
  assert.deepEqual(v.policy,POLICY); assert.deepEqual(v.checkpoint,binding(checkpoint));
  assert.equal(v.device,'cpu'); assert.ok(Number.isSafeInteger(v.pid) && v.pid > 0);
  for (const key of ['checkpointDeserialized','restrictedWeightsOnly','parameterSelectionExcludesFoundation','inputGradientFinite'])
    assert.equal(v[key],true,key);
  for (const key of ['optimizerCreated','parameterGradientsCreated','gpuStarted','realDatasetRead','checkpointWritten',
    'trainingFreezeProven','historicalIsolationQualified','trainingAllowed','capabilityReleased']) assert.equal(v[key],false,key);
  assert.equal(v.optimizerSteps,0);
  assert.match(v.loadedStateSha256 ?? '',/^[a-f0-9]{64}$/u);
  assert.equal(v.afterModeSwitchStateSha256,v.loadedStateSha256);
  assert.equal(v.afterProbeStateSha256,v.loadedStateSha256);
  assert.deepEqual(v.probeInputShape,[1,3,16,16]); assert.deepEqual(v.probeLatentShape,[1,12,4,4]);
}

function readWorker(reader, root, b, expectedInputs, args) {
  const w = reader.bound(b);
  assert.equal(w.qualificationGranted,false);
  assert.deepEqual(w.commandArgs,args,'worker command conflict');
  const executablePath = 'ml/ai-painter/.venv/Scripts/python.exe';
  assert.equal(w.executable.path,path.resolve(root,executablePath));
  reader.bytes(executablePath,w.executable.sha256);
  assert.equal(w.programReceipts.length,expectedInputs.length,'worker input coverage conflict');
  const expected = new Map(expectedInputs.map(v=>[v.path,v.sha256]));
  for (const receipt of w.programReceipts) {
    assert.equal(receipt.sha256,expected.get(receipt.path),'worker input missing or duplicated');
    expected.delete(receipt.path);
    assert.equal(reader.bytes(receipt.path,receipt.sha256).length,receipt.bytes);
  }
  const r = w.ownedReceipt;
  for (const key of ['cleanupConfirmed','guardReleaseConfirmed','ownerClosed','liveOwnerCleanupConfirmed']) assert.equal(r[key],true,key);
  assert.equal(r.proof.exitCode,0); assert.equal(r.proof.activeProcessesAfterCleanup,0);
  assert.equal(r.proof.stopReason,null); assert.equal(r.proof.cleanupError,null);
  assert.equal(r.proof.observationError,null); assert.equal(r.protocolError,null);
  assert.equal(r.firstStop,null); assert.equal(r.termination,null);
  assert.equal(r.proof.assignedBeforeResume,true); assert.equal(r.proof.killOnJobClose,true);
  assert.ok(Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0 && r.elapsedMs <= 60000);
  const recorded = JSON.parse(Buffer.from(r.proof.bindingBase64,'base64').toString('utf8'));
  assert.equal(recorded.guard.commandSha256,sha256(JSON.stringify(args)));
  assert.equal(recorded.guard.executable,w.executable.path);
  assert.equal(recorded.guard.executableSha256,w.executable.sha256);
  assert.equal(recorded.scope,path.resolve(root));
  assert.equal(recorded.guard.identity,r.guard.identity);
  assert.equal(r.proof.ownerPid,r.ownerIdentity.pid);
  assert.deepEqual(recorded.nativeBuild,r.nativeBuild);
  // A saved owner response is historical evidence, not a live ownership handle.
  return w;
}

export function readFoundationCpuEvidence({root, reportBinding, checkpoint}) {
  const reader = createReader(root), report = reader.bound(reportBinding);
  const policy = reader.bound(POLICY), foundation = reader.bound(policy.foundationContract);
  assert.equal(foundation.activation.checkpointDeserializationAllowedDuringCpuValidation,false);
  assert.deepEqual(binding(checkpoint),binding(foundation.checkpoint),'candidate foundation differs from probe');
  assert.match(report.runId ?? '',/^foundation-cpu-probe-[a-f0-9-]{36}$/u);
  const base = `${policy.outputRoot}/${report.runId}`;
  assert.equal(reportBinding.path,`${base}/report.json`);
  for (const [key,name] of [['request','request'],['tests','cpu-tests'],['probe','worker-result']])
    assert.equal(report[key].path,`${base}/${name}.json`);
  assert.equal(report.status,STATUS); assert.equal(report.oldContractUnchanged,true);
  assert.equal(report.trainingAllowed,false); assert.equal(report.stage4ProgressRaised,false);
  assert.ok(Number.isFinite(Date.parse(report.recordedAtUtc)));
  assert.deepEqual(report.registryBefore,report.registryAfter);
  assert.equal(report.registryBefore.path,'.runtime/ai-painter/current-execution-registry/current.json');
  // This bounded consumer requires the same registry bytes. It never rewrites
  // historical bindings to today's registry revision.
  assert.equal(reader.bound(report.registryAfter).activeExecution,null);
  const request = reader.bound(report.request);
  assert.equal(request.schemaVersion,'foundation-cpu-load-probe-request-v1');
  assert.equal(request.runId,report.runId); assert.deepEqual(request.policy,POLICY);
  assert.deepEqual(request.programBindings.map(v=>v.path).sort(),[...PROGRAMS].sort());
  for (const b of request.programBindings) reader.bytes(b.path,b.sha256);
  const inputs = [...request.programBindings,POLICY,policy.foundationContract,
    binding(foundation.sourceManifest),binding(foundation.checkpoint),report.request];
  for (const b of inputs) reader.bytes(b.path,b.sha256);
  const tests = readWorker(reader,root,report.tests,inputs,['-B',path.resolve(root,PROGRAMS[1])]);
  assert.equal(tests.value.status,'passed'); assert.equal(tests.value.testsRun,7);
  assert.equal(tests.value.failures,0); assert.equal(tests.value.errors,0);
  assert.equal(tests.value.realCheckpointRead,false); assert.equal(tests.value.gpuStarted,false);
  const probe = readWorker(reader,root,report.probe,inputs,['-B',path.resolve(root,policy.workerPath),
    '--request',report.request.path,'--request-sha256',report.request.sha256]);
  assert.deepEqual(report.result,probe.value);
  validateFoundationProbeResult(probe.value,{runId:report.runId,checkpoint});
  reader.verifyStable();
  return {status:STATUS,reportBinding,checkpoint:binding(checkpoint),cpuProbeLoadVerified:true,
    cpuProbeFreezeVerified:true,recordedExecutionEvidenceConsistent:true,
    liveProcessIdentityReverified:false,trainingFreezeProven:false,optimizerExclusionDuringTrainingProven:false,
    historicalIsolationQualified:false,trainingAllowed:false,inputReceipts:reader.receipts()};
}

// Reuse the frozen preflight unmodified; augment its read-only diagnostic only.
// Neither fresh nor previously saved probe success removes any data blocker.
export function inspectSplitSmokeWithFoundation({root, componentContractBinding, cpuEvidenceBinding,
  dataEvidenceBindings, foundationProbeBinding}) {
  const preflight = preflightSplitSmoke({root,componentContractBinding,cpuEvidenceBinding,dataEvidenceBindings});
  const blockers = [...preflight.blockers];
  let foundationCpuEvidence = null, status = preflight.status, inputReceipts = [];
  try {
    const checkpoint = preflight.dataAdjudication?.findings?.foundationAssessment?.checkpoint;
    assert.ok(checkpoint,'current candidate foundation not established');
    foundationCpuEvidence = readFoundationCpuEvidence({root,reportBinding:foundationProbeBinding,checkpoint});
    const reader = createReader(root);
    reader.bytes('scripts/lib/ai-painter-foundation-cpu-evidence.mjs');
    for (const receipt of [...preflight.inputReceipts,...foundationCpuEvidence.inputReceipts])
      assert.equal(reader.bytes(receipt.path,receipt.sha256).length,receipt.bytes);
    reader.verifyStable();
    inputReceipts = reader.receipts();
  } catch (error) {
    foundationCpuEvidence = null; status = 'unknown_or_stale';
    blockers.push({code:'foundation_cpu_probe_invalid_or_stale',scope:'foundation_cpu',details:{reason:error.message.split('\n')[0]}});
  }
  return {schemaVersion:'ai-painter-split-smoke-foundation-inspection-v1',status,
    checkedAtUtc:new Date().toISOString(),preflight,foundationCpuEvidence,blockers,inputReceipts,
    trainingAllowed:false,gpuAllowed:false,nextMachineAction:null,runtimeAdapterRegistered:false,
    stage4ProgressRaised:false};
}
