// All stage success/GPU metadata below is synthetic parser input in a temporary
// project. No Python, GPU, real dataset, model, current registry or live task.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {executeFormalStage0,FORMAL_STAGE0_ENTRY} from '../run-ai-painter-stage4-v2-formal-stage0.mjs';
import {PHASES} from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
const REGISTRY='data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json';
const CONTRACT='data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json';
const capability='stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-stage0-bridge-'));
  t.after(()=>{
    const resolved=fs.realpathSync(root);
    assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));
    assert(path.basename(resolved).startsWith('painter-stage0-bridge-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  });
  const write=(logical,value)=>{
    const absolute=path.join(root,logical);
    fs.mkdirSync(path.dirname(absolute),{recursive:true});
    const data=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value));
    fs.writeFileSync(absolute,data);return {path:logical,sha256:hash(data)};
  };
  fs.mkdirSync(path.join(root,'.runtime'));
  write(CONTRACT,fs.readFileSync(CONTRACT));
  const runner={...write(FORMAL_STAGE0_ENTRY,fs.readFileSync(FORMAL_STAGE0_ENTRY)),entrypointId:'test:formal-stage0'};
  const adapter=write('scripts/fixture-formal-phases.mjs',`
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function phase(ctx,name){
  const source=ctx.inputEvidence.find(b=>b.path==='stage-package.json');
  const pkg=JSON.parse(fs.readFileSync(path.join(ctx.projectRoot,source.path)));
  fs.appendFileSync(path.join(ctx.projectRoot,'.runtime/trace.jsonl'),name+'\\n');
  if(name==='preflight'&&pkg.testMode==='reject')return {status:'failed',failureKind:'program',failureCode:'fixture_data_not_qualified'};
  if(name==='finalize'&&pkg.testMode!=='missing-terminal'){
    const write=(p,v)=>{const data=Buffer.from(typeof v==='string'?v:JSON.stringify(v));
      fs.mkdirSync(path.dirname(path.join(ctx.projectRoot,p)),{recursive:true});
      fs.writeFileSync(path.join(ctx.projectRoot,p),data);return {path:p,sha256:hash(data)};};
    const dir=path.posix.dirname(pkg.outputTerminalPath);
    const checkpoint=write(dir+'/fixture.pt','SYNTHETIC BYTE FIXTURE, NOT TRAINED WEIGHTS');
    const manifest={architectureId:pkg.capabilityVersion,packageId:pkg.packageId,runId:pkg.runId,
      stage:pkg.stage,status:'training_completed',checkpoint,loadedParentCheckpoint:null,nonTrainOptimizerSteps:0};
    const review={capabilityVersion:pkg.capabilityVersion,packageId:pkg.packageId,runId:pkg.runId,
      status:'stage4_v2_machine_review_passed',checkpoint,failCount:pkg.testMode==='bad-review'?1:0,passCount:1};
    write(pkg.outputTerminalPath,{fixtureOnly:true,schemaVersion:'ai-painter-stage4-v2-formal-stage-terminal-v1',
      status:'stage4_v2_formal_stage_passed',executionState:'completed',capabilityVersion:pkg.capabilityVersion,
      packageId:pkg.packageId,runId:pkg.runId,stage:pkg.stage,executionPackage:source,parent:null,
      gpuStarted:true,trainingStarted:true,checkpoint,trainingManifest:write(dir+'/manifest.json',manifest),
      machineReview:write(dir+'/review.json',review)});
  }
  return {status:'passed',fixtureOnly:true};
}
${PHASES.map(p=>`export const ${p}=ctx=>phase(ctx,'${p}');`).join('\n')}
`);
  const registry={schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',ownerInNormalStateMachine:false,
    currentEntrypoints:[{packageScript:runner.entrypointId,entryFile:runner.path,role:'stage4_v2_formal_single_stage_execution'},
      ...PHASES.map(p=>({role:'stage4_v2_formal_single_stage_phase_adapter',capabilityVersion:capability,
        phase:p,entryFile:adapter.path,exportName:p}))]};
  const pkg={schemaVersion:'ai-painter-stage4-v2-formal-stage-execution-package-v1',capabilityVersion:capability,
    batchRunId:'test-batch',packageId:'test-package',runId:'test-stage0',
    stage:{stage:0,width:256,height:192,epochCount:40},parentStage:null,runner,
    outputTerminalPath:'.runtime/ai-painter/stage4-v2-formal-executions/test-batch/stages/test-stage0/phase-terminal.json',
    ticketConsumptionRequired:true,resourceBudget:{timeoutMs:60000,terminationGraceMs:1000,heartbeatIntervalMs:1000,maxOutputBytes:100000},
    recordedAtUtc:'2026-09-22T00:00:00.000Z',testMode:'pass',
    programGraphManifest:write('graph.json',{schemaVersion:'ai-painter-stage4-v2-formal-stage-program-graph-v1',
      capabilityVersion:capability,programs:{runner:{path:runner.path,sha256:runner.sha256},phases:adapter}}),
    phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{kind:'project_module_export',...adapter,exportName:p}]))};
  for(const key of ['taskTicket','dataQualification','foundationQualification','cpuQualification','gpuQualification'])
    pkg[key]=write(key+'.json',{fixtureOnly:true,qualified:true});
  const save=()=>{write(REGISTRY,registry);return write('stage-package.json',pkg);};
  const run=()=>executeFormalStage0({root,executionPackage:save()});
  const trace=()=>fs.existsSync(path.join(root,'.runtime/trace.jsonl'))?
    fs.readFileSync(path.join(root,'.runtime/trace.jsonl'),'utf8').trim().split('\n'):[];
  return {root,write,pkg,registry,save,run,trace,adapter};
}

