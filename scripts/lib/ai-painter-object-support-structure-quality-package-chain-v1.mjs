// OSS-BIND-01-JS: independent support-structure candidate; shared bounded IO.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {localPreparationRoute} from './ai-painter-local-prepare-v1.mjs';
import {projectRoot,physicalRuntimeRoot} from './ai-pet-world-storage.mjs';
import * as io from './ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';
import {CAPABILITY,MODEL_CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,EXECUTION_POLICY,CANDIDATE,FROZEN_PLAN,
 binding,deriveConfiguration,validate,validateModelIdentity,validateTerminal,validateCompleted,
 LOSS,GRADIENT,INTEGRATION_POLICY,CPU_BASELINE_SPECIFICATION,PREVIOUS_EXECUTION_POLICY,
 FINAL_RGB_CAPABILITY,FINAL_RGB_PROFILE,JOINT_CAPABILITY,JOINT_PROFILE,JOINT_PROGRESS_PUBLICATION_POLICY,isActualClosureRoute,gpuAdmissionSeconds,sourceFileCountMaximum,executionRoute} from './ai-painter-object-support-structure-quality-registration-v1.mjs';
export {CAPABILITY,MODEL_CAPABILITY,PLAN_SCHEMA,EXECUTION_PROFILE,OUTPUT_ROOT,SPECIFICATION,EXECUTION_POLICY,CANDIDATE,FROZEN_PLAN,deriveConfiguration,validateTerminal,validateCompleted};
export const ADAPTER='scripts/run-ai-painter-object-support-structure-quality-v1.mjs';
export {FINAL_RGB_CAPABILITY,FINAL_RGB_PROFILE,JOINT_CAPABILITY,JOINT_PROFILE,gpuAdmissionSeconds,sourceFileCountMaximum,executionRoute};
import {JOINT_COMPONENTS,verifyJointAuthority,jointHistoryBindings,jointProvenance} from './ai-painter-joint-object-priority-quality-package-chain-v1.mjs';
const requireSource=createRequire(import.meta.url);
export const sha=io.sha,withOutputBudget=io.withOutputBudget,directoryBytes=io.directoryBytes;
export const ROLES={adapter:ADAPTER,packageChain:'scripts/lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs',
 frozenProjectManifest:'.runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-package.json',
 currentLegacyNativeTests:'scripts/tests/ai-painter-ecology-owned-native.test.mjs',
 currentExecutionRegistry:'src/server/ai-painter-current-execution-registry.mjs',
 worker:'ml/ai-painter/scripts/painter_stage4_object_support_structure_quality_worker_v1.py',
 gpuQualifier:'ml/ai-painter/scripts/qualify_stage4_object_support_structure_quality_gpu_v1.py',
 executionAuth:'ml/ai-painter/scripts/object_support_structure_quality_auth_v1.py',
 registration:'scripts/lib/ai-painter-object-support-structure-quality-registration-v1.mjs',
 nativeRunner:'scripts/lib/ai-painter-object-support-structure-quality-owned-native-v1.mjs',
 nativeOwnerBuilder:'scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs',
 nativeOwnerSource:'scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs',
 nativeStreamTests:'scripts/tests/ai-painter-owned-worker-stream-v2.test.mjs',
 cpuHarness:'ml/ai-painter/tests/test_object_support_structure_execution_cpu_v1.py',
 entryTests:'scripts/tests/ai-painter-object-support-structure-quality-entry.test.mjs',
 capture:'ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py',
 captureTests:'ml/ai-painter/tests/test_ecology_regime_gradient_failure_capture_cpu.py',
 loop:'ml/ai-painter/scripts/painter_stage4_object_support_structure_lifecycle_v1.py',
 loopTests:'ml/ai-painter/tests/test_object_support_structure_lifecycle_cpu_v1.py',
 trainingProfile:'ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_v1.py',
 managedCheckpoint:'ml/ai-painter/src/ai_painter/complete_world/object_support_structure_checkpoint_v1.py',
 ranking:'ml/ai-painter/scripts/ecology_quality_ranking_v1.py',
 checkpointTests:'ml/ai-painter/tests/test_object_support_structure_lifecycle_cpu_v1.py',
 decode1Model:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_precision_v1.py',
 decode1Operator:'ml/ai-painter/src/ai_painter/complete_world/decode1_weight_reduction_precision_v1.py',
 decode1Bridge:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_terrain_detail_weight_priority_update_v1.py',
 decode1CoreTests:'ml/ai-painter/tests/test_ecology_terrain_detail_precision_cpu.py',
 reviewWorker:'ml/ai-painter/scripts/review_stage4_object_support_structure_quality_cpu_v1.py',
 reviewDriver:'scripts/run-ai-painter-object-support-structure-quality-review-v1.mjs',
 reviewRecovery:'scripts/lib/ai-painter-ecology-terrain-detail-review-recovery-v1.mjs',
 reviewTests:'ml/ai-painter/tests/test_object_support_structure_execution_cpu_v1.py',
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
 exactlyOnceSpawn:'scripts/lib/ai-painter-exactly-once-background-spawn-v1.mjs',
 executionPolicy:EXECUTION_POLICY.path,
 terrainDetailOperator:'ml/ai-painter/src/ai_painter/complete_world/terrain_detail_weight_reduction_precision_v1.py',
 parentDecode1Model:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_precision_v1.py',
 parentDecode1Bridge:'ml/ai-painter/src/ai_painter/complete_world/object_ecology_decode1_weight_priority_update_v1.py'};
