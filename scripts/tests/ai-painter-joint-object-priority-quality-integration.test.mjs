import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {parse} from '@babel/parser';
import {randomUUID,createHash} from 'node:crypto';
import {collectActualExecutionSources} from '../lib/ai-painter-execution-source-closure-v1.mjs';
import {ownedStopSourceFileMaximum,createOwnedStopRequestComponent,STOP_REQUEST_LIMITS} from '../lib/ai-painter-owned-stop-request-v1.mjs';
import {issueLocalOperatorSession} from '../../src/server/ai-console-control/operator-session.ts';
import {mock} from 'node:test';
import * as reg from '../lib/ai-painter-object-support-structure-quality-registration-v1.mjs';
import * as joint from '../lib/ai-painter-joint-object-priority-quality-package-chain-v1.mjs';
import * as chain from '../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs';
import {localPreparationRoute,parseLocalPrepareArguments,LOCAL_JOINT_PREPARE_REGISTRATION,verifyPreparationSources} from '../lib/ai-painter-local-prepare-v1.mjs';
import {LOCAL_JOINT_CONTROL_REGISTRATION,validateLocalStartPackage} from '../run-ai-painter-local-control-v1.mjs';
import {PHASES,CLOSED_LOOP_CONTRACT_PATH,CURRENT_ENTRYPOINT_REGISTRY_PATH} from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';
import * as phases from '../run-ai-painter-object-support-structure-quality-v1.mjs';

const root=process.cwd(),route=reg.JOINT_PROFILE;
const candidate=JSON.parse(fs.readFileSync(path.join(root,reg.CANDIDATE.path)));
const policy=()=>JSON.parse(fs.readFileSync(path.join(root,route.EXECUTION_POLICY.path)));
const preview={path:route.previewPath,sha256:'a'.repeat(64)};
const configuration=()=>reg.deriveConfiguration(candidate,{capabilityVersion:reg.JOINT_CAPABILITY,trainingPreviewPolicy:preview});
const bound=path=>({path,sha256:'b'.repeat(64)});

test('actual CPU fixtureOutputRoot accepts joint harness arguments and preserves exact root boundaries',t=>{
 const file='scripts/tests/ai-painter-object-support-structure-quality-entry.test.mjs',source=fs.readFileSync(path.join(root,file),'utf8');
 const fn=parse(source,{sourceType:'module'}).program.body.find(n=>n.type==='FunctionDeclaration'&&n.id?.name==='fixtureOutputRoot');
 assert.ok(fn,'exact existing fixtureOutputRoot function required');
 // Execute the exact existing function with real filesystem/storage operations.
 // Isolated environment objects avoid mutating this test process or consuming
 // any real CPU request. This does not supply a managed SQLite keeper context.
 const load=env=>Function('assert','registration','inside','fs','process','crypto',
  'let budgetRoot;\n'+source.slice(fn.start,fn.end)+'\nreturn fixtureOutputRoot;')
  (assert,reg,chain.inside,fs,{env,cwd:()=>root},{randomUUID});
 const roots=[reg.OUTPUT_ROOT,reg.FINAL_RGB_PROFILE.OUTPUT_ROOT,reg.JOINT_PROFILE.OUTPUT_ROOT];
 const parents=[];
 t.after(()=>{for(const logical of parents){const physical=chain.inside(root,logical),allowed=chain.inside(root,logical.slice(0,logical.lastIndexOf('/')));assert.equal(path.dirname(physical),allowed);fs.rmSync(physical,{recursive:true,force:true});}});
 for(const prefix of roots){
  const parent=prefix+'/joint-object-quality-v1-'+randomUUID(),logical=parent+'/cpu-entry';parents.push(parent);
  const env={TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT:logical,T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT:logical},actual=load(env);
  assert.equal(actual(),logical);assert.equal(actual(),logical);
  assert.ok(fs.lstatSync(chain.inside(root,logical)).isDirectory());
  env.T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT=logical+'-changed';assert.throws(()=>actual(),/CPU harness roots disagree/);
 }
 const valid=reg.JOINT_PROFILE.OUTPUT_ROOT+'/joint-object-quality-v1-'+randomUUID()+'/cpu-entry';
 for(const logical of [valid.replace(reg.JOINT_PROFILE.OUTPUT_ROOT,'.runtime/ai-painter/unknown-executions'),valid+'/nested',valid.replace('/cpu-entry','/nested/cpu-entry'),valid.replace('/cpu-entry','/../cpu-entry'),valid.replace('/cpu-entry',''),valid.replace('/cpu-entry','/cpu-entry/'),valid.replace('/cpu-entry','/CPU-ENTRY')])
  assert.throws(()=>load({TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT:logical,T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT:logical})());
 assert.throws(()=>load({TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT:valid,T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT:valid+'-different'})(),/CPU harness roots disagree/);
 const parent=reg.JOINT_PROFILE.OUTPUT_ROOT+'/joint-object-quality-v1-'+randomUUID();parents.push(parent);
 const redirected=parent+'/cpu-entry',physicalParent=chain.inside(root,parent),target=fs.mkdtempSync(path.join(os.tmpdir(),'joint-root-redirect-'));
 fs.mkdirSync(physicalParent,{recursive:true});const link=path.join(physicalParent,'cpu-entry');
 try{
  fs.symlinkSync(target,link,'junction');
  assert.throws(()=>load({TD_TRAIN_ENTRY_CPU_OUTPUT_ROOT:redirected,T_Q4_FAILURE_CAPTURE_CPU_OUTPUT_ROOT:redirected})(),/descendant redirect refused/);
 }finally{
  if(fs.existsSync(link)){assert.ok(fs.lstatSync(link).isSymbolicLink());fs.unlinkSync(link);}
  assert.equal(path.dirname(target),os.tmpdir());fs.rmSync(target,{recursive:true,force:true});
 }
});

