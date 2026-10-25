import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {finalProgramBindings} from '../lib/ai-painter-decode1-entry-weight-quality-package-chain-v1.mjs';
import {collectActualExecutionSources,sourceCollectionReport} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';
import {executionRoute,QUALIFICATION_CAPTURE_CAPABILITY,TRAINING_CAPTURE_CAPABILITY,TRAINING_CAPTURE_V2_CAPABILITY,TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY,TRAINING_CAPTURE_CAPABILITIES,RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY,SAME_CALL_CAPABILITY,
 INTERFACE_REGISTRY_PATH} from '../lib/ai-painter-decode1-entry-weight-quality-registration-v1.mjs';

const root=process.cwd(),python=path.join(root,'ml/ai-painter/.venv/Scripts/python.exe');
const harness='ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py';
const worker='ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_quality_worker_v1.py';
const qualifier='ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py';
const previewTests='ml/ai-painter/tests/test_training_preview_observer_cpu_v2.py';
const legacyPreview='ml/ai-painter/src/ai_painter/complete_world/training_preview_observer_v1.py';
const canonicalProgram='scripts/lib/real-earth-region-governance.mjs';
const oldSources=['ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_bridge_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_capture_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_storage_v1.py',
 'ml/ai-painter/scripts/painter_stage4_decode1_entry_same_call_training_profile_v1.py'];
const newSources=['ml/ai-painter/scripts/qualification_parameter0_capture_v1.py',
 'ml/ai-painter/scripts/qualification_gradient_gate_authentication_cpu_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_observation_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter40_qualification_reference_v1.py'];
const trainingSources=['ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_capture_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_storage_v1.py',
 'ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_bridge_v1.py',
 'ml/ai-painter/scripts/painter_stage4_decode2_rgb_output_training_same_call_profile_v1.py'];
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');

for(const cap of [...TRAINING_CAPTURE_CAPABILITIES,QUALIFICATION_CAPTURE_CAPABILITY,SAME_CALL_CAPABILITY,RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY]){
 test('actual closed graph preserves256 and only the applicable capture implementation: '+cap,()=>{
  const programs=finalProgramBindings(root,{capabilityVersion:cap}),report=sourceCollectionReport();
  const paths=new Set(Object.values(programs).map(v=>v.path)),isNew=cap===QUALIFICATION_CAPTURE_CAPABILITY,isTraining=TRAINING_CAPTURE_CAPABILITIES.includes(cap);
  assert.equal(paths.size,256);assert.equal(report.sourceCount,256);
  if([TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY].includes(cap)){
   assert.equal(programs.canonicalRegionProgram.path,canonicalProgram);assert.ok(paths.has(canonicalProgram));
   assert.ok(paths.has(previewTests));assert.ok(!paths.has(legacyPreview));
   const preview=report.deferredImportEvidence.find(v=>v.path===previewTests);
   assert.deepEqual(preview.excludedLateImports.map(({scope,module,level,names})=>({scope,module,level,names})),[
    {scope:'TrainingPreviewObserverCpuTests.test_same_capture_and_failure_bytes_as_frozen_v1_algorithm',module:'ai_painter.complete_world',level:0,names:['training_preview_observer_v1']}]);
  }else{assert.ok(paths.has(legacyPreview));assert.ok(!report.deferredImportEvidence.some(v=>v.path===previewTests));}
  for(const p of isTraining?trainingSources:isNew?newSources:oldSources)assert.ok(paths.has(p),p);
  for(const p of isTraining?[...oldSources,...newSources]:isNew?[...oldSources,...trainingSources]:[...newSources,...trainingSources])assert.ok(!paths.has(p),p);
  const rule=report.deferredImportEvidence.find(v=>v.path===harness);
  assert.deepEqual(rule.excludedLateImports.map(v=>v.scope).sort(),[
   ...(isNew||isTraining?['SameCallRouteTests.fixture','SameCallRouteTests.test_real_three_callbacks_preserve_pair_first_error_and_secondary_admission']:[]),
   ...(!isNew?['QualificationSequenceRouteTests.fixture']:[]),...(!isTraining?['TrainingCaptureRouteTests.fixture']:[])].sort());
  assert.ok(rule.excludedLateImports.every(v=>v.scope&&v.level===0));
  for(const target of [worker,qualifier,'ml/ai-painter/scripts/decode1_entry_weight_quality_auth_v1.py',
   'ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py']){
   assert.ok(report.sourceEdges.some(e=>e.from===harness&&e.to===target),'module-level dependency kept: '+target);
  }
  const production=report.deferredImportEvidence.find(v=>v.path===worker);
  assert.deepEqual(production.excludedLateImports.map(v=>v.scope).sort(),[
   ...(isNew||isTraining?['training_loop_callbacks']:[]),...(!isTraining?['training_loop_callbacks','verify_capture_terminal']:[])].sort());
  if(!isNew){const q=report.deferredImportEvidence.find(v=>v.path===qualifier);
   assert.deepEqual(q.excludedLateImports.map(v=>v.scope),['invoke_original_probe','capture_for_sample']);}
  assert.match(fs.readFileSync(path.join(root,worker),'utf8'),/loaded project source outside closure/);
 });
}