// Explicit shared imports and frozen CPU references remain in this closure.
// The legacy specification is configuration/history only, never execution authority.
export const SUPPORT_DEPENDENCY_ROLES=Object.freeze({
 "packageTests": "scripts/tests/ai-painter-object-support-structure-quality-package.test.mjs",
 "supportLoss": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_support_structure_candidate_cpu_v1.py",
 "supportDeviceLoss": "ml/ai-painter/src/ai_painter/complete_world/native_rgb_object_support_structure_device_v1.py",
 "supportCpuBridge": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_cpu_v1.py",
 "supportDeviceBridge": "ml/ai-painter/src/ai_painter/complete_world/object_support_structure_priority_update_device_v1.py",
 "supportCpuProfile": "ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_cpu_v1.py",
 "supportLossPolicy": "data/ai-painter/system-governance/ai-painter-object-support-structure-cpu-policy-v1.json",
 "supportGradientPolicy": "data/ai-painter/system-governance/ai-painter-object-support-structure-integration-cpu-policy-v1.json",
 "supportLifecyclePolicy": "data/ai-painter/system-governance/ai-painter-object-support-structure-lifecycle-integration-policy-v1.json",
 "supportLossTests": "ml/ai-painter/tests/test_native_rgb_object_support_structure_candidate_cpu_v1.py",
 "supportCpuBridgeTests": "ml/ai-painter/tests/test_object_support_structure_integration_cpu_v1.py",
 "supportDeviceTests": "ml/ai-painter/tests/test_object_support_structure_device_integration_cpu_v1.py",
 "legacyConfigurationSpecification": "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.69-792bf647.txt",
 "sharedQualityChain": "scripts/lib/ai-painter-ecology-terrain-detail-quality-package-chain-v1.mjs",
 "sharedQualityNative": "scripts/lib/ai-painter-ecology-terrain-detail-quality-owned-native-v1.mjs",
 "sharedQualityRegistration": "scripts/lib/ai-painter-ecology-terrain-detail-quality-registration-v1.mjs",
 "sharedQualityReviewDriver": "scripts/run-ai-painter-ecology-terrain-detail-quality-review-v1.mjs",
 "sharedQualityLifecycle": "ml/ai-painter/scripts/painter_stage4_ecology_terrain_detail_weight_quality_lifecycle_v1.py",
 "sharedQualityProfile": "ml/ai-painter/scripts/painter_stage4_ecology_terrain_detail_weight_training_profile_v1.py",
 "sharedQualityCheckpoint": "ml/ai-painter/src/ai_painter/complete_world/ecology_terrain_detail_weight_checkpoint_v1.py",
 "sharedQualityCapture": "ml/ai-painter/src/ai_painter/complete_world/ecology_regime_gradient_failure_capture.py",
 "sharedQualityAuth": "ml/ai-painter/scripts/ecology_terrain_detail_weight_quality_auth_v1.py",
 "sharedQualityCpuHarness": "ml/ai-painter/tests/test_ecology_terrain_detail_weight_quality_execution_cpu.py",
 "sharedQualityEntryTests": "scripts/tests/ai-painter-ecology-terrain-detail-quality-entry.test.mjs",
 "consoleTrainingPresentation": "src/server/ai-console/bound-training-presentation.mjs",
 "consoleTrainingHistoryAdapters": "src/server/ai-console/training-history-detail-adapters.mjs",
 "registeredEntrypoints": "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json"
});
// Additional v2 entry dependencies, not historical model-source roles.
export const LOCAL_DEPLOYMENT_DEPENDENCY_ROLES=Object.freeze({
 localOperatorDeploymentManifest:'node_modules/@next/env/package.json',
 localOperatorDeploymentLoader:'node_modules/@next/env/dist/index.js'});