test('actual verifyPreparationSources accepts the complete production closure within260;261 and old257 reject',t=>{
 const bindings=chain.finalProgramBindings(root,{capabilityVersion:reg.JOINT_CAPABILITY});
 const count=Object.keys(bindings).length;assert.ok(count<=260&&count>=257);
 assert.equal(bindings.progressPublication.path,joint.JOINT_COMPONENTS.progressPublication);
 assert.equal(bindings.progressPublicationPolicy.path,reg.JOINT_PROGRESS_PUBLICATION_POLICY.path);
 const actual=verifyPreparationSources(root,bindings,route.candidateSelection);
 assert.equal(actual.roles,count);assert.equal(actual.uniqueFiles,count);
 const measured=Object.values(bindings).reduce((total,b)=>total+chain.read(root,b).length,0);
 assert.equal(actual.bytes,measured);
 const extra={...bindings,...Object.fromEntries(Array.from({length:261-count},(_,i)=>['extra-'+i,
  {path:'private-not-read-before-count-limit-'+i+'.txt',sha256:'f'.repeat(64)}]))};
 assert.throws(()=>verifyPreparationSources(root,extra,route.candidateSelection),/local_prepare_source_count_limit/);
 const old257=Object.fromEntries(Object.entries(bindings).slice(0,257));
 for(const selection of ['object-support-structure-quality-v1','final-rgb-base-weight-quality-v1'])
  assert.throws(()=>verifyPreparationSources(root,old257,selection),/local_prepare_source_count_limit/);
 const wrong=structuredClone(bindings);wrong.executionPolicy.sha256='f'.repeat(64);
 assert.throws(()=>verifyPreparationSources(root,wrong,route.candidateSelection),/local_prepare_joint_policy_binding/);
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'joint-prepare-policy-drift-'));
 t.after(()=>{assert.equal(path.dirname(fixture),os.tmpdir());fs.rmSync(fixture,{recursive:true,force:true});});
 const file=path.join(fixture,route.EXECUTION_POLICY.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'{}');
 assert.throws(()=>verifyPreparationSources(fixture,bindings,route.candidateSelection),/local_prepare_joint_policy_sha/);
});

test('joint late-import exclusions reject a changed frozen CPU suite caller before traversal',t=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'joint-source-caller-'));
 t.after(()=>{assert.equal(path.dirname(fixture),os.tmpdir());fs.rmSync(fixture,{recursive:true,force:true});});
 const harness='ml/ai-painter/tests/test_object_support_structure_execution_cpu_v1.py';
 const required={harness,jointProfile:joint.JOINT_COMPONENTS.trainingProfile,executionPolicy:route.EXECUTION_POLICY.path};
 for(const name of Object.values(required)){
  const file=path.join(fixture,name);fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,fs.readFileSync(path.join(root,name)));
 }
 fs.appendFileSync(path.join(fixture,harness),'\n# changed reviewed caller\n');
 assert.throws(()=>collectActualExecutionSources({root:fixture,required,python:path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),
  bind:name=>({path:name,sha256:createHash('sha256').update(fs.readFileSync(path.join(fixture,name))).digest('hex')})}),
 /reviewed late import caller changed/);
});

