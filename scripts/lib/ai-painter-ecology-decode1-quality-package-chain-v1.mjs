// Own diagnostic plan/package adapter; neutral IO shares the existing budget.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import crypto from 'node:crypto';
import {projectRoot,physicalRuntimeRoot} from './ai-pet-world-storage.mjs';
import * as io from './ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';
import {CAPABILITY,MODEL_CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,CANDIDATE,FROZEN_PLAN,
 binding,deriveConfiguration,validate,validateModelIdentity,validateTerminal,validateCompleted} from './ai-painter-ecology-decode1-quality-registration-v1.mjs';
export {CAPABILITY,MODEL_CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,SPECIFICATION,CANDIDATE,FROZEN_PLAN,deriveConfiguration,validateTerminal,validateCompleted};
export const ADAPTER='scripts/run-ai-painter-ecology-decode1-quality-v1.mjs';
export const sha=io.sha,withOutputBudget=io.withOutputBudget,directoryBytes=io.directoryBytes;
export const ROLES={adapter:ADAPTER,packageChain:'scripts/lib/ai-painter-ecology-decode1-quality-package-chain-v1.mjs',
 frozenProjectManifest:'.runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-package.json',
 worker:'ml/ai-painter/scripts/painter_stage4_ecology_decode1_weight_quality_worker_v1.py',
 gpuQualifier:'ml/ai-painter/scripts/qualify_stage4_ecology_decode1_weight_quality_gpu_v1.py',
 executionAuth:'ml/ai-painter/scripts/ecology_decode1_weight_quality_auth_v1.py',
 registration:'scripts/lib/ai-painter-ecology-decode1-quality-registration-v1.mjs',
 nativeRunner:'scripts/lib/ai-painter-ecology-decode1-quality-owned-native-v1.mjs',
 nativeOwnerBuilder:'scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs',
 nativeOwnerSource:'scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs',
 nativeStreamTests:'scripts/tests/ai-painter-owned-worker-stream-v2.test.mjs',
 cpuHarness:'ml/ai-painter/tests/test_ecology_decode1_weight_quality_execution_cpu.py',
 entryTests:'scripts/tests/ai-painter-ecology-decode1-quality-entry.test.mjs',
 capture:'ml/ai-painter/src/ai_painter/complete_world/ecology_regime_gradient_failure_capture.py',
 captureTests:'ml/ai-painter/tests/test_ecology_regime_gradient_failure_capture_cpu.py',
 loop:'ml/ai-painter/scripts/painter_stage4_ecology_decode1_weight_quality_lifecycle_v1.py',
 loopTests:'ml/ai-painter/tests/test_ecology_decode1_weight_quality_lifecycle_cpu.py',
 trainingProfile:'ml/ai-painter/scripts/painter_stage4_ecology_decode1_weight_training_profile_v1.py',
 managedCheckpoint:'ml/ai-painter/src/ai_painter/complete_world/ecology_decode1_weight_checkpoint_v1.py',
 ranking:'ml/ai-painter/scripts/ecology_quality_ranking_v1.py',
 checkpointTests:'ml/ai-painter/tests/test_ecology_decode1_weight_checkpoint_cpu.py',
 decode1Model:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_precision_v1.py',
 decode1Operator:'ml/ai-painter/src/ai_painter/complete_world/decode1_weight_reduction_precision_v1.py',
 decode1Bridge:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_priority_update_v1.py',
 decode1CoreTests:'ml/ai-painter/tests/test_ecology_decode1_precision_core_cpu.py',
 reviewWorker:'ml/ai-painter/scripts/review_stage4_ecology_decode1_weight_quality_cpu_v1.py',
 reviewDriver:'scripts/run-ai-painter-ecology-decode1-quality-review-v1.mjs',
 reviewTests:'ml/ai-painter/tests/test_ecology_decode1_weight_quality_review_cpu.py',
 diagnosticLoop:'ml/ai-painter/scripts/painter_stage4_ecology_regime_failure_capture.py',
 diagnosticLoopTests:'ml/ai-painter/tests/test_ecology_regime_failure_capture_cpu.py',
 localControl:'scripts/run-ai-painter-local-control-v1.mjs',
 localPrepareEntry:'scripts/run-ai-painter-local-control-v2.mjs',
 localPrepare:'scripts/lib/ai-painter-local-prepare-v1.mjs',
 stopNativeControl:'scripts/lib/ai-painter-owned-stop-native-control-v1.mjs',
 stopRequest:'scripts/lib/ai-painter-owned-stop-request-v1.mjs',
 stopExecutionBridge:'scripts/lib/ai-painter-owned-stop-execution-bridge-v1.mjs',
 stopHandoff:'scripts/lib/ai-painter-owned-stop-handoff-v1.mjs',
 operatorSession:'src/server/ai-console-control/operator-session.ts',
 backgroundLauncher:'scripts/lib/ai-painter-autonomous-background-launcher-v1.mjs',
 storageMapping:'scripts/lib/ai-pet-world-storage.mjs',
 exactlyOnceSpawn:'scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs'};