export function requiredProgramRoles(root,capabilityVersion=CAPABILITY){
 executionRoute(capabilityVersion);
 if(capabilityVersion===CAPABILITY)return {...ROLES,...LOCAL_DEPLOYMENT_DEPENDENCY_ROLES};
 return requireSource('./ai-painter-execution-source-closure-v1.mjs').requiredProgramRoles({root,
  python:runtimeIdentity(root).python.absolutePath,capabilityVersion,authPath:ROLES.executionAuth});
}
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
export const ORIGINAL_NATIVE_TESTS={path:'.runtime/ai-painter/ecology-quality-v1-repair/t-qv12-r1/ns003-original-native-tests.mjs',sha256:'f5c0a559f5cd1fa915dc0ec4c456bbf58c8edd298596e1a5bd5e6cdf9f93b73b'};
// Exact pre-repair bytes preserve historical source-19; the live writer is an
// independent current role, never inferred from this historical snapshot.
export const ORIGINAL_REGISTRY={path:'.runtime/ai-painter/controller-parallel-20261011/controller-27-next-20261013/interrupted-training-20261013/inputs/original-registry.mjs',sha256:'159d8d7b4e0d425271b0181aba4732e6b2c20efc4211e69583701e124adf488d'};
export function historicalSourceBinding(role,sourceBinding){
 if(role!=='source-19')return historicalNativeTestBinding(role,sourceBinding);
 assert.deepEqual(sourceBinding,{path:ROLES.currentExecutionRegistry,sha256:ORIGINAL_REGISTRY.sha256},'exact historical registry source required');
 return ORIGINAL_REGISTRY;
}
export function verifyHistoricalProgramBindings(frozen,programs,currentManifest){
 assert.equal(Object.keys(frozen).length,179,'exact historical source count required');
 for(const [role,b]of Object.entries(frozen))assert.deepEqual(programs['frozen-'+role],
  role==='source-137'?currentManifest:historicalSourceBinding(role,b),'old role omitted/changed');
 return true;
}
export function historicalNativeTestBinding(role,binding){
 if(!['source-151','nativeTests'].includes(role))return binding;
 assert.deepEqual(binding,{path:ROLES.currentLegacyNativeTests,sha256:ORIGINAL_NATIVE_TESTS.sha256},'exact historical native test role required');
 return ORIGINAL_NATIVE_TESTS;
}
export function verifyNativeTestRename(original,current){
 const baseline=Buffer.from(original).toString('utf8').replaceAll('\r\n','\n'),updated=Buffer.from(current).toString('utf8').replaceAll('\r\n','\n');
 assert.equal((baseline.match(/\bmodule\b/gu)??[]).length,4,'exact four legacy test identifiers required');
 assert.equal(updated,baseline.replace(/\bmodule\b/gu,'nativeModule'),'native test change beyond identifier rename');return true;
}
export function finalProgramBindings(root,{capabilityVersion=CAPABILITY}={}){
 if(isActualClosureRoute(capabilityVersion))return finalRgbProgramBindings(root,capabilityVersion);
 executionRoute(capabilityVersion);
 const frozen=json(root,FROZEN_PLAN).programBindings;assert.equal(Object.keys(frozen).length,179);
 const manifest=currentProjectManifestBinding(root,frozen);
 const programs=Object.fromEntries(Object.entries(frozen).map(([role,b])=>{if(role==='source-137')return ['frozen-'+role,manifest];const historical=historicalSourceBinding(role,b);read(root,historical);return ['frozen-'+role,historical]}));
 verifyNativeTestRename(read(root,ORIGINAL_NATIVE_TESTS),read(root,bind(root,ROLES.currentLegacyNativeTests)));
 for(const [role,p]of Object.entries(ROLES))programs[role]=bind(root,p);
 // Existing closed-loop/materializer code is already bound as frozen source
 // 153/155. Avoid redundant role aliases while retaining both exact sources.
 assert.equal(programs['frozen-source-153'].path,'scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs');
 assert.equal(programs['frozen-source-155'].path,'scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs');
 for(const [role,p]of Object.entries({...LOCAL_DEPLOYMENT_DEPENDENCY_ROLES,...SUPPORT_DEPENDENCY_ROLES}))programs[role]=bind(root,p);
 assert.deepEqual(programs.frozenProjectManifest,{path:ROLES.frozenProjectManifest,sha256:frozen['source-137'].sha256},'original manifest changed during collection');
 verifyProgramBindingAliases(programs);
 let bytes=0;const seen=new Map();
 for(const b of Object.values(programs)){const raw=read(root,b);assert.ok(raw.length<=1048576,'source file ceiling');
  if(seen.has(b.path))assert.equal(seen.get(b.path),b.sha256);else{seen.set(b.path,b.sha256);bytes+=raw.length;}
  assert.ok(bytes<=16777216,'unique source closure ceiling');}
 return programs;
}
export function verifyProgramBindingAliases(programs,{capabilityVersion=CAPABILITY}={}){
 assert.ok(programs&&typeof programs==='object'&&!Array.isArray(programs),'program bindings required');
 assert.ok(Object.keys(programs).length>=(isActualClosureRoute(capabilityVersion)?1:179)&&Object.keys(programs).length<=sourceFileCountMaximum(capabilityVersion),'source role ceiling');
 const paths=new Map();
 for(const [role,b]of Object.entries(programs)){
  assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);
  assert.ok(!['__proto__','constructor','prototype'].includes(role),'unsafe source role');binding(b);
  if(paths.has(b.path)){assert.equal(paths.get(b.path),b.sha256,'source alias conflict');assert.equal(isActualClosureRoute(capabilityVersion),false,'new closure requires one binding per path');}
  paths.set(b.path,b.sha256);
 }
 return {roles:Object.keys(programs).length,uniquePaths:paths.size};
}
export function verifyProjectManifestTransition(original,current){
 assert.ok(original&&current&&original.scripts&&current.scripts,'manifest/scripts required');
 const additions={
  'control:ai-painter-ecology-decode1-quality':'node scripts/run-ai-painter-ecology-decode1-quality-v1.mjs',
  'control:ai-painter-ecology-terrain-detail-quality':'node scripts/run-ai-painter-ecology-terrain-detail-quality-v1.mjs',
  'control:ai-painter-object-support-structure-quality':'node scripts/run-ai-painter-object-support-structure-quality-v1.mjs'};
 const remaining=structuredClone(current);
 for(const [alias,command]of Object.entries(additions)){
  assert.equal(Object.hasOwn(original.scripts,alias),false,'historical manifest already has new alias');
  assert.equal(current.scripts[alias],command,'exact registered control alias required: '+alias);
  delete remaining.scripts[alias];
 }
 assert.deepEqual(remaining,original,'other manifest change refused');return true;
}
function currentProjectManifestBinding(root,frozen){
 const original=frozen['source-137'];assert.equal(original?.path,'package.json','exact historical source137 manifest required');
 const historical={path:ROLES.frozenProjectManifest,sha256:original.sha256},baseline=json(root,historical),current=bind(root,'package.json');
 verifyProjectManifestTransition(baseline,json(root,current));return current;
}
export function verifyLocalDeploymentDependencyClosure(root,programs){
 assert.ok(programs&&typeof programs==='object'&&!Array.isArray(programs),'deployment source closure required');
 for(const [role,p]of Object.entries({...LOCAL_DEPLOYMENT_DEPENDENCY_ROLES,...SUPPORT_DEPENDENCY_ROLES})){
  assert.equal(programs[role]?.path,p,'deployment source role omitted/retargeted: '+role);
  read(root,programs[role]);
 }
 return {dependenciesVerified:Object.keys({...LOCAL_DEPLOYMENT_DEPENDENCY_ROLES,...SUPPORT_DEPENDENCY_ROLES}).length};
}
export function validatePlan(root,plan){
 if(isActualClosureRoute(plan.capabilityVersion))return validateFinalRgbPlan(root,plan);
 assert.equal(Object.hasOwn(plan,'resourceSuccessor'),false,'caller resource successor prohibited');
 assert.deepEqual(plan.configuration,deriveConfiguration(json(root,CANDIDATE)));
 verifyExecutionPolicy(root,plan.configuration);
 const model=validateModelIdentity(json(root,plan.modelBinding));
 const input={plan,planBinding:{path:plan.outputRoot+'/quality-plan.json',sha256:sha(JSON.stringify(plan))},
  packageBinding:{path:'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',sha256:sha('shape-only')},modelBinding:plan.modelBinding,modelIdentity:model};validate(input);
 assert.ok(read(root,SPECIFICATION).includes(Buffer.from('AI-PAINTER-SPEC-1.72')));
 assert.ok(read(root,SPECIFICATION).includes(Buffer.from('17.1')));
 const frozen=json(root,FROZEN_PLAN).programBindings;assert.equal(Object.keys(frozen).length,179);
 const currentManifest=currentProjectManifestBinding(root,frozen);
 verifyHistoricalProgramBindings(frozen,plan.programBindings,currentManifest);
 verifyNativeTestRename(read(root,ORIGINAL_NATIVE_TESTS),read(root,plan.programBindings.currentLegacyNativeTests));
 assert.deepEqual(plan.programBindings.frozenProjectManifest,{path:ROLES.frozenProjectManifest,sha256:frozen['source-137'].sha256},'historical manifest must retain original bytes');
 for(const [role,p]of Object.entries(ROLES))assert.equal(plan.programBindings[role]?.path,p);
 verifyLocalDeploymentDependencyClosure(root,plan.programBindings);
 const seen=new Map();let bytes=0;for(const b of Object.values(plan.programBindings)){const raw=read(root,b);assert.ok(raw.length<=1048576);if(!seen.has(b.path))bytes+=raw.length;else assert.equal(seen.get(b.path),b.sha256);seen.set(b.path,b.sha256);assert.ok(bytes<=16777216);}
 assert.deepEqual(plan.programBindings,finalProgramBindings(root),'exact current source closure required');
 const candidate=json(root,CANDIDATE);for(const key of ['datasetManifest','trainSplit','validationSplit'])assert.deepEqual(plan[key],candidate.frozenBindings[key]);
 return plan;
}
export const PRIOR_SUPPORT_CPU_ACCEPTANCE=Object.freeze({
 path:'.runtime/ai-painter/controller-repair-reviews/fix-a69-20261014/object-support-device-lifecycle-acceptance-v1.json',
 sha256:'9d693f0700ba9d2f445b01ea362894f030f2314852c039df9b80878a7d787ec4'});