// Structural metadata fixtures are not a model, an actual closure, a native
// receipt, qualification or a package that any production validator may admit.
function shapeFixture(){
 const id=randomUUID(),runId='joint-object-quality-v1-'+id,packageId='joint-object-quality-v1-package-'+id;
 const outputRoot=route.OUTPUT_ROOT+'/'+runId,config=configuration();
 const graph=Array.from({length:108},(_,i)=>({name:'synthetic-shape-only-'+i,dtype:'torch.float32',shape:[1],elements:1}));
 graph[0]={...graph[0],shape:[2180375],elements:2180375};
 for(const [i,name]of [[52,'core.core.terrain.decode_1.layers.3.weight'],[60,'core.core.terrain.full_resolution_detail.layers.3.weight'],[88,'core.core.final_rgb_decoder.base.layers.2.weight']])graph[i]={name,dtype:'torch.float32',shape:[48,48,3,3],elements:20736};
 const modelIdentity={capabilityVersion:reg.JOINT_CAPABILITY,modelCapabilityVersion:route.MODEL_CAPABILITY,architecture:route.ARCHITECTURE,numericRule:route.NUMERIC_RULE,graph,initialState:{generator:'c'.repeat(64),discriminator:'d'.repeat(64)}};
 const modelBinding=bound(outputRoot+'/model-identity.json');
 const plan={schema:reg.PLAN_SCHEMA,capabilityVersion:reg.JOINT_CAPABILITY,executionProfile:route.EXECUTION_PROFILE,executionMode:'bounded-quality-training',runId,packageId,outputRoot,configuration:config,
  formalSpecification:route.SPECIFICATION,executionPolicy:route.EXECUTION_POLICY,trainingPreviewPolicy:preview,sourceCandidate:reg.CANDIDATE,modelBinding,
  finalCpuAcceptance:bound(outputRoot+'/cpu-acceptance.json'),programBindings:{syntheticOnly:bound('synthetic-only.mjs')},historicalCheckpointMayInitialize:false,trainingRestartAllowed:false};
 return {plan,planBinding:bound(outputRoot+'/quality-plan.json'),packageBinding:bound('.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json'),modelBinding,modelIdentity};
}

test('registered joint shape and alias checks allow260 and reject261; old routes reject257',()=>{
 const programs=n=>Object.fromEntries(Array.from({length:n},(_,i)=>['source-'+i,bound('synthetic/source-'+i+'.txt')]));
 assert.equal(reg.sourceFileCountMaximum(reg.JOINT_CAPABILITY),260);
 for(const cap of [reg.CAPABILITY,reg.FINAL_RGB_CAPABILITY]){
  assert.equal(reg.sourceFileCountMaximum(cap),256);
  assert.throws(()=>chain.verifyProgramBindingAliases(programs(257),{capabilityVersion:cap}),/source role ceiling/);
 }
 assert.equal(chain.verifyProgramBindingAliases(programs(260),{capabilityVersion:reg.JOINT_CAPABILITY}).roles,260);
 assert.throws(()=>chain.verifyProgramBindingAliases(programs(261),{capabilityVersion:reg.JOINT_CAPABILITY}),/source role ceiling/);
 const fixture=shapeFixture();fixture.plan.programBindings=programs(260);reg.validate(fixture);
 fixture.plan.programBindings=programs(261);assert.throws(()=>reg.validate(fixture));
});

test('production collector fixes joint v3 at260 and old routes at256 despite caller maxima',t=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'joint-count-boundary-'));
 t.after(()=>{assert.equal(path.dirname(fixture),os.tmpdir());fs.rmSync(fixture,{recursive:true,force:true});});
 const put=(name,bytes)=>{const p=path.join(fixture,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);};
 const required={jointProfile:joint.JOINT_COMPONENTS.trainingProfile,executionPolicy:route.EXECUTION_POLICY.path};
 for(const name of Object.values(required))put(name,fs.readFileSync(path.join(root,name)));
 for(let i=0;i<258;i++){const name='source-'+i+'.txt';put(name,'metadata');required['r'+i]=name;}
 const options={root:fixture,required,python:path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),
  bind:name=>({path:name,sha256:createHash('sha256').update(fs.readFileSync(path.join(fixture,name))).digest('hex')})};
 assert.equal(Object.keys(collectActualExecutionSources(options)).length,260);
 required.extra='extra.txt';put('extra.txt','x');
 assert.throws(()=>collectActualExecutionSources({...options,maximumEntries:999}),/exceeds260/);
 const oldRequired=Object.fromEntries(Object.entries(required).filter(([key])=>key.startsWith('r')).slice(0,257));
 assert.throws(()=>collectActualExecutionSources({...options,required:oldRequired,maximumEntries:260}),/exceeds256/);
 put(route.EXECUTION_POLICY.path,Buffer.from('changed registered policy'));
 assert.throws(()=>collectActualExecutionSources(options),/registered joint policy bytes differ/);
});

