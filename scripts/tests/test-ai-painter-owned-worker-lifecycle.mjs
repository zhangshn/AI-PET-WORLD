import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

// Real current registry/core/AB modules, isolated data and synthetic programs.
// No registry/process probes, phase implementation or database writes are stubbed.
const workspace=process.cwd(),parent=path.resolve('.runtime/m-c4-01');fs.mkdirSync(parent,{recursive:true});
assert.equal(fs.realpathSync(parent),path.join(fs.realpathSync(path.resolve('.runtime')),'m-c4-01'),'lifecycle evidence must remain below the resolved runtime root without extra redirection');
const evidenceRoot=fs.mkdtempSync(path.join(parent,'r-')),results=[],dependencies=[];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=f=>digest(fs.readFileSync(f));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const bind=(root,p)=>({path:p,sha256:hash(path.join(root,p))});
const put=(root,p,value)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return bind(root,p);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,limit=10000){const deadline=Date.now()+limit;while(!fn()){assert(Date.now()<deadline,'fixture wait exceeded');await wait(25);}}
const scope=['scripts/lib/ai-painter-endpoint-ab-v1.mjs','scripts/lib/ai-painter-owned-worker-v1.mjs','scripts/tests/test-ai-painter-owned-worker.mjs','scripts/fixtures/ai-painter-owned-worker.mjs',
 'scripts/lib/ai-painter-owned-worker-native-v1.mjs','scripts/windows/ai-painter-owned-worker-owner.cs','scripts/tests/test-ai-painter-owned-worker-native.mjs'];
function copyDependencies(root){const seen=new Set();function copy(p){if(seen.has(p))return;seen.add(p);const source=path.join(scope.includes(p)?workspace:'F:/ai-pet-world',p),bytes=fs.readFileSync(source);put(root,p,bytes.toString('utf8'));dependencies.push({source,destination:path.join(root,p),beforeSha256:digest(bytes),copiedSha256:hash(path.join(root,p))});
 if(p.endsWith('.mjs'))for(const m of bytes.toString().matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)){const next=path.posix.normalize(path.posix.join(path.posix.dirname(p),m[1]));if(next.endsWith('.mjs'))copy(next);}}
 for(const p of [...scope,'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs','scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs','data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json','data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json'])copy(p);}