for(const [cap,caller]of [[TRAINING_CAPTURE_V6_CAPABILITY,previewTests],[TRAINING_CAPTURE_V6_CAPABILITY,harness],[TRAINING_CAPTURE_V6_CAPABILITY,worker],[TRAINING_CAPTURE_V5_CAPABILITY,previewTests],[TRAINING_CAPTURE_V5_CAPABILITY,harness],[TRAINING_CAPTURE_V5_CAPABILITY,worker],[TRAINING_CAPTURE_V4_CAPABILITY,previewTests],[TRAINING_CAPTURE_V4_CAPABILITY,harness],[TRAINING_CAPTURE_V4_CAPABILITY,worker],[TRAINING_CAPTURE_V3_CAPABILITY,previewTests],[TRAINING_CAPTURE_V3_CAPABILITY,harness],[TRAINING_CAPTURE_V3_CAPABILITY,worker],
 [TRAINING_CAPTURE_V2_CAPABILITY,harness],[TRAINING_CAPTURE_V2_CAPABILITY,worker],[TRAINING_CAPTURE_V2_CAPABILITY,qualifier],[TRAINING_CAPTURE_CAPABILITY,harness],[TRAINING_CAPTURE_CAPABILITY,worker],[TRAINING_CAPTURE_CAPABILITY,qualifier],
 [QUALIFICATION_CAPTURE_CAPABILITY,harness],[QUALIFICATION_CAPTURE_CAPABILITY,worker],
 [RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY,harness],[RGB_OUTPUT_SUPPORT_WEIGHT1_CAPABILITY,qualifier]]){
 test('any change to reviewed deferred-import caller fails closed: '+cap+' '+caller,()=>{
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'painter-closure-reject-cpu-'));
  try{
   const route=executionRoute(cap,root),policy=fs.readFileSync(path.join(root,route.EXECUTION_POLICY.path));
   const put=(logical,raw)=>{const target=path.join(fixture,logical);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw,{flag:'wx'});};
   put(route.EXECUTION_POLICY.path,policy);
   put(INTERFACE_REGISTRY_PATH,JSON.stringify({schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',
    normalAuthority:'local_ai_pet_world_program',ownerInNormalStateMachine:false,trainingInterfaces:[{
     candidateSelection:route.candidateSelection,executionPolicy:route.EXECUTION_POLICY}]}));
   put(caller,Buffer.concat([fs.readFileSync(path.join(root,caller)),Buffer.from('\n# changed deferred-import source\n')]));
   assert.throws(()=>collectActualExecutionSources({root:fixture,required:{reviewedCaller:caller},python,capabilityVersion:cap,
    bind:p=>({path:p,sha256:digest(fs.readFileSync(path.join(fixture,p)))})}),/reviewed late import source changed/);
  }finally{
   const actual=fs.realpathSync(fixture);assert.equal(path.dirname(actual),fs.realpathSync(os.tmpdir()));
   assert.ok(path.basename(actual).startsWith('painter-closure-reject-cpu-'));fs.rmSync(actual,{recursive:true});
  }
 });
}