test('current joint loaded-source guard rejects unbound or changed modules without model execution',()=>{
 const bindings=chain.finalProgramBindings(root,{capabilityVersion:reg.JOINT_CAPABILITY});
 const code=`import sys,json,importlib,types
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'ml/ai-painter/src'),str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/tests')]
plan={'capabilityVersion':'stage4_mvp256_dry_joint_object_priority_quality24_v1','programBindings':json.load(sys.stdin)}
import torch
torch.set_num_threads(2);calls={}
def forbidden(name):
 def stop(*a,**k):calls[name]=calls.get(name,0)+1;raise AssertionError(name)
 return stop
with ExitStack() as guards:
 for obj,name in ((torch.nn.Module,'_call_impl'),(torch.autograd,'grad'),(torch.autograd,'backward'),(torch.optim.Optimizer,'__init__'),(torch.cuda,'_lazy_init'),(torch,'load')):guards.enter_context(patch.object(obj,name,side_effect=forbidden(name)))
 for name in ['painter_stage4_joint_object_priority_training_profile_v1','object_support_structure_quality_auth_v1','painter_stage4_object_support_structure_quality_worker_v1','painter_stage4_object_support_structure_lifecycle_v1','qualify_stage4_object_support_structure_quality_gpu_v1','review_stage4_object_support_structure_quality_cpu_v1','test_joint_object_priority_quality_adapters_cpu_v1','test_object_support_structure_execution_cpu_v1','ai_painter.complete_world.bounded_progress_publication_cpu_v1','ai_painter.complete_world.joint_object_priority_quality_checkpoint_v1']:importlib.import_module(name)
 assert 'painter_stage4_detail_weight_capture_execution_worker' not in sys.modules
 import painter_stage4_object_support_structure_quality_worker_v1 as worker
 import object_support_structure_quality_auth_v1 as auth
 reader=auth.Reader(root);observed=worker.verify_loaded_sources(reader,plan)
 logical='ml/ai-painter/scripts/painter_stage4_appearance_regime_detail_weight_training_profile.py'
 assert logical not in {b['path'] for b in plan['programBindings'].values()}
 module=types.ModuleType('unregistered_project_source');module.__file__=str(root/logical);sys.modules[module.__name__]=module
 try:
  try:worker.verify_loaded_sources(reader,plan)
  except Exception as error:assert 'loaded project source outside closure: '+logical in str(error)
  else:raise AssertionError('unregistered loaded source accepted')
 finally:sys.modules.pop(module.__name__)
 key=next(k for k,b in plan['programBindings'].items() if b['path'].endswith('/painter_stage4_object_support_structure_quality_worker_v1.py'))
 plan['programBindings'][key]['sha256']='0'*64
 try:worker.verify_loaded_sources(reader,plan)
 except Exception:pass
 else:raise AssertionError('changed loaded source accepted')
 assert not calls and not torch.cuda.is_initialized()
 print(json.dumps({'projectSources':len(observed['projectSources']),'unregisteredRejected':True,'shaMismatchRejected':True,'forbiddenCalls':calls,'historicalWorkerImported':False,'runtimeClosureCompleteProof':False}))
`;
 const result=spawnSync(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-I','-B','-X','utf8','-c',code,root],{
  input:JSON.stringify(bindings),encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1048576,
  env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',CUDA_VISIBLE_DEVICES:''}});
 assert.equal(result.status,0,result.stderr);
 const proof=JSON.parse(result.stdout);assert.ok(proof.projectSources>0);
 assert.equal(proof.unregisteredRejected,true);assert.equal(proof.shaMismatchRejected,true);
 assert.equal(proof.historicalWorkerImported,false);assert.deepEqual(proof.forbiddenCalls,{});
});

function stopFixture(t,count=260){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'joint-stop-count-')),project=path.join(base,'project'),evidence=path.join(base,'evidence');
 fs.mkdirSync(project);fs.mkdirSync(evidence);
 t.after(()=>{assert.equal(path.dirname(base),os.tmpdir());fs.rmSync(base,{recursive:true,force:true});});
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const put=(name,value)=>{const p=path.join(project,name),bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);return {path:name,sha256:hash(bytes)};};
 put(route.EXECUTION_POLICY.path,fs.readFileSync(path.join(root,route.EXECUTION_POLICY.path)));
 const runId='joint-object-quality-v1-'+randomUUID(),packageId='joint-object-quality-v1-package-'+randomUUID();
 const outputRoot=route.OUTPUT_ROOT+'/'+runId;
 const plan={schema:reg.PLAN_SCHEMA,capabilityVersion:reg.JOINT_CAPABILITY,runId,packageId,outputRoot,
  executionPolicy:route.EXECUTION_POLICY,configuration:{capabilityVersion:reg.JOINT_CAPABILITY,executionPolicy:route.EXECUTION_POLICY}};
 const planBinding=put('private-plan.json',plan),bindings=Object.fromEntries(Array.from({length:count},(_,i)=>['source-'+i,put('sources/'+i+'.txt',Buffer.from('private metadata only'))]));
 const spec={capabilityVersion:reg.JOINT_CAPABILITY,packageIdentity:packageId,outputRoot,inputEvidence:[planBinding],
  programLineage:Object.fromEntries(Object.entries(bindings).map(([key,b])=>[key,b.sha256]))};
 let packageBinding=put('private-package.json',spec);
 const registry={runId,packageId,registryRevision:4,executionState:'executing',activeExecution:{runId,packageId,executionState:'executing',processId:123,processStartIdentity:'private-start-123',programLineage:bindings}};
 const registryBinding=put('private-registry.json',registry);
 const component=createOwnedStopRequestComponent({projectRoot:project,evidenceRoot:evidence,
  readCurrentExecution:()=>({registryPath:registryBinding.path,registrySha256:registryBinding.sha256}),
  readRetainedNativeCall:()=>({callId:'private-retained-call',runId,packageId,executionPackageSha256:packageBinding.sha256,supervisorProcessId:123,supervisorProcessStartIdentity:'private-start-123'})});
 const input={runId,packageId,executionPackagePath:packageBinding.path,executionPackageSha256:packageBinding.sha256,
  expectedRegistryRevision:4,supervisorProcessId:123,supervisorProcessStartIdentity:'private-start-123',idempotencyKey:'private_stop_key_00001',reasonText:'private component stop fixture'};
 const refresh=()=>{const b=put('private-plan.json',plan);spec.inputEvidence=[b];packageBinding=put('private-package.json',spec);input.executionPackageSha256=packageBinding.sha256;};
 return {project,evidence,spec,plan,put,input,refresh,component,bindings};
}

