import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {collectActualExecutionSources,nodeImports,sourceCollectionReport} from '../lib/ai-painter-execution-source-closure-v1.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const python=path.join(project,'ml/ai-painter/.venv/Scripts/python.exe');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'execution-source-closure-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(name,raw)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);};
 const bind=name=>({path:name,sha256:sha(fs.readFileSync(path.join(root,name)))});
 return {root,put,bind};
}

test('module literals only: comments and embedded source strings do not become imports',()=>{
 const code='// import fake from "not-executed"\nconst text=`import fake from "also-not-executed"`;\n'
  +'import {a} from "./actual.mjs";export {b} from "./export.mjs";await import("./dynamic.mjs");require("node:fs");';
 assert.deepEqual(nodeImports(code),['./actual.mjs','./export.mjs','./dynamic.mjs','node:fs']);
 assert.deepEqual(nodeImports('await import("./lib/"+registered.chain);'),[]);
 assert.deepEqual(nodeImports('const pattern=/[\x27\x22]/;const nested=`x${"quoted"}`;import "./real.mjs";'),['./real.mjs']);
});

test('unique actual transitive Node sources plus explicit dynamic sources; no evaluation',t=>{
 const f=fixture(t);f.put('main.mjs','import "./child.mjs";throw Error("must never execute");');
 f.put('child.mjs','export const value=1;');f.put('dynamic.mjs','export const value=2;');
 const result=collectActualExecutionSources({...f,required:{entry:'main.mjs'},dynamicPaths:['dynamic.mjs'],python});
 assert.equal(Object.keys(result).length,3);assert.equal(result.entry.path,'main.mjs');
 assert.equal(new Set(Object.values(result).map(b=>b.path)).size,3);
});

test('Python AST includes package initializers and local from-import dependencies without import execution',t=>{
 const f=fixture(t);f.put('ml/ai-painter/scripts/entry.py','from ai_painter.demo import child\nraise RuntimeError("not executed")\n');
 f.put('ml/ai-painter/src/ai_painter/__init__.py','');f.put('ml/ai-painter/src/ai_painter/demo/__init__.py','');
 f.put('ml/ai-painter/src/ai_painter/demo/child.py','from . import sibling\n');f.put('ml/ai-painter/src/ai_painter/demo/sibling.py','x=1\n');
 const result=collectActualExecutionSources({...f,required:{entry:'ml/ai-painter/scripts/entry.py'},python});
 assert.equal(Object.keys(result).length,5);
});

test('unresolved static import and duplicate required path fail closed',t=>{
 const f=fixture(t);f.put('main.mjs','import "./missing.mjs";');
 assert.throws(()=>collectActualExecutionSources({...f,required:{entry:'main.mjs'},python}),/unresolved/);
 assert.throws(()=>collectActualExecutionSources({...f,required:{a:'main.mjs',b:'main.mjs'},python}),/duplicates/);
});

test('256 count and1MiB per-file ceilings cannot be raised by caller',t=>{
 const f=fixture(t),required={};for(let i=0;i<257;i++){const p='source-'+i+'.txt';f.put(p,'x');required['r'+i]=p;}
 assert.throws(()=>collectActualExecutionSources({...f,required,python}),/exceeds256/);
 f.put('large.txt',Buffer.alloc(1048577));
 assert.throws(()=>collectActualExecutionSources({...f,required:{large:'large.txt'},python}),/file ceiling/);
});

test('actual source byte mismatch is rejected rather than accepted from a SHA-shaped string',t=>{
 const f=fixture(t);f.put('entry.mjs','export const x=1;');
 assert.throws(()=>collectActualExecutionSources({...f,required:{entry:'entry.mjs'},python,
  bind:p=>({path:p,sha256:'0'.repeat(64)})}),/changed/);
});


test('literal Python importlib edges join the transitive graph; deferred imports remain conservative without the registered profile',t=>{
 const f=fixture(t);f.put('ml/ai-painter/scripts/main.py','import importlib\ndef deferred():\n return importlib.import_module("local_child")\n');
 f.put('ml/ai-painter/scripts/local_child.py','raise RuntimeError("must not run")\n');
 const bindings=collectActualExecutionSources({...f,required:{entry:'ml/ai-painter/scripts/main.py'},python});
 assert.equal(Object.keys(bindings).length,2);
 assert.ok(sourceCollectionReport().includedLateImports.some(row=>row.dynamicLiteral&&row.scope==='deferred'));
});

test('reviewed deferred scopes require exact policy and caller/source bytes, not filenames or caller SHA strings',t=>{
 const f=fixture(t),profile='ml/ai-painter/scripts/painter_stage4_final_rgb_base_weight_training_profile_v1.py',
 policy='data/ai-painter/system-governance/ai-painter-final-rgb-base-weight-quality-execution-policy-v3.json',
 legacy='ml/ai-painter/scripts/painter_stage4_detail_weight_capture_execution_worker.py';
 const required={finalRgbTrainingProfile:profile,executionPolicy:policy,legacy};
 f.put(profile,'# wrong caller bytes\n');f.put(policy,fs.readFileSync(path.join(project,policy)));f.put(legacy,'# wrong legacy bytes\n');
 assert.throws(()=>collectActualExecutionSources({...f,required,python}),/reviewed late import caller changed/);
 f.put(profile,fs.readFileSync(path.join(project,profile)));
 assert.throws(()=>collectActualExecutionSources({...f,required,python}),/reviewed late import source changed/);
 f.put(policy,'{}');assert.throws(()=>collectActualExecutionSources({...f,required,python}),/registered final RGB policy bytes differ/);
});