// Additional v2 entry dependencies, not historical model-source roles.
export const LOCAL_DEPLOYMENT_DEPENDENCY_ROLES=Object.freeze({
 localOperatorDeploymentManifest:'node_modules/@next/env/package.json',
 localOperatorDeploymentLoader:'node_modules/@next/env/dist/index.js'});
const PHASES=['preflight','execute','validate','review','adjudicate','finalize'];
const scopes=new Map(),environment=process.env.AI_PET_WORLD_DATA_ROOT;
const id=s=>[String(s.dev),String(s.ino)].join(':');
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
function runtimePlain(filename){
 for(let current=filename;;current=path.dirname(current)){
  assert.equal(fs.lstatSync(current,{bigint:true}).isSymbolicLink(),false,'runtime path redirection refused');
  if(path.dirname(current)===current)break;
 }
}
function runtimeExecutableIdentity(filename){
 const original=path.resolve(filename);runtimePlain(original);
 const before=fs.lstatSync(original,{bigint:true});assert.ok(before.isFile(),'regular runtime executable required');
 const canonical=fs.realpathSync.native(original);runtimePlain(canonical);
 assert.equal(stamp(fs.lstatSync(canonical,{bigint:true})),stamp(before),'canonical runtime file identity differs');
 const fd=fs.openSync(canonical,'r'),hasher=crypto.createHash('sha256'),buffer=Buffer.alloc(1048576);
 const handleStamp=s=>[s.dev,s.ino,s.size,s.mtimeNs].map(String).join(':');let bytes=0;
 try{
  const handleBefore=fs.fstatSync(fd,{bigint:true});
  assert.equal(handleStamp(handleBefore),handleStamp(before),'runtime handle identity differs');
  for(;;){const count=fs.readSync(fd,buffer,0,buffer.length,null);if(count===0)break;bytes+=count;
   assert.ok(BigInt(bytes)<=before.size,'runtime executable grew during hash');hasher.update(buffer.subarray(0,count));}
  assert.equal(BigInt(bytes),before.size,'runtime executable size changed');
  assert.equal(stamp(fs.fstatSync(fd,{bigint:true})),stamp(handleBefore),'runtime handle changed during hash');
 }finally{fs.closeSync(fd);}
 runtimePlain(original);runtimePlain(canonical);
 assert.equal(stamp(fs.lstatSync(original,{bigint:true})),stamp(before),'original runtime executable changed');
 assert.equal(stamp(fs.lstatSync(canonical,{bigint:true})),stamp(before),'canonical runtime executable changed');
 return {absolutePath:canonical,sha256:hasher.digest('hex')};
}
export function runtimeIdentity(root){
 stable(root);
 return {python:runtimeExecutableIdentity(path.resolve(root,'ml/ai-painter/.venv/Scripts/python.exe')),
  node:runtimeExecutableIdentity(process.execPath)};
}
function stable(root){
 root=path.resolve(root);assert.equal(root,path.resolve(projectRoot),'configured project root required');
 assert.equal(process.env.AI_PET_WORLD_DATA_ROOT,environment,'storage configuration changed');
 const logical=path.join(root,'.runtime'),p=fs.lstatSync(root,{bigint:true}),link=fs.lstatSync(logical,{bigint:true});
 const target=fs.lstatSync(physicalRuntimeRoot,{bigint:true});
 assert.ok(p.isDirectory()&&!p.isSymbolicLink()&&target.isDirectory()&&!target.isSymbolicLink());
 assert.equal(fs.realpathSync(logical),fs.realpathSync(physicalRuntimeRoot),'formal runtime target differs');
 const current={project:id(p),projectPhysical:fs.realpathSync(root),link:id(link),redirected:link.isSymbolicLink(),
  linkTarget:link.isSymbolicLink()?fs.readlinkSync(logical):null,target:id(target),physical:fs.realpathSync(physicalRuntimeRoot)};
 if(scopes.has(root))assert.deepEqual(current,scopes.get(root),'project/logical/physical root identity changed');else scopes.set(root,current);
 return current;
}
export function inside(root,logical){
 binding({path:logical,sha256:'0'.repeat(64)});const scope=stable(root),parts=logical.split('/');
 let physical=scope.projectPhysical;
 if(parts[0]==='.runtime'){physical=scope.physical;parts.shift();}
 for(const part of parts){physical=path.join(physical,part);if(fs.existsSync(physical))assert.equal(fs.lstatSync(physical).isSymbolicLink(),false,'descendant redirect refused');}
 stable(root);return physical;
}
export function read(root,b){
 binding(b);const file=inside(root,b.path),before=fs.lstatSync(file,{bigint:true});
 assert.ok(before.isFile()&&!before.isSymbolicLink()&&before.size<=67108864n,'bounded regular input required');
 const fd=fs.openSync(file,'r');let data;
 try{assert.equal(stamp(fs.fstatSync(fd,{bigint:true})),stamp(before),'input identity changed');
  data=Buffer.alloc(Number(before.size));let n=0;while(n<data.length){const got=fs.readSync(fd,data,n,data.length-n,null);assert.ok(got>0);n+=got;}
  assert.equal(stamp(fs.fstatSync(fd,{bigint:true})),stamp(before),'input changed during read');
 }finally{fs.closeSync(fd);}
 assert.equal(stamp(fs.lstatSync(inside(root,b.path),{bigint:true})),stamp(before),'input replaced');assert.equal(sha(data),b.sha256,'input SHA differs');return data;
}
export function json(root,b){const raw=read(root,b);assert.ok(raw.length<=2097152);return JSON.parse(raw.toString('utf8'));}
export function bind(root,logical){const data=fs.readFileSync(inside(root,logical)),b={path:logical,sha256:sha(data)};read(root,b);return b;}
export function write(root,logical,value){
 inside(root,logical);const result=io.write(root,logical,value);read(root,result);return result;
}
export function finalProgramBindings(root){
 const frozen=json(root,FROZEN_PLAN).programBindings;assert.equal(Object.keys(frozen).length,179);
 const manifest=currentProjectManifestBinding(root,frozen);
 const programs=Object.fromEntries(Object.entries(frozen).map(([role,b])=>{if(role==='source-137')return ['frozen-'+role,manifest];read(root,b);return ['frozen-'+role,b]}));
 for(const [role,p]of Object.entries(ROLES))programs[role]=bind(root,p);
 // Additional direct neutral imports are explicitly bound, even if not in old closure.
 for(const p of ['scripts/lib/ai-pet-world-storage.mjs','scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs',
  'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','src/server/ai-painter-current-execution-registry.mjs'])
  programs['neutral-'+path.basename(p).replaceAll('.','-')]=bind(root,p);
 for(const [role,p]of Object.entries(LOCAL_DEPLOYMENT_DEPENDENCY_ROLES))programs[role]=bind(root,p);
 assert.deepEqual(programs.frozenProjectManifest,{path:ROLES.frozenProjectManifest,sha256:frozen['source-137'].sha256},'original manifest changed during collection');
 assert.ok(Object.keys(programs).length<=256);
 let bytes=0;const seen=new Map();
 for(const b of Object.values(programs)){const raw=read(root,b);assert.ok(raw.length<=1048576,'source file ceiling');
  if(seen.has(b.path))assert.equal(seen.get(b.path),b.sha256);else{seen.set(b.path,b.sha256);bytes+=raw.length;}
  assert.ok(bytes<=16777216,'unique source closure ceiling');}
 return programs;
}
export function verifyProjectManifestTransition(original,current){
 const alias='control:ai-painter-ecology-decode1-quality',command='node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs';
 assert.equal(Object.hasOwn(original.scripts,alias),false,'historical manifest already has new alias');
 assert.equal(current.scripts?.[alias],command,'exact single new control alias required');
 const remaining=structuredClone(current);delete remaining.scripts[alias];assert.deepEqual(remaining,original,'other manifest change refused');return true;
}
function currentProjectManifestBinding(root,frozen){
 const original=frozen['source-137'];assert.equal(original?.path,'package.json','exact historical source137 manifest required');
 const historical={path:ROLES.frozenProjectManifest,sha256:original.sha256},baseline=json(root,historical),current=bind(root,'package.json');
 verifyProjectManifestTransition(baseline,json(root,current));return current;
}
export function verifyLocalDeploymentDependencyClosure(root,programs){
 assert.ok(programs&&typeof programs==='object'&&!Array.isArray(programs),'deployment source closure required');
 for(const [role,p]of Object.entries(LOCAL_DEPLOYMENT_DEPENDENCY_ROLES)){
  assert.equal(programs[role]?.path,p,'deployment source role omitted/retargeted: '+role);
  read(root,programs[role]);
 }
 return {dependenciesVerified:Object.keys(LOCAL_DEPLOYMENT_DEPENDENCY_ROLES).length};
}
export function validatePlan(root,plan){
 assert.deepEqual(plan.configuration,deriveConfiguration(json(root,CANDIDATE)));
 const model=validateModelIdentity(json(root,plan.modelBinding));
 const input={plan,planBinding:{path:plan.outputRoot+'/quality-plan.json',sha256:sha(JSON.stringify(plan))},
  packageBinding:{path:'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',sha256:sha('shape-only')},modelBinding:plan.modelBinding,modelIdentity:model};validate(input);
 assert.ok(read(root,SPECIFICATION).includes(Buffer.from('AI-PAINTER-SPEC-1.59')));
 assert.ok(read(root,SPECIFICATION).includes(Buffer.from('9.6.42')));
 const frozen=json(root,FROZEN_PLAN).programBindings;assert.equal(Object.keys(frozen).length,179);
 const currentManifest=currentProjectManifestBinding(root,frozen);
 for(const [role,b]of Object.entries(frozen))assert.deepEqual(plan.programBindings['frozen-'+role],role==='source-137'?currentManifest:b,'old role omitted/changed');
 assert.deepEqual(plan.programBindings.frozenProjectManifest,{path:ROLES.frozenProjectManifest,sha256:frozen['source-137'].sha256},'historical manifest must retain original bytes');
 for(const [role,p]of Object.entries(ROLES))assert.equal(plan.programBindings[role]?.path,p);
 verifyLocalDeploymentDependencyClosure(root,plan.programBindings);
 const seen=new Map();let bytes=0;for(const b of Object.values(plan.programBindings)){const raw=read(root,b);assert.ok(raw.length<=1048576);if(!seen.has(b.path))bytes+=raw.length;else assert.equal(seen.get(b.path),b.sha256);seen.set(b.path,b.sha256);assert.ok(bytes<=16777216);}
 const candidate=json(root,CANDIDATE);for(const key of ['datasetManifest','trainSplit','validationSplit'])assert.deepEqual(plan[key],candidate.frozenBindings[key]);
 return plan;
}
export function verifyCpuReport(raw,request,plan){
 assert.equal(raw.schema,'ecology-decode1-weight-quality-entry-cpu-report-v1');assert.equal(raw.status,'passed');
 assert.ok(Number.isSafeInteger(raw.passed)&&raw.passed>=20);for(const key of ['failed','errors','skipped'])assert.equal(raw[key],0);
 assert.equal(raw.synthetic,true);assert.equal(raw.gpuInitialized,false);
 assert.deepEqual(raw.actualCalls,Object.fromEntries(['moduleForwardCalls','autogradCalls','optimizerConstructionAttempts','optimizerUpdates','cudaInitializationAttempts'].map(k=>[k,0])));
 for(const key of ['programBindings','configuration','runtimeIdentity']){assert.deepEqual(raw[key],plan[key]);assert.deepEqual(request[key],plan[key]);}
 assert.equal(Object.hasOwn(request,'modelBinding'),false,'CPU bootstrap must not import a reference identity');
 assert.equal(request.modelIdentityOutput,plan.outputRoot+'/model-identity.json');
 assert.equal(request.modelCapabilityVersion,MODEL_CAPABILITY);
 assert.equal(raw.modelBinding.path,request.modelIdentityOutput);binding(raw.modelBinding);
 if(plan.modelBinding)assert.deepEqual(raw.modelBinding,plan.modelBinding);
 validateModelIdentity(raw.initialModel);
 assert.equal(request.schema,'ecology-decode1-weight-quality-cpu-request-v1');assert.equal(request.runId,plan.runId);assert.equal(request.packageId,plan.packageId);
 assert.equal(request.outputRoot,plan.outputRoot+'/cpu-entry');assert.equal(raw.items.length,raw.passed);assert.ok(raw.items.every(x=>x.status==='passed'));
 return raw;
}
export function verifyFinalAcceptance(root,plan){
 const acceptance=json(root,plan.finalCpuAcceptance);assert.equal(acceptance.schema,'ecology-decode1-weight-quality-final-cpu-acceptance-v1');
 assert.equal(acceptance.status,'passed');assert.deepEqual(acceptance.programBindings,plan.programBindings);
 const raw=json(root,acceptance.report),request=json(root,raw.request);verifyCpuReport(raw,request,plan);
 assert.deepEqual(raw.initialModel,json(root,plan.modelBinding));
 const receipt=json(root,acceptance.ownedReceipt);assert.equal(receipt.phase,'cpu');assert.equal(receipt.cleanupConfirmed,true);
 assert.equal(receipt.processCleanupConfirmed,true);
 assert.equal(receipt.ownerClosed,true);assert.equal(receipt.proof.exitCode,0);assert.equal(receipt.proof.assignedBeforeResume,true);
 assert.equal(receipt.proof.killOnJobClose,true);assert.equal(receipt.proof.activeProcessesAfterCleanup,0);
 assert.equal(receipt.cpuNegativeInputs?.fixtureLinksRemoved,true);
 assert.equal(receipt.cpuNegativeInputs.linkMetadataReserveBytes,49152);assert.equal(receipt.cpuNegativeInputs.reserveIsMeasurement,false);
 assert.equal(receipt.cpuNegativeInputs.root,plan.outputRoot+'/cpu-negative-inputs');
 assert.equal(receipt.cpuNegativeInputs.declaration.path,receipt.cpuNegativeInputs.root+'/input-declaration.json');
 const declaration=json(root,receipt.cpuNegativeInputs.declaration);assert.deepEqual(declaration.request,raw.request);
 assert.deepEqual(declaration.programBindings,plan.programBindings);assert.equal(declaration.callIdentity,receipt.guard.identity);
 const base=plan.outputRoot+'/cpu-negative-inputs',expected=[{name:'reader',path:base+'/reader-link',target:base+'/reader-target'},
  {name:'snapshot',path:base+'/snapshot-link',target:base+'/snapshot-target'},{name:'program',path:base+'/program-project/scripts/lib',target:base+'/program-target'}];
 assert.equal(receipt.cpuNegativeInputs.links.length,3);
 for(const [i,link] of receipt.cpuNegativeInputs.links.entries()){assert.deepEqual({name:link.name,path:link.path,target:link.target},expected[i]);
  assert.equal(link.present,false);assert.match(link.observedIdentity,/^\d+:\d+$/u);
  assert.equal(fs.existsSync(inside(root,link.path)),false,'CPU fixture link remains');
  const observation=json(root,bind(root,plan.outputRoot+'/cpu-entry/negative-observation-'+link.name+'.json'));
  assert.equal(observation.callIdentity,receipt.guard.identity);assert.deepEqual(observation.request,raw.request);
  assert.deepEqual(observation.link,{...link,present:true});}
 assert.ok(Array.isArray(receipt.cpuNegativeInputs.directoryIdentities)&&receipt.cpuNegativeInputs.directoryIdentities.length>=8);
 for(const entry of receipt.cpuNegativeInputs.directoryIdentities){assert.ok(entry.path===base||entry.path.startsWith(base+'/'));
  const stat=fs.lstatSync(inside(root,entry.path),{bigint:true});assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());
  assert.equal(id(stat),entry.identity,'CPU input directory replaced after cleanup');}
 // Python independently verifies the exact command, native binaries and guard.
 return acceptance;
}
export function validatePreparationNamespace(bindingValue,request,expected){
 binding(bindingValue);assert.equal(bindingValue.path,expected.outputRoot+'/local-prepare/request.json');
 assert.equal(request.schema,'ai-painter-local-prepare-request-v1');
 assert.equal(request.protocol,'ai-painter-local-control-v2');
 assert.equal(request.capabilityVersion,CAPABILITY);assert.equal(request.candidateSelection,'ecology-decode1-quality-v1');
 for(const key of ['runId','packageId','outputRoot','programBindings','runtimeIdentity'])assert.deepEqual(request[key],expected[key]);
 assert.equal(request.requestId,expected.runId);assert.deepEqual(request.candidateBinding,CANDIDATE);
 assert.equal(request.executionPackage,null);assert.equal(request.automaticRetries,0);return request;
}
export function prepareCpuRequest({root,runId,packageId,preparationRequestBinding=null}){
 for(const id of [runId,packageId])assert.match(id,/^[a-z0-9][a-z0-9-]{7,127}$/u);assert.notEqual(runId,packageId);
 const candidate=json(root,CANDIDATE),outputRoot=OUTPUT_ROOT+'/'+runId;
 // The owned CPU harness constructs and validates the actual fresh new factory;
 // only that report may introduce the newly computed immutable model binding.
 const programBindings=finalProgramBindings(root),runtime=runtimeIdentity(root),directory=inside(root,outputRoot);
 if(fs.existsSync(directory)){
  assert.ok(preparationRequestBinding,'existing Run requires its exact registered preparation request');
  assert.deepEqual(fs.readdirSync(directory).sort(),['local-prepare'],'existing model/CPU/consumed namespace refused');
  validatePreparationNamespace(preparationRequestBinding,json(root,preparationRequestBinding),{outputRoot,runId,packageId,programBindings,runtimeIdentity:runtime});
 }else assert.equal(preparationRequestBinding,null,'missing preparation namespace cannot borrow a request');
 return write(root,outputRoot+'/cpu-request.json',{schema:'ecology-decode1-weight-quality-cpu-request-v1',runId,packageId,
  outputRoot:outputRoot+'/cpu-entry',configuration:deriveConfiguration(candidate),programBindings,
  modelIdentityOutput:outputRoot+'/model-identity.json',modelCapabilityVersion:MODEL_CAPABILITY,
  datasetManifest:candidate.frozenBindings.datasetManifest,trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
  formalSpecification:SPECIFICATION,sourceCandidate:CANDIDATE,runtimeIdentity:runtime});
}
export async function finalizeCpuAcceptance({root,requestBinding,result}){
 const {hasLiveOwnedProof,hasLiveCpuFixtureCleanup,withNativeOrdinaryBudget}=await import('./ai-painter-ecology-decode1-quality-owned-native-v1.mjs');
 assert.ok(hasLiveOwnedProof(result.ownedReceipt),'same live CPU call required');assert.equal(result.ownedReceipt.proof?.exitCode,0);
 assert.equal(result.ownedReceipt.phase,'cpu');
 assert.ok(hasLiveCpuFixtureCleanup(result.ownedReceipt),'same retained CPU call must confirm all fixture links removed');
 const request=json(root,requestBinding),reportBinding=JSON.parse(result.stdout),raw=json(root,reportBinding);
 assert.equal(reportBinding.path,request.outputRoot+'/cpu-report.json');assert.deepEqual(raw.request,requestBinding);
 const plan={...request,outputRoot:request.outputRoot.replace(/\/cpu-entry$/u,'')};verifyCpuReport(raw,request,plan);
 assert.deepEqual(raw.initialModel,validateModelIdentity(json(root,raw.modelBinding)));
 return withNativeOrdinaryBudget(root,result.ownedReceipt,()=>write(root,plan.outputRoot+'/cpu-acceptance.json',{
  schema:'ecology-decode1-weight-quality-final-cpu-acceptance-v1',status:'passed',programBindings:request.programBindings,
  report:reportBinding,ownedReceipt:result.receiptBinding}));
}
export function preparePlan({root,requestBinding,finalCpuAcceptance}){
 const request=json(root,requestBinding),outputRoot=request.outputRoot.replace(/\/cpu-entry$/u,'');
 const acceptance=json(root,finalCpuAcceptance),raw=json(root,acceptance.report);
 const plan={...Object.fromEntries(['runId','packageId','configuration','programBindings','datasetManifest','trainSplit','validationSplit','formalSpecification','sourceCandidate','runtimeIdentity'].map(k=>[k,request[k]])),modelBinding:raw.modelBinding,dataClosure:raw.dataClosure,
  schema:PLAN_SCHEMA,executionProfile:EXECUTION_PROFILE,executionMode:'bounded-quality-training',capabilityVersion:CAPABILITY,
  outputRoot,finalCpuAcceptance,historicalCheckpointMayInitialize:false,trainingRestartAllowed:false};
 validatePlan(root,plan);verifyFinalAcceptance(root,plan);return write(root,outputRoot+'/quality-plan.json',plan);
}
export function makeInternalCandidate(root,planBinding){
 const plan=validatePlan(root,json(root,planBinding));verifyFinalAcceptance(root,plan);
 return {schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:plan.packageId,capabilityVersion:CAPABILITY,
  ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:plan.outputRoot,
  programFiles:Object.fromEntries(Object.entries(plan.programBindings).map(([role,b])=>[role,b.path])),
  inputEvidencePaths:[planBinding.path,...[SPECIFICATION,CANDIDATE,FROZEN_PLAN,plan.modelBinding,
   plan.datasetManifest,plan.trainSplit,plan.validationSplit,plan.finalCpuAcceptance,plan.dataClosure].map(b=>b.path)].filter((v,i,a)=>a.indexOf(v)===i),
  phaseAdapters:Object.fromEntries(PHASES.map(exportName=>[exportName,{path:ADAPTER,exportName}]))};
}
export function loadContext(context){
 const root=context.projectRoot,plans=context.inputEvidence.filter(b=>b.path.endsWith('/quality-plan.json'));assert.equal(plans.length,1);
 const plan=validatePlan(root,json(root,plans[0]));verifyFinalAcceptance(root,plan);
 assert.equal(context.capabilityVersion,CAPABILITY);assert.equal(context.packageIdentity,plan.packageId);assert.equal(context.outputRoot,plan.outputRoot);
 const packageBinding=bind(root,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json'),spec=json(root,packageBinding);
 assert.equal(spec.schemaVersion,'ai-painter-autonomous-closed-loop-package-v1');assert.equal(spec.maxInfrastructureRecoveryAttempts,0);
 assert.equal(spec.ownerAuthorizationRequired,false);assert.equal(spec.ownerInStateMachine,false);assert.deepEqual(spec.inputEvidence,context.inputEvidence);
 assert.deepEqual(spec.programLineage,Object.fromEntries(Object.entries(plan.programBindings).map(([k,b])=>[k,b.sha256])));
 assert.deepEqual(Object.keys(spec.phaseAdapters).sort(),[...PHASES].sort());
 for(const phase of PHASES)assert.deepEqual(spec.phaseAdapters[phase],{kind:'project_module_export',path:ADAPTER,sha256:plan.programBindings.adapter.sha256,exportName:phase});
 for(const b of spec.inputEvidence)read(root,b);
 return {root,plan,packageBinding,spec,planBinding:plans[0],input:{plan,planBinding:plans[0],packageBinding,modelBinding:plan.modelBinding,modelIdentity:json(root,plan.modelBinding)}};
}