test('existing local package gate validates all260 joint sources and rejects261 before any launcher',t=>{
 const fixture=stopFixture(t),{project,plan,spec,put,bindings}=fixture;
 put(CLOSED_LOOP_CONTRACT_PATH,fs.readFileSync(path.join(root,CLOSED_LOOP_CONTRACT_PATH)));
 put(CURRENT_ENTRYPOINT_REGISTRY_PATH,{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:[LOCAL_JOINT_CONTROL_REGISTRATION]});
 const files=[LOCAL_JOINT_CONTROL_REGISTRATION.entryFile,chain.ADAPTER,
  'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs','scripts/lib/ai-painter-owned-stop-request-v1.mjs',
  'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs','scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs','src/server/ai-console-control/operator-session.ts'];
 for(const [i,name]of files.entries())bindings['source-'+i]=put(name,Buffer.from('// inert private package gate source; never executed'));
 plan.programBindings=bindings;
 Object.assign(spec,{schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',ownerAuthorizationRequired:false,ownerInStateMachine:false,maxInfrastructureRecoveryAttempts:0,
  phaseAdapters:Object.fromEntries(PHASES.map(phase=>[phase,{kind:'project_module_export',path:chain.ADAPTER,sha256:bindings['source-1'].sha256,exportName:phase}]))});
 const save=()=>{spec.programLineage=Object.fromEntries(Object.entries(bindings).map(([key,b])=>[key,b.sha256]));spec.inputEvidence=[put('private-plan.json',plan)];
  const b=put('.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',Buffer.from(JSON.stringify(spec,null,2)+'\n'));return {command:'start',packagePath:b.path,packageSha256:b.sha256};};
 assert.equal(Object.keys(validateLocalStartPackage(project,save()).plan.programBindings).length,260);
 bindings.extra=put('extra.txt',Buffer.from('extra'));
 assert.throws(()=>validateLocalStartPackage(project,save()),/local_source_count_limit/);
});