function previewClosureFixture(action,capability=TRAINING_CAPTURE_V3_CAPABILITY){
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'painter-preview-pruning-cpu-'));
 try{
  const route=executionRoute(capability,root);
  const put=(logical,raw)=>{const target=path.join(fixture,logical);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);};
  for(const logical of [route.EXECUTION_POLICY.path,previewTests,legacyPreview,canonicalProgram,
   'ml/ai-painter/src/ai_painter/complete_world/training_preview_observer_v2.py',
   'ml/ai-painter/src/ai_painter/complete_world/__init__.py','ml/ai-painter/src/ai_painter/__init__.py'])put(logical,fs.readFileSync(path.join(root,logical)));
  put(INTERFACE_REGISTRY_PATH,JSON.stringify({schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',normalAuthority:'local_ai_pet_world_program',
   ownerInNormalStateMachine:false,trainingInterfaces:[{candidateSelection:route.candidateSelection,executionPolicy:route.EXECUTION_POLICY}]}));
  const collect=required=>collectActualExecutionSources({root:fixture,required,python,capabilityVersion:capability,
   bind:p=>({path:p,sha256:digest(fs.readFileSync(path.join(fixture,p)))})});
  action({fixture,put,collect});
 }finally{
  const actual=fs.realpathSync(fixture);assert.equal(path.dirname(actual),fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(actual).startsWith('painter-preview-pruning-cpu-'));fs.rmSync(actual,{recursive:true});
 }
}
test('v3 preview exclusion retains the full source and every new incoming edge',()=>previewClosureFixture(({put,collect})=>{
 let programs=collect({previewTests});assert.ok(!Object.values(programs).some(v=>v.path===legacyPreview));
 assert.ok(Object.values(programs).some(v=>v.path===previewTests));assert.equal(programs.canonicalRegionProgram.path,canonicalProgram);
 for(const source of ['from ai_painter.complete_world import training_preview_observer_v1\n',
  'def another_unreviewed_scope():\n    from ai_painter.complete_world import training_preview_observer_v1\n']){
  put('additional.py',source);programs=collect({previewTests,unreviewedIncoming:'additional.py'});
  assert.ok(Object.values(programs).some(v=>v.path===legacyPreview),'an unreviewed incoming must retain the old source');
 }
}));
test('v3 wrong preview import scope cannot reuse the reviewed source SHA',()=>previewClosureFixture(({put,collect})=>{
 const changed=fs.readFileSync(path.join(root,previewTests),'utf8').replace(
  'def test_same_capture_and_failure_bytes_as_frozen_v1_algorithm(self):','def renamed_unreviewed_scope(self):');
 assert.notEqual(digest(changed),digest(fs.readFileSync(path.join(root,previewTests))));put(previewTests,changed);
 assert.throws(()=>collect({previewTests}),/reviewed late import source changed/);
}));
test('v4 preview exclusion retains the full source and every new incoming edge',()=>previewClosureFixture(({put,collect})=>{
 let programs=collect({previewTests});assert.ok(!Object.values(programs).some(v=>v.path===legacyPreview));
 assert.ok(Object.values(programs).some(v=>v.path===previewTests));assert.equal(programs.canonicalRegionProgram.path,canonicalProgram);
 for(const source of ['from ai_painter.complete_world import training_preview_observer_v1\n',
  'def another_unreviewed_scope():\n    from ai_painter.complete_world import training_preview_observer_v1\n']){
  put('additional.py',source);programs=collect({previewTests,unreviewedIncoming:'additional.py'});
  assert.ok(Object.values(programs).some(v=>v.path===legacyPreview),'an unreviewed incoming must retain the old source');
 }
},TRAINING_CAPTURE_V4_CAPABILITY));
test('v4 wrong preview import scope cannot reuse the reviewed source SHA',()=>previewClosureFixture(({put,collect})=>{
 const changed=fs.readFileSync(path.join(root,previewTests),'utf8').replace(
  'def test_same_capture_and_failure_bytes_as_frozen_v1_algorithm(self):','def renamed_unreviewed_scope(self):');
 assert.notEqual(digest(changed),digest(fs.readFileSync(path.join(root,previewTests))));put(previewTests,changed);
 assert.throws(()=>collect({previewTests}),/reviewed late import source changed/);
},TRAINING_CAPTURE_V4_CAPABILITY));
test('v5 preview exclusion retains the full source and every new incoming edge',()=>previewClosureFixture(({put,collect})=>{
 let programs=collect({previewTests});assert.ok(!Object.values(programs).some(v=>v.path===legacyPreview));
 assert.ok(Object.values(programs).some(v=>v.path===previewTests));assert.equal(programs.canonicalRegionProgram.path,canonicalProgram);
 for(const source of ['from ai_painter.complete_world import training_preview_observer_v1\n',
  'def another_unreviewed_scope():\n    from ai_painter.complete_world import training_preview_observer_v1\n']){
  put('additional.py',source);programs=collect({previewTests,unreviewedIncoming:'additional.py'});
  assert.ok(Object.values(programs).some(v=>v.path===legacyPreview),'an unreviewed incoming must retain the old source');
 }
},TRAINING_CAPTURE_V5_CAPABILITY));
test('v5 wrong preview import scope cannot reuse the reviewed source SHA',()=>previewClosureFixture(({put,collect})=>{
 const changed=fs.readFileSync(path.join(root,previewTests),'utf8').replace(
  'def test_same_capture_and_failure_bytes_as_frozen_v1_algorithm(self):','def renamed_unreviewed_scope(self):');
 assert.notEqual(digest(changed),digest(fs.readFileSync(path.join(root,previewTests))));put(previewTests,changed);
 assert.throws(()=>collect({previewTests}),/reviewed late import source changed/);
},TRAINING_CAPTURE_V5_CAPABILITY));