test('registered actual module loading bridges six phases and verifies terminal protocol',async t=>{
  const f=fixture(t), result=await f.run();
  assert.equal(result.formalStagePassed,true); // fixture protocol only
  assert.deepEqual(f.trace(),PHASES);
  const repeated=await f.run();assert.equal(repeated.formalStagePassed,true);
  assert.deepEqual(f.trace(),PHASES,'repeat must not reexecute adapters');
});
test('unregistered runner refuses before phase imports or lifecycle materialization',async t=>{
  const f=fixture(t);f.registry.currentEntrypoints.shift();
  await assert.rejects(f.run(),/runner is not uniquely registered/);assert.deepEqual(f.trace(),[]);
  assert(!fs.existsSync(path.join(f.root,'.runtime/ai-painter/autonomous-closed-loop-packages')));
});
test('unregistered phase refuses even when caller sets all qualification booleans',async t=>{
  const f=fixture(t);f.registry.currentEntrypoints.pop();
  f.pkg.trainingAllowed=true;f.pkg.gpuAllowed=true;
  await assert.rejects(f.run(),/unregistered formal phase/);assert.deepEqual(f.trace(),[]);
});
test('registered preflight rejection never reaches execute and remains idempotent',async t=>{
  const f=fixture(t);f.pkg.testMode='reject';
  const result=await f.run();assert.equal(result.status,'failed_closed');assert.equal(result.formalStagePassed,false);
  assert.deepEqual(f.trace(),['preflight']);await f.run();assert.deepEqual(f.trace(),['preflight']);
});
test('generic loop completion cannot manufacture a formal stage terminal',async t=>{
  const f=fixture(t);f.pkg.testMode='missing-terminal';
  await assert.rejects(f.run(),/ENOENT/);assert.deepEqual(f.trace(),PHASES);
});
test('formal terminal with failed review is rejected',async t=>{
  const f=fixture(t);f.pkg.testMode='bad-review';
  await assert.rejects(f.run());assert.deepEqual(f.trace(),PHASES);
});
test('changed phase bytes fail before imports',async t=>{
  const f=fixture(t);f.write(f.adapter.path,'throw new Error("must not import");');
  await assert.rejects(f.run(),/SHA mismatch/);assert.deepEqual(f.trace(),[]);
});
test('Stage1 and caller parent injection are not accepted by Stage0 entry',async t=>{
  const f=fixture(t);f.pkg.stage={stage:1,width:512,height:384,epochCount:40};
  await assert.rejects(f.run(),/Stage0 only/);
  f.pkg.stage={stage:0,width:256,height:192,epochCount:40};f.pkg.parentCheckpoint={path:'old.pt',sha256:'a'.repeat(64)};
  await assert.rejects(f.run(),/parent injection/);assert.deepEqual(f.trace(),[]);
});

for(const mode of ['pass','reject'])test(`actual Stage0 CLI loads registered fixture modules: ${mode}`,t=>{
  const f=fixture(t);f.pkg.testMode=mode;
  const source=f.save();
  // Execute the real entry file with an isolated project cwd. Its dependencies
  // are the repository implementation; only the six phase exports and evidence
  // are fixtures. This verifies CLI/process wiring, not training qualification.
  const child=spawnSync(process.execPath,[path.resolve(FORMAL_STAGE0_ENTRY),
    '--stage','0',
    '--execution-package',path.join(f.root,source.path),
    '--execution-package-sha256',source.sha256],
    {cwd:f.root,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
  assert.ifError(child.error);assert.equal(child.signal,null);
  assert.equal(child.status,mode==='pass'?0:2,child.stderr);
  const result=JSON.parse(child.stdout.trim());
  assert.equal(result.formalStagePassed,mode==='pass');
  assert.deepEqual(f.trace(),mode==='pass'?PHASES:['preflight']);
});

test('Stage0 CLI rejects a batch selector for Stage1 before phase materialization',t=>{
  const f=fixture(t), source=f.save();
  const child=spawnSync(process.execPath,[path.resolve(FORMAL_STAGE0_ENTRY),
    '--stage','1','--execution-package',path.join(f.root,source.path),
    '--execution-package-sha256',source.sha256],
    {cwd:f.root,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
  assert.ifError(child.error);assert.notEqual(child.status,0);
  assert.match(child.stderr,/this entry supports Stage0 only/);
  assert.deepEqual(f.trace(),[]);
});