export function verifySupportStructurePriorCpuEvidence(root){
 const prior=json(root,PRIOR_SUPPORT_CPU_ACCEPTANCE);
 assert.equal(prior.schemaVersion,'object-support-device-lifecycle-acceptance-v1');
 assert.equal(prior.status,'inactive_device_and_lifecycle_cpu_integration_completed');
 assert.equal(prior.capabilityVersion,CAPABILITY);assert.equal(prior.modelCapabilityVersion,MODEL_CAPABILITY);
 const summary=prior.testSummary;
 for(const key of ['passed','run','expected'])assert.equal(summary[key],90);
 for(const key of ['failures','errors','skipped'])assert.equal(summary[key],0);
 assert.equal(summary.success,true);assert.equal(summary.cudaInitialized,false);
 assert.equal(summary.cpuThreads,2);assert.equal(summary.interopThreads,2);
 assert.deepEqual(summary.guardedCalls,{cudaInitializationAttempts:0,realOptimizerConstruction:0,
  productionCheckpointLoads:0,realGeneratorForwards:0,imageDecodes:0,checkpointFileWrites:0});
 for(const flag of ['realGpuExecuted','realDataDecoded','realModelForwardExecuted','trainingStarted',
  'gpuQualified','visualQualified','formalStage4Qualified','runtimePublicationGranted'])assert.equal(prior[flag],false);
 assert.ok(Array.isArray(prior.sourceBindings)&&prior.sourceBindings.length===8,'exact prior eight-source CPU evidence');
 const expected=new Set([SUPPORT_DEPENDENCY_ROLES.supportLifecyclePolicy,SUPPORT_DEPENDENCY_ROLES.supportDeviceLoss,
  SUPPORT_DEPENDENCY_ROLES.supportDeviceBridge,ROLES.trainingProfile,ROLES.managedCheckpoint,ROLES.loop,
  SUPPORT_DEPENDENCY_ROLES.supportDeviceTests,ROLES.loopTests]);
 assert.deepEqual(new Set(prior.sourceBindings.map(b=>b.path)),expected);
 for(const b of prior.sourceBindings)read(root,b);
 assert.equal(prior.policy.path,SUPPORT_DEPENDENCY_ROLES.supportLifecyclePolicy);read(root,prior.policy);
 const tests=json(root,prior.tests);assert.ok(tests&&typeof tests==='object','bound CPU test evidence required');
 read(root,prior.priorRealCpuEvidence);
 return prior;
}
export function verifyExecutionPolicy(root,configuration){
 const policy=json(root,EXECUTION_POLICY);
 assert.equal(policy.schemaVersion,'ai-painter-object-support-structure-quality-execution-policy-v3');
 assert.equal(policy.status,'registered_bounded_candidate_route_not_qualified');
 assert.equal(policy.candidate,CAPABILITY);assert.equal(policy.modelCapability,MODEL_CAPABILITY);
 assert.equal(policy.executionProfile,EXECUTION_PROFILE);assert.equal(policy.entrypointPath,ADAPTER);
 assert.deepEqual({path:policy.formalSpecification.path,sha256:policy.formalSpecification.sha256},SPECIFICATION);
 const formal=read(root,SPECIFICATION);
 assert.ok(formal.includes(Buffer.from('AI-PAINTER-SPEC-1.72'))&&formal.includes(Buffer.from(EXECUTION_POLICY.path.split('/').at(-1))),
  'current execution specification required; historical CPU template is not admission');
 assert.deepEqual(policy.sourceCandidate,CANDIDATE);assert.deepEqual(policy.executionCeiling,configuration.executionCeiling);
 assert.deepEqual(policy.dataUse,configuration.dataUse);assert.deepEqual(policy.optimizer,configuration.optimizer);
 assert.deepEqual(policy.scope,configuration.scope && Object.fromEntries(Object.keys(policy.scope).map(k=>[k,configuration.scope[k]])));
 assert.equal(policy.gpuAdmission.sampleCount,48);assert.equal(policy.gpuAdmission.sampleSplit,'train');
 assert.equal(policy.gpuAdmission.optimizerUpdates,0);assert.equal(policy.gpuAdmission.optimizerConstruction,0);
 assert.equal(policy.gpuAdmission.generatorForwardsPerSample,1);
 assert.equal(policy.gpuAdmission.generatorAutogradPerSample,5);assert.equal(policy.gpuAdmission.discriminatorAutogradPerSample,1);
 assert.equal(policy.gpuAdmission.totalGeneratorAutograd,240);assert.equal(policy.gpuAdmission.totalDiscriminatorAutograd,48);
 assert.equal(policy.phaseResources.gpuAdmissionSeconds,configuration.gpuAdmissionSeconds);
 assert.equal(policy.phaseResources.cpuPreparationSeconds,240);assert.equal(policy.phaseResources.reviewSeconds,120);
 assert.deepEqual(policy.phaseResources,{cpuPreparationSeconds:240,gpuAdmissionSeconds:600,reviewSeconds:120,
  maxStreamBytes:8388608,cpuOutputBytes:8388608,qualificationAndReviewOutputBytes:16777216,
  captureMiB:64,captureMetadataReserveBytes:1048576,terminalReserveBytes:65536,
  programFileCountMaximum:256,programFileBytesMaximum:1048576,totalProgramBytesMaximum:16777216});
 assert.equal(policy.modelBoundary.changedTargetIndex,60);assert.equal(policy.modelBoundary.parameterCount,108);
 assert.equal(policy.modelBoundary.changedTargetName,'core.core.terrain.full_resolution_detail.layers.3.weight');
 assert.equal(policy.modelBoundary.parameterElements,2242687);assert.deepEqual(policy.modelBoundary.targetShape,[48,48,3,3]);
 assert.equal(policy.modelBoundary.freshInitializationOnly,true);assert.equal(policy.modelBoundary.failedStateMayInitialize,false);
 assert.equal(policy.modelBoundary.historicalCheckpointMayInitialize,false);assert.equal(policy.modelBoundary.otherLayersMayChange,false);
 assert.deepEqual(policy.lossDefinition,LOSS);assert.deepEqual(configuration.lossDefinition,LOSS);read(root,LOSS);
 assert.deepEqual(policy.gradientDefinition,GRADIENT);assert.deepEqual(configuration.gradientDefinition,GRADIENT);read(root,GRADIENT);
 assert.deepEqual(policy.integrationPolicy,INTEGRATION_POLICY);assert.deepEqual(configuration.integrationPolicy,INTEGRATION_POLICY);read(root,INTEGRATION_POLICY);
 assert.deepEqual(policy.priorCpuEvidence.originalNormativeBytes,CPU_BASELINE_SPECIFICATION);
 assert.ok(read(root,CPU_BASELINE_SPECIFICATION).includes(Buffer.from('AI-PAINTER-SPEC-1.69')));
 assert.equal(policy.priorCpuEvidence.normativeVersion,'AI-PAINTER-SPEC-1.69');
 assert.equal(policy.priorCpuEvidence.oldAttemptReplayAllowed,false);
 assert.equal(policy.priorCpuEvidence.grantsGpuOrTrainingQualification,false);
 assert.deepEqual(policy.priorCpuEvidence.integrationAcceptance,PRIOR_SUPPORT_CPU_ACCEPTANCE);
 const prior=verifySupportStructurePriorCpuEvidence(root);
 assert.deepEqual(policy.priorCpuEvidence.acceptance,prior.priorRealCpuEvidence);
 assert.deepEqual(policy.checkpointIdentity,{schema:'object-support-structure-quality-checkpoint-v1',
  configurationSchema:'object-support-structure-quality-configuration-v1',implementation:ROLES.managedCheckpoint,historicalMetadataRenamingAllowed:false});
 assert.deepEqual(policy.failureCapture,{gradientLabels:['actualTotal','structuredObjective','wholeFrameFidelity','objectCoreRgb','objectSupportStructure'],
  maxEpoch:24,maxGeneratorOptimizerSteps:1152,maxDiscriminatorOptimizerSteps:1152,maxCaptureBytes:67108864,retainPrimaryError:true});
 assert.equal(Object.hasOwn(policy,'currentExternalWorkBoundary'),false,'temporary external scope must not become local lifecycle policy');
 assert.deepEqual(policy.lifecycleBoundary,{"managedCpuPreparation":true,"samePackageGpuAdmission":true,"boundedTrainingAfterSamePackageGpuAdmission":true,"productionRegistryWrite":true,"oldEvidenceMutation":false,"qualificationOnlyStopsBeforeTraining":true,"cpuPreparationValidationLoaderReadOnly":{"split":"validation","exactSampleCount":8,"originalRgbAndConditionsOnly":true,"trainImageRead":false,"challengeImageRead":false,"regressionImageRead":false,"sourceMutation":false,"autograd":false,"checkpointSelection":false}});
 assert.deepEqual(policy.previousExecutionPolicy,PREVIOUS_EXECUTION_POLICY);read(root,PREVIOUS_EXECUTION_POLICY);
 assert.equal(policy.outputRoot,OUTPUT_ROOT);
 assert.equal(policy.sourceAssetsUse,'data_review_and_base_schedule_only_not_execution_qualification');
 assert.equal(configuration.sourceAssetsUse,policy.sourceAssetsUse);assert.deepEqual(configuration.sourceAssetsCandidate,CANDIDATE);
 assert.equal(Object.hasOwn(configuration,'sourceCandidate'),false,'configuration is an asset template, not old execution permission');
 return policy;
}
export function verifyCpuReport(raw,request,plan){
 const {MODEL_CAPABILITY}=executionRoute(plan.capabilityVersion??request.configuration?.capabilityVersion??CAPABILITY);
 assert.equal(raw.schema,'object-support-structure-quality-entry-cpu-report-v1');assert.equal(raw.status,'passed');
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
 assert.equal(request.schema,'object-support-structure-quality-cpu-request-v1');assert.equal(request.runId,plan.runId);assert.equal(request.packageId,plan.packageId);
 assert.equal(request.outputRoot,plan.outputRoot+'/cpu-entry');assert.equal(raw.items.length,raw.passed);assert.ok(raw.items.every(x=>x.status==='passed'));
 return raw;
}
export function verifyFinalAcceptance(root,plan){
 const acceptance=json(root,plan.finalCpuAcceptance);assert.equal(acceptance.schema,'object-support-structure-quality-final-cpu-acceptance-v1');
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
 const route=executionRoute(request.capabilityVersion);
 assert.equal(request.candidateSelection,isActualClosureRoute(route.CAPABILITY)?route.candidateSelection:'object-support-structure-quality-v1');
 assert.equal(expected.outputRoot,route.OUTPUT_ROOT+'/'+expected.runId);
 for(const key of ['runId','packageId','outputRoot','programBindings','runtimeIdentity'])assert.deepEqual(request[key],expected[key]);
 assert.equal(request.requestId,expected.runId);assert.deepEqual(request.candidateBinding,CANDIDATE);
 assert.equal(request.executionPackage,null);assert.equal(request.automaticRetries,0);return request;
}
export function prepareCpuRequest({root,runId,packageId,preparationRequestBinding=null,capabilityVersion=CAPABILITY}){
 if(isActualClosureRoute(capabilityVersion))return prepareFinalRgbCpuRequest({root,runId,packageId,preparationRequestBinding,capabilityVersion});
 executionRoute(capabilityVersion);
 for(const id of [runId,packageId])assert.match(id,/^[a-z0-9][a-z0-9-]{7,127}$/u);assert.notEqual(runId,packageId);
 const candidate=json(root,CANDIDATE),outputRoot=OUTPUT_ROOT+'/'+runId,configuration=deriveConfiguration(candidate);
 verifyExecutionPolicy(root,configuration);
 // The owned CPU harness constructs and validates the actual fresh new factory;
 // only that report may introduce the newly computed immutable model binding.
 const programBindings=finalProgramBindings(root),runtime=runtimeIdentity(root),directory=inside(root,outputRoot);
 if(fs.existsSync(directory)){
  assert.ok(preparationRequestBinding,'existing Run requires its exact registered preparation request');
  assert.deepEqual(fs.readdirSync(directory).sort(),['local-prepare'],'existing model/CPU/consumed namespace refused');
  validatePreparationNamespace(preparationRequestBinding,json(root,preparationRequestBinding),{outputRoot,runId,packageId,programBindings,runtimeIdentity:runtime});
 }else assert.equal(preparationRequestBinding,null,'missing preparation namespace cannot borrow a request');
 return write(root,outputRoot+'/cpu-request.json',{schema:'object-support-structure-quality-cpu-request-v1',runId,packageId,
  outputRoot:outputRoot+'/cpu-entry',configuration,programBindings,
  modelIdentityOutput:outputRoot+'/model-identity.json',modelCapabilityVersion:MODEL_CAPABILITY,
  datasetManifest:candidate.frozenBindings.datasetManifest,trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
  formalSpecification:SPECIFICATION,sourceCandidate:CANDIDATE,runtimeIdentity:runtime});
}
export async function finalizeCpuAcceptance({root,requestBinding,result}){
 const {hasLiveOwnedProof,hasLiveCpuFixtureCleanup,withNativeOrdinaryBudget}=await import('./ai-painter-object-support-structure-quality-owned-native-v1.mjs');
 assert.ok(hasLiveOwnedProof(result.ownedReceipt),'same live CPU call required');assert.equal(result.ownedReceipt.proof?.exitCode,0);
 assert.equal(result.ownedReceipt.phase,'cpu');
 assert.ok(hasLiveCpuFixtureCleanup(result.ownedReceipt),'same retained CPU call must confirm all fixture links removed');
 const request=json(root,requestBinding),reportBinding=JSON.parse(result.stdout),raw=json(root,reportBinding);
 assert.equal(reportBinding.path,request.outputRoot+'/cpu-report.json');assert.deepEqual(raw.request,requestBinding);
 const plan={...request,outputRoot:request.outputRoot.replace(/\/cpu-entry$/u,'')};verifyCpuReport(raw,request,plan);
 assert.deepEqual(raw.initialModel,validateModelIdentity(json(root,raw.modelBinding)));
 return withNativeOrdinaryBudget(root,result.ownedReceipt,()=>write(root,plan.outputRoot+'/cpu-acceptance.json',{
  schema:'object-support-structure-quality-final-cpu-acceptance-v1',status:'passed',programBindings:request.programBindings,
  report:reportBinding,ownedReceipt:result.receiptBinding}));
}
export function preparePlan({root,requestBinding,finalCpuAcceptance}){
 const request=json(root,requestBinding),outputRoot=request.outputRoot.replace(/\/cpu-entry$/u,'');
 const acceptance=json(root,finalCpuAcceptance),raw=json(root,acceptance.report);
 const plan={...Object.fromEntries(['runId','packageId','configuration','programBindings','datasetManifest','trainSplit','validationSplit','formalSpecification','sourceCandidate','runtimeIdentity'].map(k=>[k,request[k]])),modelBinding:raw.modelBinding,dataClosure:raw.dataClosure,
   schema:PLAN_SCHEMA,executionProfile:executionRoute(request.configuration.capabilityVersion).EXECUTION_PROFILE,executionMode:'bounded-quality-training',capabilityVersion:request.configuration.capabilityVersion,
  outputRoot,finalCpuAcceptance,historicalCheckpointMayInitialize:false,trainingRestartAllowed:false};
 if(isActualClosureRoute(plan.capabilityVersion)){
  plan.executionPolicy={...executionRoute(plan.capabilityVersion).EXECUTION_POLICY};
  plan.trainingPreviewPolicy=request.configuration.trainingPreviewPolicy;plan.historicalProvenance=request.historicalProvenance;
 }
 validatePlan(root,plan);verifyFinalAcceptance(root,plan);return write(root,outputRoot+'/quality-plan.json',plan);
}
export function makeInternalCandidate(root,planBinding){
 const plan=validatePlan(root,json(root,planBinding));verifyFinalAcceptance(root,plan);
 if(isActualClosureRoute(plan.capabilityVersion))return finalRgbInternalCandidate(root,planBinding,plan);
 return {schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:plan.packageId,capabilityVersion:CAPABILITY,
  ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:plan.outputRoot,
  programFiles:Object.fromEntries(Object.entries(plan.programBindings).map(([role,b])=>[role,b.path])),
  inputEvidencePaths:[planBinding.path,...[SPECIFICATION,EXECUTION_POLICY,PREVIOUS_EXECUTION_POLICY,CPU_BASELINE_SPECIFICATION,LOSS,GRADIENT,INTEGRATION_POLICY,CANDIDATE,FROZEN_PLAN,plan.modelBinding,
   plan.datasetManifest,plan.trainSplit,plan.validationSplit,plan.finalCpuAcceptance,plan.dataClosure].map(b=>b.path)].filter((v,i,a)=>a.indexOf(v)===i),
  phaseAdapters:Object.fromEntries(PHASES.map(exportName=>[exportName,{path:ADAPTER,exportName}]))};
}
export function loadContext(context){
 const root=context.projectRoot,plans=context.inputEvidence.filter(b=>b.path.endsWith('/quality-plan.json'));assert.equal(plans.length,1);
 const plan=validatePlan(root,json(root,plans[0]));verifyFinalAcceptance(root,plan);
 assert.equal(context.capabilityVersion,plan.capabilityVersion);assert.equal(context.packageIdentity,plan.packageId);assert.equal(context.outputRoot,plan.outputRoot);
 const packageBinding=bind(root,'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json'),spec=json(root,packageBinding);
 assert.equal(spec.schemaVersion,'ai-painter-autonomous-closed-loop-package-v1');assert.equal(spec.maxInfrastructureRecoveryAttempts,0);
 assert.equal(spec.ownerAuthorizationRequired,false);assert.equal(spec.ownerInStateMachine,false);assert.deepEqual(spec.inputEvidence,context.inputEvidence);
 assert.deepEqual(spec.programLineage,Object.fromEntries(Object.entries(plan.programBindings).map(([k,b])=>[k,b.sha256])));
 assert.deepEqual(Object.keys(spec.phaseAdapters).sort(),[...PHASES].sort());
 for(const phase of PHASES)assert.deepEqual(spec.phaseAdapters[phase],{kind:'project_module_export',path:ADAPTER,sha256:plan.programBindings.adapter.sha256,exportName:phase});
 for(const b of spec.inputEvidence)read(root,b);
 return {root,plan,packageBinding,spec,planBinding:plans[0],input:{plan,planBinding:plans[0],packageBinding,modelBinding:plan.modelBinding,modelIdentity:json(root,plan.modelBinding)}};
}