test('stop verifier accepts260 joint bindings and rejects261, stale policy, forged max and old257',t=>{
 const previous=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=randomUUID()+randomUUID();
 t.after(()=>{if(previous===undefined)delete process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;else process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET=previous;});
 const request=()=>{const issued=issueLocalOperatorSession(new Request('http://localhost:3000/api/ai-console/control/operator-session',{headers:{host:'localhost:3000'}}));assert.equal(issued.ok,true);return new Request('http://localhost:3000/api/ai-console/control/commands',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000',cookie:issued.setCookie.split(';')[0],'x-ai-console-csrf':issued.session.csrfToken}});};
 const valid=stopFixture(t);assert.equal(ownedStopSourceFileMaximum(valid.project,valid.spec),260);
 const accepted=valid.component.submit({input:valid.input,operatorRequest:request()});assert.equal(accepted.status,'requested');assert.equal(accepted.cleanupConfirmed,false);
 const provider=valid.component.createAbortReasonProvider({requestId:accepted.requestId});assert.match(provider.abortReason(),/^operator_stop:/);assert.equal(provider.abortReason(),null);
 const tooMany=stopFixture(t,261);assert.throws(()=>tooMany.component.submit({input:tooMany.input,operatorRequest:request()}),/stop_source_closure_missing/);
 const stale=stopFixture(t);stale.plan.executionPolicy=reg.FINAL_RGB_PROFILE.EXECUTION_POLICY;stale.refresh();assert.throws(()=>ownedStopSourceFileMaximum(stale.project,stale.spec),/stop_joint_policy_binding/);
 const changed=stopFixture(t);changed.put(route.EXECUTION_POLICY.path,Buffer.from('changed'));assert.throws(()=>ownedStopSourceFileMaximum(changed.project,changed.spec),/stop_joint_policy_sha/);
 const last=stopFixture(t);last.put('sources/259.txt',Buffer.from('tampered final source'));assert.throws(()=>last.component.submit({input:last.input,operatorRequest:request()}),/stop_source_sha_mismatch/);
 const old=stopFixture(t,257);old.spec.capabilityVersion=reg.FINAL_RGB_CAPABILITY;old.spec.maximumEntries=260;old.refresh();assert.equal(ownedStopSourceFileMaximum(old.project,old.spec),256);
 assert.throws(()=>old.component.submit({input:old.input,operatorRequest:request()}),/stop_source_closure_missing/);
 assert.equal(STOP_REQUEST_LIMITS.sourceFiles,256);
});

test('joint route has its own execution identity and the genuine unchanged model capability',()=>{
 assert.equal(reg.executionRoute(reg.JOINT_CAPABILITY),route);
 assert.equal(route.MODEL_CAPABILITY,reg.FINAL_RGB_PROFILE.MODEL_CAPABILITY);
 assert.equal(route.ARCHITECTURE,reg.FINAL_RGB_PROFILE.ARCHITECTURE);
 assert.equal(route.NUMERIC_RULE,reg.FINAL_RGB_PROFILE.NUMERIC_RULE);
 assert.notEqual(route.CAPABILITY,reg.FINAL_RGB_CAPABILITY);
 assert.equal(reg.gpuAdmissionSeconds(route.CAPABILITY),720);
 assert.equal(reg.gpuAdmissionSeconds(reg.FINAL_RGB_CAPABILITY),720);
 assert.equal(reg.gpuAdmissionSeconds(reg.CAPABILITY),600);
 assert.throws(()=>reg.executionRoute('unknown-route'));assert.throws(()=>reg.gpuAdmissionSeconds('unknown-route'));
});
test('configuration changes only registered identity, joint rule and progress publication binding',()=>{
 const actual=configuration(),old=reg.deriveConfiguration(candidate,{capabilityVersion:reg.FINAL_RGB_CAPABILITY,trainingPreviewPolicy:{...preview,path:reg.FINAL_RGB_PROFILE.previewPath}});
 assert.deepEqual(actual.jointLearningRule,reg.JOINT_LEARNING_RULE);
 assert.deepEqual(actual.progressPublicationPolicy,reg.JOINT_PROGRESS_PUBLICATION_POLICY);
 const identityKeys=['capabilityVersion','formalSpecification','executionPolicy','trainingPreviewPolicy','jointLearningRule','progressPublicationPolicy'];
 const omit=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!identityKeys.includes(key)));
 assert.deepEqual(omit(actual),omit(old));assert.equal(Object.hasOwn(old,'jointLearningRule'),false);
 assert.deepEqual(actual.gradientDefinition,reg.GRADIENT);
 assert.deepEqual(actual.optimizer,{name:'AdamW',generatorLearningRate:.0001,discriminatorLearningRate:.0001,weightDecay:.01,betas:[.9,.999],eps:1e-8});
});