test('v6 preview exclusion retains the full source and every new incoming edge',()=>previewClosureFixture(({put,collect})=>{
 let programs=collect({previewTests});assert.ok(!Object.values(programs).some(v=>v.path===legacyPreview));
 assert.ok(Object.values(programs).some(v=>v.path===previewTests));assert.equal(programs.canonicalRegionProgram.path,canonicalProgram);
 for(const source of ['from ai_painter.complete_world import training_preview_observer_v1\n',
  'def another_unreviewed_scope():\n    from ai_painter.complete_world import training_preview_observer_v1\n']){
  put('additional.py',source);programs=collect({previewTests,unreviewedIncoming:'additional.py'});
  assert.ok(Object.values(programs).some(v=>v.path===legacyPreview),'an unreviewed incoming must retain the old source');
 }
},TRAINING_CAPTURE_V6_CAPABILITY));
test('v6 wrong preview import scope cannot reuse the reviewed source SHA',()=>previewClosureFixture(({put,collect})=>{
 const changed=fs.readFileSync(path.join(root,previewTests),'utf8').replace(
  'def test_same_capture_and_failure_bytes_as_frozen_v1_algorithm(self):','def renamed_unreviewed_scope(self):');
 assert.notEqual(digest(changed),digest(fs.readFileSync(path.join(root,previewTests))));put(previewTests,changed);
 assert.throws(()=>collect({previewTests}),/reviewed late import source changed/);
},TRAINING_CAPTURE_V6_CAPABILITY));