function finalRgbProgramBindings(root,capabilityVersion=FINAL_RGB_CAPABILITY){
 const route=executionRoute(capabilityVersion),required=requiredProgramRoles(root,capabilityVersion);
 const extras={...LOCAL_DEPLOYMENT_DEPENDENCY_ROLES,
  localControl:ROLES.localControl,localPrepareEntry:ROLES.localPrepareEntry,localPrepare:ROLES.localPrepare,
  stopNativeControl:ROLES.stopNativeControl,stopRequest:ROLES.stopRequest,stopExecutionBridge:ROLES.stopExecutionBridge,
  stopHandoff:ROLES.stopHandoff,operatorSession:ROLES.operatorSession,backgroundLauncher:ROLES.backgroundLauncher,
  exactlyOnceSpawn:ROLES.exactlyOnceSpawn,storageMapping:ROLES.storageMapping,
  registeredEntrypoints:SUPPORT_DEPENDENCY_ROLES.registeredEntrypoints,
  consoleTrainingPresentation:SUPPORT_DEPENDENCY_ROLES.consoleTrainingPresentation,
  consoleTrainingHistoryAdapters:SUPPORT_DEPENDENCY_ROLES.consoleTrainingHistoryAdapters,
  previewComponent:'ml/ai-painter/src/ai_painter/complete_world/training_preview_observer_v1.py',
  previewTests:'ml/ai-painter/tests/test_training_preview_observer_cpu_v1.py',
  previewStorage:'ml/ai-painter/src/ai_painter/complete_world/training_preview_storage_v1.py',
  previewStorageTests:'ml/ai-painter/tests/test_training_preview_storage_cpu_v1.py',
  previewPolicy:route.previewPath,
  sourceCollector:'scripts/lib/ai-painter-execution-source-closure-v1.mjs',
  sourceCollectorTests:'scripts/tests/ai-painter-execution-source-closure-v1.test.mjs',
  ...(capabilityVersion===JOINT_CAPABILITY?{jointQualityNodeChain:JOINT_COMPONENTS.nodeChain,jointQualityNodeTests:JOINT_COMPONENTS.nodeTests,
   progressPublication:JOINT_COMPONENTS.progressPublication,progressPublicationPolicy:JOINT_PROGRESS_PUBLICATION_POLICY.path}:{finalRgbNodeIntegrationTests:'scripts/tests/ai-painter-final-rgb-base-weight-integration.test.mjs'})};
 const paths=new Map(Object.entries(required).map(([role,p])=>[p,role]));
 for(const [role,p]of Object.entries(extras))if(!paths.has(p)){required[role]=p;paths.set(p,role);}
 const localRoute=localPreparationRoute(route.candidateSelection);
 assert.equal(localRoute.capability,capabilityVersion);assert.equal(localRoute.adapter,ADAPTER);
 const dynamicPaths=[localRoute.adapter,'scripts/lib/'+localRoute.chain.slice(2),'scripts/lib/'+localRoute.native.slice(2)];
 const result=requireSource('./ai-painter-execution-source-closure-v1.mjs').collectActualExecutionSources({root,
  required,dynamicPaths,python:runtimeIdentity(root).python.absolutePath,bind:p=>bind(root,p)});
 verifyProgramBindingAliases(result,{capabilityVersion});return result;
}

