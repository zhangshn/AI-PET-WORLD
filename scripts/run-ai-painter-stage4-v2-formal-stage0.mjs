import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';
import {materializeAutonomousClosedLoopPackage} from './lib/ai-painter-autonomous-package-materializer-v1.mjs';
import {PHASES,runAutonomousClosedLoop} from './lib/ai-painter-autonomous-closed-loop-v1.mjs';
import {validateStageTerminal} from './run-ai-painter-stage4-v2-formal-stage0-to-stage2.mjs';

export const FORMAL_STAGE0_ENTRY = 'scripts/run-ai-painter-stage4-v2-formal-stage0.mjs';
const REGISTRY = 'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json';
const CAPABILITY = 'stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2';
const STAGE = Object.freeze({stage:0,width:256,height:192,epochCount:40});
const binding = value => {
  assert(value && typeof value.path==='string' && /^[a-f0-9]{64}$/.test(value.sha256??''),'explicit file binding required');
  return {path:value.path,sha256:value.sha256};
};
const identity = value => assert(/^[a-z0-9][a-z0-9_-]{2,127}$/.test(value??''),'formal Stage0 identity invalid');

/** Batch-to-existing-lifecycle bridge, not a new scheduler or data qualifier.
 * No injected adapters. Only exact exports registered for this capability may
 * run. Their preflight must revalidate data/model/CPU/GPU evidence and their
 * execute phase owns ticket consumption, resources and current registration.
 * Registration is NOT performed by this file. Absent production adapters fail
 * before materialization; test fixtures cannot become a production fallback.
 * This first entry handles only Stage0. It never chooses a parent or launches
 * Stage1/2, and never manufactures a formal passed terminal from loop completion.
 */