test('actual registered graph preserves required late modules and the unchanged worker rejects an unregistered loaded source',async()=>{
 const chain=await import('../lib/ai-painter-object-support-structure-quality-package-chain-v1.mjs');
 const bindings=chain.finalProgramBindings(project,{capabilityVersion:chain.FINAL_RGB_CAPABILITY}),report=sourceCollectionReport();
 assert.deepEqual(chain.finalProgramBindings(project,{capabilityVersion:chain.FINAL_RGB_CAPABILITY}),bindings,'same frozen sources must produce the same closure');
 const paths=new Set(Object.values(bindings).map(b=>b.path));assert.equal(paths.size,Object.keys(bindings).length);assert.ok(paths.size<=256);
 for(const name of ['ml/ai-painter/src/ai_painter/training/__init__.py','ml/ai-painter/src/ai_painter/dataset/metadata.py',
  'ml/ai-painter/scripts/train_stage4_mvp_structured_object_v18_dry_stage0.py',
  'ml/ai-painter/scripts/painter_stage4_object_support_structure_training_profile_v1.py',
  'ml/ai-painter/scripts/materialize_stage4_mvp256_dry_v24_candidate.py',
  'ml/ai-painter/src/ai_painter/complete_world/mvp_denoiser_release.py',
  'ml/ai-painter/src/ai_painter/complete_world/mvp_dataset_release.py',
  'ml/ai-painter/src/ai_painter/complete_world/regrouped_candidate.py'])assert.ok(paths.has(name),name);
 assert.equal(report.deferredImportEvidence.length,4);assert.equal(Object.keys(report.reviewedCallers).length,9);
 assert.ok(report.includedLateImports.some(row=>row.dynamicLiteral&&row.module==='painter_stage4_final_rgb_base_weight_training_profile_v1'));
 const code=`import sys,json,importlib,hashlib,types
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'ml/ai-painter/src'),str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/tests')]
plan={'programBindings':json.load(sys.stdin)}
import torch
torch.set_num_threads(2);guards=ExitStack();calls={}
def forbidden(name):
 def stop(*a,**k):calls[name]=calls.get(name,0)+1;raise AssertionError(name)
 return stop
for obj,name in ((torch.nn.Module,'_call_impl'),(torch.autograd,'grad'),(torch.autograd,'backward'),(torch.optim.Optimizer,'__init__'),(torch.cuda,'_lazy_init')):guards.enter_context(patch.object(obj,name,side_effect=forbidden(name)))
roots=['painter_stage4_final_rgb_base_weight_training_profile_v1','object_support_structure_quality_auth_v1','painter_stage4_object_support_structure_quality_worker_v1','painter_stage4_object_support_structure_lifecycle_v1','qualify_stage4_object_support_structure_quality_gpu_v1','review_stage4_object_support_structure_quality_cpu_v1','test_final_rgb_base_weight_quality_adapters_cpu_v1','test_object_support_structure_execution_cpu_v1','diagnose_stage4_mvp256_dry_appearance_regime_gradient_cpu','painter_stage4_detail_weight_capture_execution_worker','ai_painter.complete_world.training_preview_storage_v1','ai_painter.complete_world.training_preview_observer_v1','ai_painter.complete_world.ecology_regime_gradient_failure_capture','ai_painter.complete_world.stage4_v17_responsibility_artifact','materialize_stage4_mvp256_dry_v24_candidate','train_stage4_mvp_structured_object_v18_dry_stage0','ai_painter.complete_world.mvp_denoiser_release','ai_painter.complete_world.mvp_dataset_release','ai_painter.complete_world.regrouped_candidate','test_training_preview_observer_cpu_v1','test_training_preview_storage_cpu_v1']
for name in roots:importlib.import_module(name)
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
else:raise AssertionError('loaded source byte mismatch accepted')
assert not calls
print(json.dumps({'projectSources':len(observed['projectSources']),'unregisteredRejected':True,'shaMismatchRejected':True,'forbiddenCalls':calls,'runtimeClosureCompleteProof':False}))
guards.close()
`;
 const check=spawnSync(python,['-I','-B','-X','utf8','-c',code,project],{input:JSON.stringify(bindings),encoding:'utf8',windowsHide:true,
  timeout:20000,maxBuffer:1048576,env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',CUDA_VISIBLE_DEVICES:''}});
 assert.equal(check.status,0,check.stderr);const result=JSON.parse(check.stdout);
 assert.equal(result.unregisteredRejected,true);assert.equal(result.shaMismatchRejected,true);assert.deepEqual(result.forbiddenCalls,{});
 assert.equal(result.projectSources,paths.size-[...paths].filter(p=>!p.endsWith('.py')).length);
});