export function verifyFinalRgbAuthority(root){
 const route=FINAL_RGB_PROFILE,policy=json(root,route.EXECUTION_POLICY);
 assert.equal(policy.schemaVersion,'ai-painter-final-rgb-base-weight-quality-execution-policy-v3');
 assert.deepEqual(policy.qualificationObservation,{
  "schemaVersion": "ai-painter-gpu-qualification-timing-v1",
  "fileName": "gpu-qualification-timing.json",
  "enabledCapability": "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1",
  "maxFileBytes": 32768,
  "maxStagedFileBytes": 32768,
  "accountedWithinQualificationOutputBytes": 16777216,
  "accountedWithinRunOutputBytes": 134217728,
  "trustedAuthenticatedPlanAndPackageRequiredForOutput": true,
  "beforeAuthentication": "memory_only_no_output_path_authority",
  "measurementPoints": [
    "initial_authentication",
    "data_load",
    "model_setup",
    "cuda_setup",
    "resource_checks",
    "generator_forward",
    "generator_vjp",
    "discriminator_vjp",
    "post_vjp_processing"
  ],
  "clock": "host_monotonic_elapsed_not_gpu_kernel_time",
  "existingEventCountsOnly": true,
  "sampleCountsFromActualProbeEntryAndCompletion": true,
  "aggregatesAndLastEventOnly": true,
  "tensorOrRgbStorageAllowed": false,
  "additionalForwardCalls": 0,
  "additionalAutogradCalls": 0,
  "additionalOptimizerConstruction": 0,
  "additionalCudaEvents": 0,
  "additionalCudaSynchronization": 0,
  "originalOperationAndSafetyCheckOrderUnchanged": true,
  "postVjpProcessingMeaning": "combined_carrier_copy_cpu_gate_and_remaining_probe_proof_not_individually_attributed",
  "resourceTimeMeaning": "includes_existing_gpu_synchronization_and_nested_authentication_not_pure_cpu_cost",
  "nestedTimingsMayBeAddedAsIndependentGpuCosts": false,
  "writeMode": "bounded_atomic_replace_inside_authenticated_output_root",
  "writeFailure": "fail_closed_preserve_existing_primary_error_and_record_secondary_observation_error",
  "canGrantQualification": false,
  "reconstructUncommittedCountsAfterTimeout": false,
  "oldRunBackfillAllowed": false,
  "newBackendApiOrUiAllowed": false
});
 assert.equal(policy.candidate,route.CAPABILITY);assert.equal(policy.modelCapability,route.MODEL_CAPABILITY);
 assert.equal(policy.executionProfile,route.EXECUTION_PROFILE);assert.equal(policy.outputRoot,route.OUTPUT_ROOT);
 assert.deepEqual({path:policy.formalSpecification.path,sha256:policy.formalSpecification.sha256},route.SPECIFICATION);
 assert.ok(read(root,route.SPECIFICATION).includes(Buffer.from('AI-PAINTER-SPEC-1.79')));
 const previous=policy.supersededExecutionRevision;
 assert.deepEqual(previous,{path:'data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-quality-execution-policy-v2.json',
  sha256:'6bdb8b2dac7db6f7a6d95592c5c970fa2aef82fd8e49ec90546ec64bdee6feab',
  formalSpecificationSnapshot:{path:'data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.78-c3e55a2e.txt',
   sha256:'c3e55a2e5419375137ee70e1697e83a05c51354fc90935053de77bad326e70b3'},oldAttemptReplayAllowed:false,oldQualificationReusable:false});
 const previousPolicy=json(root,{path:previous.path,sha256:previous.sha256});
 assert.equal(previousPolicy.schemaVersion,'ai-painter-final-rgb-base-weight-quality-execution-policy-v2');
 assert.equal(previousPolicy.formalSpecification.sha256,previous.formalSpecificationSnapshot.sha256);
 assert.ok(read(root,previous.formalSpecificationSnapshot).includes(Buffer.from('AI-PAINTER-SPEC-1.78')));
 for(const b of policy.modelBoundary.frozenCpuSources)read(root,b);
 for(const key of ['acceptance','terminal','policy','originalNormativeBytes'])read(root,policy.priorCpuEvidence[key]);
 const prior=json(root,policy.priorCpuEvidence.acceptance),terminal=json(root,policy.priorCpuEvidence.terminal);
 assert.equal(prior.status,'actual_cpu_candidate_verified_inactive');assert.equal(prior.nativeCleanupVerified,true);
 assert.equal(prior.guardReleaseVerified,true);assert.equal(terminal.status,'cpu_candidate_verified_inactive');
 const previewBinding=bind(root,route.previewPath),preview=json(root,previewBinding);
 assert.equal(preview.schemaVersion,'ai-painter-training-preview-observation-policy-v3');
 assert.equal(preview.scope.capabilityVersion,route.CAPABILITY);assert.equal(preview.scope.modelCapabilityVersion,route.MODEL_CAPABILITY);
 assert.equal(preview.scope.outputRootPrefix,route.OUTPUT_ROOT+'/');
 for(const role of ['component','tests','storage','storageTests'])read(root,preview.programBindings[role]);
 return {policy,previewBinding};
}