export async function executeFormalStage0({root=process.cwd(),executionPackage}) {
  root=fs.realpathSync(root);
  const reader=createReader(root), source=binding(executionPackage), pkg=reader.bound(source);
  assert.equal(pkg.schemaVersion,'ai-painter-stage4-v2-formal-stage-execution-package-v1');
  assert.equal(pkg.capabilityVersion,CAPABILITY);
  assert.deepEqual(pkg.stage,STAGE,'this entry supports Stage0 only');
  assert.equal(pkg.parentStage,null,'Stage0 cannot inherit a Denoiser');
  for(const key of ['parentCheckpoint','parentTerminal','parentCheckpointPath','parentCheckpointSha256',
    'parentTerminalPath','parentTerminalSha256'])assert(!(key in pkg),'Stage0 parent injection forbidden');
  for(const key of ['batchRunId','packageId','runId'])identity(pkg[key]);
  const outputRoot=`.runtime/ai-painter/stage4-v2-formal-executions/${pkg.batchRunId}/stages/${pkg.runId}`;
  assert.equal(pkg.outputTerminalPath,`${outputRoot}/phase-terminal.json`);
  assert.equal(pkg.ticketConsumptionRequired,true);
  const budget=pkg.resourceBudget;
  for(const key of ['timeoutMs','terminationGraceMs','heartbeatIntervalMs'])
    assert(Number.isSafeInteger(budget?.[key])&&budget[key]>0&&budget[key]<=2147483647,'invalid stage budget');
  assert(budget.heartbeatIntervalMs<=budget.timeoutMs&&Number.isSafeInteger(budget.maxOutputBytes)
    &&budget.maxOutputBytes>0,'invalid stage output/heartbeat budget');
  assert.equal(pkg.runner?.path,FORMAL_STAGE0_ENTRY);
  reader.bytes(pkg.runner.path,pkg.runner.sha256);
  const registry=reader.json(REGISTRY);
  assert.equal(registry.schemaVersion,'ai-painter-current-entrypoint-registry-v1');
  assert.equal(registry.status,'active');
  assert.equal(registry.ownerInNormalStateMachine,false);
  const entries=registry.currentEntrypoints;
  assert.equal(entries.filter(e=>e.role==='stage4_v2_formal_single_stage_execution'
    &&e.entryFile===FORMAL_STAGE0_ENTRY&&e.packageScript===pkg.runner.entrypointId).length,1,
    'formal Stage0 runner is not uniquely registered');
  const graph=reader.bound(binding(pkg.programGraphManifest));
  assert.equal(graph.schemaVersion,'ai-painter-stage4-v2-formal-stage-program-graph-v1');
  assert.equal(graph.capabilityVersion,CAPABILITY);
  assert(graph.programs&&Object.keys(graph.programs).length>0,'formal program graph missing');
  const programs=Object.values(graph.programs).map(binding);
  for(const p of programs)reader.bytes(p.path,p.sha256);
  assert(programs.some(p=>p.path===FORMAL_STAGE0_ENTRY&&p.sha256===pkg.runner.sha256),'runner absent from program graph');
  assert.deepEqual(Object.keys(pkg.phaseAdapters??{}).sort(),[...PHASES].sort());
  for(const phase of PHASES){
    const a=pkg.phaseAdapters[phase];
    assert.equal(a.kind,'project_module_export');
    assert(programs.some(p=>p.path===a.path&&p.sha256===a.sha256),'phase adapter absent from program graph');
    assert.equal(entries.filter(e=>e.role==='stage4_v2_formal_single_stage_phase_adapter'
      &&e.capabilityVersion===CAPABILITY&&e.phase===phase&&e.entryFile===a.path
      &&e.exportName===a.exportName).length,1,`unregistered formal phase: ${phase}`);
  }
  // These are evidence inputs, not accepted caller booleans. The registered
  // production preflight must execute their semantic/lineage verification.
  for(const key of ['taskTicket','dataQualification','foundationQualification','cpuQualification','gpuQualification'])
    reader.bound(binding(pkg[key]));
  const started=pkg.recordedAtUtc;
  assert(typeof started==='string'&&Number.isFinite(Date.parse(started)),'bound package timestamp missing');
  reader.verifyStable();
  const receipts=reader.receipts();
  const materialized=materializeAutonomousClosedLoopPackage({
    schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',
    packageIdentity:`formal-stage0-${source.sha256.slice(0,48)}`,capabilityVersion:CAPABILITY,
    ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot,
    programFiles:Object.fromEntries(Object.entries(graph.programs).map(([role,p])=>[role,p.path])),
    inputEvidencePaths:receipts.map(r=>r.path),
    phaseAdapters:pkg.phaseAdapters,
  },{root,recordedAtUtc:started,recoverExistingExact:true});
  const spec=reader.bound({path:materialized.packagePath,sha256:materialized.packageSha256});
  for(const r of receipts)assert(spec.inputEvidence.some(b=>b.path===r.path&&b.sha256===r.sha256),
    'materialization rebound changed evidence');
  reader.verifyStable();
  const state=await runAutonomousClosedLoop({root,spec,packageSha256:materialized.packageSha256});
  // Refuse success without the actual formal terminal/Checkpoint/review bundle.
  // Failed preflight remains the existing durable closed-loop failed terminal;
  // it is never relabelled as GPU work, training completion or formal approval.
  reader.verifyStable();
  if(state.state!=='completed')return {status:state.state,lifecyclePackage:materialized,
    failureCode:state.failureCode,formalStagePassed:false};
  const terminal=reader.json(pkg.outputTerminalPath);
  validateStageTerminal(root,terminal,{packageId:pkg.packageId},STAGE,
    {runId:pkg.runId,executionPackage:source,outputTerminalPath:pkg.outputTerminalPath},null);
  reader.verifyStable();
  return {status:'stage4_v2_formal_stage_passed',lifecyclePackage:materialized,
    terminal:reader.receipts().find(r=>r.path===pkg.outputTerminalPath),formalStagePassed:true};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  let argv=process.argv.slice(2);
  // The bounded Stage0→2 batch executor passes an explicit stage selector to
  // every single-stage runner. Stage0 accepts only 0; it cannot inherit a
  // caller-selected parent or silently dispatch Stage1/2.
  if(argv[0]==='--stage'){
    assert.equal(argv[1],'0','this entry supports Stage0 only');
    argv=argv.slice(2);
  }
  assert.equal(argv.length,4,'exact --execution-package and --execution-package-sha256 required; no parent override');
  assert.equal(argv[0],'--execution-package');assert.equal(argv[2],'--execution-package-sha256');
  const logical=path.isAbsolute(argv[1])?path.relative(process.cwd(),argv[1]).split(path.sep).join('/'):argv[1];
  executeFormalStage0({executionPackage:{path:logical,sha256:argv[3]}}).then(result=>{
    console.log(JSON.stringify(result));if(!result.formalStagePassed)process.exitCode=2;
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