async function seed(root,registry){
 const plan='.runtime/fixture/current-plan',formal='.runtime/fixture/current-formal',at=new Date().toISOString();
 const candidate=put(root,plan+'/candidate.json',{schemaVersion:'stage4-post-decode-bounded-candidate-v1',status:'cpu_inactive_candidate_planned_not_implemented',selectedCandidate:{candidateKind:'synthetic_only'},recordedAtUtc:at});
 const terminal=put(root,plan+'/terminal.json',{schemaVersion:'stage4-post-decode-failure-bounded-planning-terminal-v1',executionState:'completed',status:'bounded_candidate_planning_completed',planningRunId:'fixture-plan',nextAction:'fixture',candidate,fixedTotalProgress:{completedStages:3,totalStages:5,percent:60},recordedAtUtc:at});
 const capsule=put(root,plan+'/capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v2',latestTerminal:terminal,recordedAtUtc:at});
 const training=put(root,formal+'/phase-terminal.json',{schemaVersion:'stage4-post-decode-object-rgb-stage0-terminal-v1',executionState:'completed',status:'post_decode_object_rgb_stage0_real_visual_failure',runId:'fixture-formal',recordedAtUtc:at});
 put(root,formal+'/execution-state.json',{status:'completed',phase:'machine_review_completed',updatedAtUtc:at});
 put(root,formal+'/machine-review.json',{previewCount:0,previewPassCount:0,previewFailCount:0,recordedAtUtc:at});
 put(root,formal+'/training-output/progress.json',{phase:'training_completed',epoch:0,epochTarget:0,updatedAtUtc:at});
 const initial=await registry.initializeCurrentExecutionRegistry({projectRoot:root,currentTaskCapsulePath:capsule.path,currentTaskTerminalPath:terminal.path,currentCandidatePath:candidate.path,latestTrainingTerminalPath:training.path,archivedEvidenceNamespaces:['.runtime/fixture/archive']});assert(initial.ok,initial.errorCode);return initial;
}
function registryIndex(root,current){const base=path.join(root,'.runtime/ai-painter/current-execution-registry');const events=fs.readFileSync(path.join(base,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 const db=new DatabaseSync(path.join(base,'registry.sqlite'),{readOnly:true});let rows;try{rows=db.prepare('SELECT * FROM registry_revisions ORDER BY registry_revision').all();}finally{db.close();}
 assert.equal(rows.length,events.length);const latest=rows.at(-1),event=events.at(-1);assert.equal(latest.current_sha256,current.registrySha256);assert.equal(event.currentSha256,current.registrySha256);assert.equal(latest.transaction_id,current.registry.transactionId);assert.equal(event.transactionId,current.registry.transactionId);return {rows,events};}
async function caseRun(mode){const began=Date.now(),root=path.join(evidenceRoot,mode[0]);fs.mkdirSync(root);copyDependencies(root);
 const load=p=>import(pathToFileURL(path.join(root,p)));
 const registry=await load('src/server/ai-painter-current-execution-registry.mjs'),core=await load('scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs'),ab=await load(scope[0]);
 const helper=await load(scope[1]),materializer=await load('scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs');
 const initial=await seed(root,registry);
 // Use the actual venv read-only. Its script/test search paths are this fixture.
 fs.mkdirSync(path.join(root,'ml/ai-painter'),{recursive:true});fs.symlinkSync('F:/ai-pet-world/ml/ai-painter/.venv',path.join(root,'ml/ai-painter/.venv'),'junction');
 put(root,ab.NODE_TEST,"import assert from 'node:assert/strict';assert.equal(2+2,4);\n");
 put(root,ab.PY_TEST,"import unittest\nclass Synthetic(unittest.TestCase):\n def test_no_training(self): self.assertEqual(0,0)\n");
 put(root,ab.WORKER,"import os,sys,json\nprint(json.dumps({'synthetic':True,'pid':os.getpid(),'optimizerSteps':0}),flush=True)\nsys.stderr.write('controlled stdlib worker failure\\n')\nsys.exit(7)\n");
 for(const p of ['ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py','ml/ai-painter/tests/test_endpoint_rgb_experiment.py'])put(root,p,'# synthetic, never imported\n');
 const programPaths=[ab.ADAPTER,ab.WORKER,ab.NODE_TEST,ab.PY_TEST,...ab.OWNED_FILES,'ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py','ml/ai-painter/tests/test_endpoint_rgb_experiment.py'];
 const request=ab.sealEndpointV3Request({schemaVersion:'ai-painter-endpoint-ab-request-v3',mode:'bounded_paired_endpoint_training',training:ab.TRAINING_V3,resources:ab.RESOURCES,
   inputReceipts:programPaths.map(p=>bind(root,p)),selectedRows:[146,147].map(id=>({sampleId:String(id),split:'train'})),syntheticFixture:true,
   expectedPreviousRevision:initial.registry.registryRevision,expectedPreviousSha256:initial.registrySha256,latestTrainingRunId:initial.registry.latestTrainingTerminal.runId});
 const requestBinding=put(root,request.outputRoot+'/experiment-request.json',request);
 const materialized=materializer.materializeAutonomousClosedLoopPackage({schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:request.identity,capabilityVersion:request.identity,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:request.outputRoot,
   programFiles:{adapter:ab.ADAPTER,worker:ab.WORKER},inputEvidencePaths:[requestBinding.path,...programPaths],phaseAdapters:Object.fromEntries(core.PHASES.map(p=>[p,{path:ab.ADAPTER,exportName:p}]))},{root});
 const spec=read(path.join(root,materialized.packagePath)),guardPath=path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json');
 let beforeFailure,competitor=null,competitorExit=null,repeatRejected=false;
 const adapters=Object.fromEntries(core.PHASES.map(p=>[p,ab[p]]));
 adapters.execute=async context=>{
   beforeFailure=await registry.readCurrentExecutionRegistry(root);assert(beforeFailure.ok,beforeFailure.errorCode);assert.equal(beforeFailure.registry.activeExecution.processId,process.pid);
   await assert.rejects(core.runAutonomousClosedLoop({root,spec,packageSha256:materialized.packageSha256}),/active runner PID/);repeatRejected=true;
   if(mode==='unknown'){
     const out=path.join(root,'competitor');fs.mkdirSync(out);
     competitor=spawn(process.execPath,[path.join(root,scope[3]),'runner',out],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,CUDA_VISIBLE_DEVICES:'',UV_THREADPOOL_SIZE:'2'}});
     competitorExit=new Promise(r=>competitor.once('close',(code,signal)=>r({code,signal})));
     await until(()=>fs.existsSync(path.join(out,'leaf-pid.json')));
     assert(fs.existsSync(guardPath));assert.throws(()=>helper.runOwnedWorker(process.execPath,[],{cwd:root,env:process.env,timeout:1000}),e=>e.code==='OWNED_GUARD_BUSY');
     assert(competitor.kill('SIGKILL'));await competitorExit;await wait(300);
     assert(fs.existsSync(guardPath),'dead runner is not proof permitting guard removal');
   }
   return ab.execute(context);
 };
 const state=await core.runAutonomousClosedLoop({root,spec,packageSha256:materialized.packageSha256,adapters});assert.equal(state.state,'failed_closed');
 const current=await registry.readCurrentExecutionRegistry(root);assert(current.ok,current.errorCode);
 const failurePath=path.join(root,request.outputRoot,'failure-execute.json');assert(fs.existsSync(failurePath),'execute failure missing');const failure=read(failurePath);
 assert.equal(failure.ownedProcess.cleanupConfirmed,mode==='confirmed');assert.equal(failure.executionState,'failed_closed');
 const index=registryIndex(root,current);
 if(mode==='unknown'){assert.equal(current.registrySha256,beforeFailure.registrySha256);assert.equal(current.registry.activeExecution.processId,process.pid);assert(fs.existsSync(guardPath));assert.throws(()=>helper.runOwnedWorker(process.execPath,[],{cwd:root,env:process.env,timeout:1000}),e=>e.code==='OWNED_GUARD_BUSY');}
 else {assert.equal(current.registry.activeExecution,null);assert.equal(current.registry.executionState,'failed_closed');assert.equal(current.registry.registryRevision,beforeFailure.registry.registryRevision+1);assert.equal(current.registry.latestTrainingTerminal.sha256,hash(failurePath));assert(!fs.existsSync(guardPath));}
 const coreRoot=path.join(root,'.runtime/ai-painter/autonomous-closed-loop-executions',request.identity),terminal=read(path.join(coreRoot,'phase-terminal.json'));
 assert.equal(terminal.status,'failed_closed');assert.equal(terminal.finalResult.artifact.sha256,hash(failurePath));
 assert.equal(terminal.latestEvidence.sha256,hash(path.join(coreRoot,terminal.latestEvidence.path)));
 const coreDb=new DatabaseSync(path.join(coreRoot,'execution.sqlite'),{readOnly:true});let coreIndex;
 try{coreIndex={execution:coreDb.prepare('SELECT * FROM executions WHERE package_identity = ?').get(request.identity),transitions:coreDb.prepare('SELECT * FROM transitions ORDER BY sequence').all(),artifacts:coreDb.prepare('SELECT * FROM artifacts ORDER BY phase').all()};}finally{coreDb.close();}
 assert.equal(coreIndex.execution.state,terminal.status);assert.equal(coreIndex.execution.failure_code,terminal.failureCode);
 assert.equal(coreIndex.transitions.at(-1).to_state,terminal.status);assert.equal(coreIndex.transitions.at(-1).evidence_sha256,terminal.latestEvidence.sha256);
 const eventsBefore=fs.readFileSync(path.join(root,'.runtime/ai-painter/current-execution-registry/events.jsonl'),'utf8');
 assert.equal((await core.runAutonomousClosedLoop({root,spec,packageSha256:materialized.packageSha256})).state,'failed_closed');assert.equal(fs.readFileSync(path.join(root,'.runtime/ai-painter/current-execution-registry/events.jsonl'),'utf8'),eventsBefore);
 const data={mode,root,elapsedMs:Date.now()-began,state,terminal,failure,current,beforeFailure,index,coreIndex,repeatRejected,guardPath,competitorPid:competitor?.pid,competitorExit:competitor?await competitorExit:null,
  scope:'Actual copied AB/core/registry/SQLite APIs; controlled preflight checks and stdlib worker replace training programs. No registry stubs, no production training qualification. Unknown branch is genuine retained guard after concurrent runner loss.'};
 assert(data.elapsedMs<30000);put(root,'case-result.json',data);return {status:'passed',mode,evidence:path.join(root,'case-result.json'),elapsedMs:data.elapsedMs};
}
const start=Date.now();for(const mode of ['confirmed','unknown']){try{results.push(await caseRun(mode));}catch(e){results.push({mode,status:'failed',error:String(e.stack)});}}
for(const binding of dependencies){binding.afterSha256=hash(binding.source);assert.equal(binding.afterSha256,binding.beforeSha256);assert.equal(binding.copiedSha256,binding.beforeSha256);}
const report={recordedAtUtc:new Date().toISOString(),evidenceRoot,elapsedMs:Date.now()-start,results,dependencies,productionWritten:false,trainingPerformed:false};put(evidenceRoot,'results.json',report);console.log(JSON.stringify(report,null,2));if(results.some(r=>r.status==='failed'))process.exitCode=1;