function routeAuthority(root,capabilityVersion){return capabilityVersion===JOINT_CAPABILITY?verifyJointAuthority(root,{read,json,bind}):verifyFinalRgbAuthority(root);}
function finalRgbProvenance(root,policy){
 if(policy.candidate===JOINT_CAPABILITY)return jointProvenance(policy);
 const frozen=json(root,FROZEN_PLAN);assert.equal(Object.keys(frozen.programBindings).length,179);
 return {schemaVersion:'ai-painter-execution-provenance-refs-v1',frozenProgramPlan:{...FROZEN_PLAN},
  priorCpuAcceptance:{...policy.priorCpuEvidence.acceptance},role:'immutable_historical_source_references_not_execution_permission'};
}

function prepareFinalRgbCpuRequest({root,runId,packageId,preparationRequestBinding,capabilityVersion=FINAL_RGB_CAPABILITY}){
 for(const id of [runId,packageId])assert.match(id,/^[a-z0-9][a-z0-9-]{7,127}$/u);assert.notEqual(runId,packageId);
 const route=executionRoute(capabilityVersion),{policy,previewBinding}=routeAuthority(root,capabilityVersion),candidate=json(root,CANDIDATE);
 const configuration=deriveConfiguration(candidate,{capabilityVersion:route.CAPABILITY,trainingPreviewPolicy:previewBinding});
 const outputRoot=route.OUTPUT_ROOT+'/'+runId,programBindings=finalProgramBindings(root,{capabilityVersion:route.CAPABILITY});
 const runtime=runtimeIdentity(root),directory=inside(root,outputRoot);
 if(fs.existsSync(directory)){
  assert.ok(preparationRequestBinding);assert.deepEqual(fs.readdirSync(directory).sort(),['local-prepare']);
  validatePreparationNamespace(preparationRequestBinding,json(root,preparationRequestBinding),{outputRoot,runId,packageId,programBindings,runtimeIdentity:runtime});
 }else assert.equal(preparationRequestBinding,null);
 return write(root,outputRoot+'/cpu-request.json',{schema:'object-support-structure-quality-cpu-request-v1',runId,packageId,
  outputRoot:outputRoot+'/cpu-entry',configuration,programBindings,modelIdentityOutput:outputRoot+'/model-identity.json',
  modelCapabilityVersion:route.MODEL_CAPABILITY,datasetManifest:candidate.frozenBindings.datasetManifest,
  trainSplit:candidate.frozenBindings.trainSplit,validationSplit:candidate.frozenBindings.validationSplit,
  formalSpecification:route.SPECIFICATION,sourceCandidate:CANDIDATE,runtimeIdentity:runtime,
  historicalProvenance:finalRgbProvenance(root,policy)});
}