test('progress deferral cannot be enabled by caller booleans, stale policy or changed bounds',()=>{
 for(const change of [p=>delete p.progressPublication,p=>p.progressPublication=true,
  p=>p.progressPublication.componentPolicy={...reg.JOINT_PROGRESS_PUBLICATION_POLICY,sha256:'f'.repeat(64)},
  p=>p.progressPublication.freshnessSeconds=121,p=>p.progressPublication.maximumPendingFiles=2,
  p=>p.progressPublication.originalDeadlineRequired=false]){
  const altered=policy();change(altered);assert.throws(()=>joint.verifyJointPolicy(altered,configuration()));
 }
 const altered=configuration();altered.progressPublicationPolicy={...reg.JOINT_PROGRESS_PUBLICATION_POLICY,sha256:'f'.repeat(64)};
 assert.throws(()=>joint.verifyJointPolicy(policy(),altered));
});
test('new immutable policy semantics match the exact current configuration',()=>{
 assert.equal(joint.verifyJointPolicy(policy(),configuration()).candidate,reg.JOINT_CAPABILITY);
 assert.equal(chain.bind(root,route.EXECUTION_POLICY.path).sha256,route.EXECUTION_POLICY.sha256);
 assert.equal(chain.bind(root,route.SPECIFICATION.path).sha256,route.SPECIFICATION.sha256);
});