function validateFinalRgbPlan(root,plan){
 const route=executionRoute(plan.capabilityVersion),{policy,previewBinding}=routeAuthority(root,plan.capabilityVersion);
 assert.equal(plan.capabilityVersion,route.CAPABILITY);
 assert.deepEqual(plan.executionPolicy,route.EXECUTION_POLICY);
 assert.deepEqual(plan.executionPolicy,plan.configuration.executionPolicy);
 assert.deepEqual(plan.trainingPreviewPolicy,plan.configuration.trainingPreviewPolicy);
 assert.deepEqual(plan.configuration,deriveConfiguration(json(root,CANDIDATE),{capabilityVersion:route.CAPABILITY,trainingPreviewPolicy:previewBinding}));
 assert.deepEqual(plan.trainingPreviewPolicy,previewBinding);assert.deepEqual(plan.historicalProvenance,finalRgbProvenance(root,policy));
 const model=validateModelIdentity(json(root,plan.modelBinding));
 validate({plan,planBinding:{path:plan.outputRoot+'/quality-plan.json',sha256:sha(JSON.stringify(plan))},
  packageBinding:{path:'.runtime/ai-painter/autonomous-closed-loop-packages/'+plan.packageId+'/package.json',sha256:sha('shape-only')},
  modelBinding:plan.modelBinding,modelIdentity:model});
 verifyProgramBindingAliases(plan.programBindings,{capabilityVersion:route.CAPABILITY});
 const required=requiredProgramRoles(root,route.CAPABILITY);
 for(const [role,p]of Object.entries(required))assert.equal(plan.programBindings[role]?.path,p,'registered role omitted: '+role);
 assert.deepEqual(plan.programBindings.executionPolicy,route.EXECUTION_POLICY);
 let bytes=0;for(const b of Object.values(plan.programBindings)){const raw=read(root,b);assert.ok(raw.length<=1048576);bytes+=raw.length;assert.ok(bytes<=16777216);}
 assert.deepEqual(plan.programBindings,finalProgramBindings(root,{capabilityVersion:route.CAPABILITY}),'actual current execution closure differs');
 assert.equal(Object.hasOwn(plan,'resourceSuccessor'),false);return plan;
}

function finalRgbInternalCandidate(root,planBinding,plan){
 const route=executionRoute(plan.capabilityVersion),{policy}=routeAuthority(root,plan.capabilityVersion);
 const evidence=[planBinding,route.SPECIFICATION,route.EXECUTION_POLICY,CANDIDATE,
  LOSS,GRADIENT,INTEGRATION_POLICY,plan.trainingPreviewPolicy,plan.modelBinding,plan.datasetManifest,plan.trainSplit,
  plan.validationSplit,plan.finalCpuAcceptance,plan.dataClosure,
  ...(plan.capabilityVersion===JOINT_CAPABILITY?jointHistoryBindings(policy):[FROZEN_PLAN,...policy.modelBoundary.frozenCpuSources,
   ...['acceptance','terminal','policy','originalNormativeBytes'].map(k=>policy.priorCpuEvidence[k]),
   {path:policy.supersededExecutionRevision.path,sha256:policy.supersededExecutionRevision.sha256},policy.supersededExecutionRevision.formalSpecificationSnapshot])];
 return {schemaVersion:'ai-painter-autonomous-closed-loop-candidate-v1',packageIdentity:plan.packageId,
  capabilityVersion:plan.capabilityVersion,ownerAuthorizationRequired:false,maxInfrastructureRecoveryAttempts:0,outputRoot:plan.outputRoot,
  programFiles:Object.fromEntries(Object.entries(plan.programBindings).map(([role,b])=>[role,b.path])),
  inputEvidencePaths:[...new Set(evidence.map(b=>b.path))],
  phaseAdapters:Object.fromEntries(PHASES.map(exportName=>[exportName,{path:ADAPTER,exportName}]))};
}