test('v3 changes progress publication and version bindings, not model/data/Loss or resources',()=>{
 const previous=JSON.parse(fs.readFileSync(path.join(root,'data/ai-painter/system-governance/ai-painter-joint-object-priority-quality-execution-policy-v2.json')));
 const current=policy();
 const changed=['schemaVersion','formalSpecification','previousExecutionPolicy','progressPublication','progressPublicationCpuEvidence','stopRules'];
 const omit=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!changed.includes(key)));
 assert.deepEqual(omit(current),omit(previous));
 assert.deepEqual(current.previousExecutionPolicy,{path:'data/ai-painter/system-governance/ai-painter-joint-object-priority-quality-execution-policy-v2.json',sha256:'e2d952e457388461a3b80122c147754339cce35feb011c1944e68dff4b7d4ff4'});
 assert.equal(current.progressPublication.freshnessSeconds,120);
 assert.equal(current.stopRules.filter(text=>!text.startsWith('First failure,')&&!text.startsWith('Progress publication uses')).join('\n'),
  previous.stopRules.filter(text=>!text.startsWith('First failure,')).join('\n'));
});
test('old policy, candidate, profile, component and checkpoint identities cannot be borrowed',()=>{
 for(const change of [p=>p.schemaVersion='ai-painter-final-rgb-base-weight-quality-execution-policy-v3',p=>p.candidate=reg.FINAL_RGB_CAPABILITY,p=>p.modelCapability='wrong-model',p=>p.executionProfile=reg.FINAL_RGB_PROFILE.EXECUTION_PROFILE,p=>p.outputRoot=reg.FINAL_RGB_PROFILE.OUTPUT_ROOT,p=>p.checkpointIdentity.schema='final-rgb-base-weight-quality-checkpoint-v1',p=>p.componentPaths.trainingProfile='old-profile.py']){
  const p=policy();change(p);assert.throws(()=>joint.verifyJointPolicy(p,configuration()));
 }
});
test('old five-gradient protocol cannot stand in for joint learning-rule authority',()=>{
 for(const change of [p=>delete p.jointLearningRule,p=>p.jointLearningRule=reg.GRADIENT,p=>p.jointLearningRule={...reg.JOINT_LEARNING_RULE,sha256:'0'.repeat(64)},p=>p.modelBoundary.learningRuleChangedOnlyInFourObjectRgbHeads=false]){
  const p=policy();change(p);assert.throws(()=>joint.verifyJointPolicy(p,configuration()));
 }
 const config=configuration();config.jointLearningRule=reg.GRADIENT;assert.throws(()=>joint.verifyJointPolicy(policy(),config));
});
test('CPU/GPU/train/review ceilings and zero-update admission cannot be overridden',()=>{
 for(const change of [p=>p.phaseResources.programFileCountMaximum=261,p=>p.sourceClosure.maximumEntries=261,p=>p.phaseResources.gpuAdmissionSeconds=721,p=>p.phaseResources.cpuPreparationSeconds=241,p=>p.phaseResources.reviewSeconds=121,p=>p.executionCeiling.maxWallSeconds=8401,p=>p.gpuAdmission.optimizerUpdates=1,p=>p.gpuAdmission.generatorAutogradPerSample=4,p=>p.qualification.trainingQualified=true]){
  const p=policy();change(p);assert.throws(()=>joint.verifyJointPolicy(p,configuration()));
 }
});
test('shape registration rejects wrong cap, old execution policy, rule, preview and model metadata',()=>{
 assert.equal(reg.validate(shapeFixture()).plan.capabilityVersion,reg.JOINT_CAPABILITY);
 for(const change of [v=>v.plan.capabilityVersion='unknown',v=>v.plan.executionPolicy=reg.FINAL_RGB_PROFILE.EXECUTION_POLICY,v=>v.plan.configuration.jointLearningRule=reg.GRADIENT,v=>v.plan.trainingPreviewPolicy={...preview,path:reg.FINAL_RGB_PROFILE.previewPath},v=>v.modelIdentity.graph[88].name='old-target',v=>v.modelIdentity.modelCapabilityVersion='fake-model']){
  const value=shapeFixture();change(value);assert.throws(()=>reg.validate(value));
 }
});
test('joint rule field is rejected when presented as the old finalRGB candidate',()=>{
 const value=shapeFixture();value.plan.capabilityVersion=reg.FINAL_RGB_CAPABILITY;
 assert.throws(()=>reg.validate(value));
 assert.equal(reg.executionRoute(reg.FINAL_RGB_CAPABILITY),reg.FINAL_RGB_PROFILE);
 assert.equal(reg.FINAL_RGB_PROFILE.EXECUTION_POLICY.sha256,'5479dde98dd24882309986051c86fdfba024a2b3756082a79c9c9734ad3e2de1');
 assert.equal(reg.executionRoute(reg.CAPABILITY).MODEL_CAPABILITY,reg.MODEL_CAPABILITY);
});
test('start/prepare and the existing status/stop registrations retain the new fixed selection',()=>{
 const local=localPreparationRoute(route.candidateSelection);
 assert.equal(local.registration,LOCAL_JOINT_PREPARE_REGISTRATION);
 assert.equal(local.capability,reg.JOINT_CAPABILITY);assert.equal(local.prefix,'joint-object-quality-v1-');
 assert.equal(local.packagePrefix,'joint-object-quality-v1-package-');assert.equal(local.adapter,chain.ADAPTER);
 assert.equal(LOCAL_JOINT_CONTROL_REGISTRATION.adapterFile,chain.ADAPTER);
 assert.deepEqual(parseLocalPrepareArguments(['--protocol','ai-painter-local-control-v2','start','--candidate',route.candidateSelection]),{command:'start',candidateSelection:route.candidateSelection});
 assert.throws(()=>localPreparationRoute('joint-unknown'));
 for(const capability of [reg.CAPABILITY,reg.FINAL_RGB_CAPABILITY])assert.equal(localPreparationRoute(reg.executionRoute(capability).candidateSelection??'object-support-structure-quality-v1').capability,capability);
});
test('entry registry contains both exact existing-control registrations',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(root,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json')));
 const entries=[];const walk=value=>{if(!value||typeof value!=='object')return;if(value.entryId)entries.push(value);for(const child of Object.values(value))if(typeof child==='object')walk(child);};walk(raw);
 for(const registration of [LOCAL_JOINT_PREPARE_REGISTRATION,LOCAL_JOINT_CONTROL_REGISTRATION])assert.deepEqual(entries.find(e=>e.entryId===registration.entryId),registration);
});
test('same existing adapter exports all six phases without a second executor',()=>{
 for(const key of ['preflight','execute','validate','review','adjudicate','finalize'])assert.equal(typeof phases[key],'function');
 assert.equal(chain.ADAPTER,'scripts/run-ai-painter-object-support-structure-quality-v1.mjs');
});
test('actual-closure role checks reject aliases for the new route without changing old route identity',()=>{
 const item=bound('same.mjs');assert.throws(()=>chain.verifyProgramBindingAliases({first:item,second:item},{capabilityVersion:reg.JOINT_CAPABILITY}));
 assert.deepEqual(chain.verifyProgramBindingAliases({first:item},{capabilityVersion:reg.JOINT_CAPABILITY}),{roles:1,uniquePaths:1});
});
test('joint timing staged replacement retains exact bounded original rescan behavior',()=>{
 const logical=route.OUTPUT_ROOT+'/joint-object-quality-v1-'+randomUUID(),dir=chain.inside(root,logical);
 assert.equal(fs.existsSync(dir),false);fs.mkdirSync(dir,{recursive:true});
 const staged=path.join(dir,'gpu-qualification-timing.json.staged'),final=path.join(dir,'gpu-qualification-timing.json');
 fs.writeFileSync(staged,Buffer.alloc(53));const original=fs.lstatSync;let replaced=false;
 try{mock.method(fs,'lstatSync',function(file,...args){if(path.resolve(file)===staged&&!replaced){fs.renameSync(staged,final);replaced=true;}return original.call(fs,file,...args);});
  assert.equal(chain.directoryBytes(dir),53);assert.equal(replaced,true);
 }finally{mock.restoreAll();assert.equal(path.dirname(dir),chain.inside(root,route.OUTPUT_ROOT));fs.rmSync(dir,{recursive:true});}
});
