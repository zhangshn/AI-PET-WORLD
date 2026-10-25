// Read-only dependency collection for the two registered local execution routes.
// No imports/evaluation of collected project modules and no runner/process owner.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire,builtinModules} from 'node:module';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {executionRoute,QUALIFICATION_CAPTURE_CAPABILITY,TRAINING_CAPTURE_CAPABILITY,TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY,TRAINING_CAPTURE_CAPABILITIES} from './ai-painter-decode1-entry-weight-quality-registration-v1.mjs';
import {parse} from '@babel/parser';
const builtins = new Set([...builtinModules, ...builtinModules.map(v => 'node:' + v)]);
const digest = raw => crypto.createHash('sha256').update(raw).digest('hex');
// Only deferred bodies behind these frozen, reviewed legacy surfaces are
// excluded. Every module-level import and all other function imports remain.
const finalRgbDeferredSurfaces=Object.freeze({
 'ml/ai-painter/scripts/painter_stage4_detail_weight_managed_worker.py':{
  sha256:'aeeaf8f536fd88c684c64c0f7fcf1293c56bac12558affc9810597ba9774d957',
  excludeScopes:['runtime'],
  reason:'progress writer top-level imports attach/secondary from failure helper, which imports this template; only frozen.binding is used, not its closed training_loop/runtime'},
 'ml/ai-painter/scripts/painter_stage4_detail_weight_capture_execution_worker.py':{
  sha256:'2880bbf9f78efe8273134b89ceb5f95027e846f2aa177e5ae4c59bcdf0eade79',
  excludeScopes:['runtime','load_package'],
  reason:'new worker.progress_publisher imports only replace_progress_file; legacy runtime/load_package/run are not this execution entry'},
 'ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_precision.py':{
  sha256:'1a5468eb982e786c819861740fdd2921ef4873cebe2145c9d6e27507f70dafa9',
  excludeScopes:['authenticate_diagnostic_capture','_install_diagnostic_capture'],
  reason:'fresh model factories use construction/identity; closed historical diagnostic state import is not called'},
 'ml/ai-painter/scripts/ecology_regime_execution_auth.py':{
  sha256:'900b50d3228db16b1404626b7ae20c7eebd93c58b18a2d0a0d9d9e5b9aff2aae',
  excludeScopes:['derive_model_metadata','load_execution_package'],
  reason:'new auth imports these pure binding/process helpers; its own new package/model validators replace legacy entry functions'}
});
const pythonAst = `import ast,json,sys
result=[]
for item in json.load(sys.stdin):
 tree=ast.parse(item['source'],filename=item['path'])
 imports=[];excluded=[]
 rule=item.get('deferredSurface') or {}
 def walk(node,scope=(),disabled=False):
  if isinstance(node,ast.ClassDef):scope=(*scope,node.name)
  if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
   scope=(*scope,node.name)
   if len(scope)==1:
    disabled=(('includeScopes' in rule and node.name not in rule['includeScopes']) or node.name in rule.get('excludeScopes',[]))
  if isinstance(node,ast.Import):
   for v in node.names:
    (excluded if disabled else imports).append({'module':v.name,'level':0,'names':[],'line':node.lineno,'scope':'.'.join(scope)})
  elif isinstance(node,ast.ImportFrom):
   entry={'module':node.module or '', 'level':node.level,'names':[v.name for v in node.names],'line':node.lineno,'scope':'.'.join(scope)}
   excluded_import=any(all(entry.get(k)==v for k,v in row.items()) for row in rule.get('excludeImports',[]))
   (excluded if disabled or excluded_import else imports).append(entry)
  elif isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='import_module':
   if node.args and isinstance(node.args[0],ast.Constant) and isinstance(node.args[0].value,str):
    (excluded if disabled else imports).append({'module':node.args[0].value,'level':0,'names':[],'line':node.lineno,'scope':'.'.join(scope),'dynamicLiteral':True})
  for child in ast.iter_child_nodes(node):walk(child,scope,disabled)
 walk(tree)
 result.append({'path':item['path'],'imports':imports,'excludedLateImports':excluded})
json.dump(result,sys.stdout)
`;
let lastSourceCollectionReport=null;
export function sourceCollectionReport(){return lastSourceCollectionReport===null?null:structuredClone(lastSourceCollectionReport);}

function collectActualExecutionSources({root, required, dynamicPaths=[], python, bind,capabilityVersion='stage4_mvp256_dry_decode1_entry_weight_quality24_v1'}) {
  const execution=executionRoute(capabilityVersion,root);
  assert.ok(path.isAbsolute(root));
  assert.ok(required && typeof required === 'object' && !Array.isArray(required));
  assert.equal(typeof bind, 'function');
  const pending=[], seen=new Map(), roles=new Map(), sourceEdges=[], pythonRoots=['ml/ai-painter/src','ml/ai-painter/scripts','ml/ai-painter/tests',''];
  const deadline=Date.now()+15000;let collectedBytes=0;
  const maximumEntries=256;
  const deferredSurfaces=execution.sameCallCapture?{
    ...finalRgbDeferredSurfaces,
    'ml/ai-painter/src/ai_painter/complete_world/split_release.py':{
      sha256:'d6e05cf98a7902592d1b6518968eedb72961a57872d67a6e0695a4572101d7ea',excludeScopes:['load_package'],
      reason:'Only this route uses the bound metadata/sourceIndex/cpu.load_sample path, not historical release reconstruction.'},
    'ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py':{
      sha256:'6363c4065b9dbec4376594d56664d6c0ecfdb395df61879f9045b2e75cb9e153',excludeScopes:['_joint_program_limit'],
      reason:'This decode1 route rejects above256 before capture; the other JOINT route alone can enter the historical260 exception.'}
  }:finalRgbDeferredSurfaces;
  const qualificationCapture=capabilityVersion===QUALIFICATION_CAPTURE_CAPABILITY;
  const trainingCapture=TRAINING_CAPTURE_CAPABILITIES.includes(capabilityVersion);
  // The CPU request dispatches exactly one route wiring suite. Component-suite
  // runs retain the old bridge tests; they are not an entry in a prepared Run.
  const routeDeferredSurfaces={...deferredSurfaces,
    ...([TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY].includes(capabilityVersion)?{
      'ml/ai-painter/tests/test_training_preview_observer_cpu_v2.py':{
        sha256:'254ad56aeb2657e22347678a3f2025fbd024e65206e2f9518d4961f4d2233298',
        excludeImports:[{scope:'TrainingPreviewObserverCpuTests.test_same_capture_and_failure_bytes_as_frozen_v1_algorithm',
          module:'ai_painter.complete_world',level:0,names:['training_preview_observer_v1']}],
        reason:'Only v3/v4/v5/v6: cpu_request selects AdmissionTests, CurrentRegisteredInterfaceAdmissionTests, the exact TrainingCaptureV3RouteTests/TrainingCaptureV4RouteTests/TrainingCaptureV5RouteTests/TrainingCaptureV6RouteTests and CanonicalVerificationTests/CanonicalVerificationV4Tests/CanonicalVerificationV5Tests/CanonicalVerificationV6Tests, then the fixed Node entry regression. It never dispatches the independent preview observer component suite. Keep this bound test source, every module-level import and every other deferred import. The unchanged full component suite still verifies the historical v1 comparison outside the prepared Run.'}
    }:{}),
    'ml/ai-painter/tests/test_decode1_entry_weight_quality_adapters_cpu_v1.py':{
      sha256:'e868ea837a333fc84fe48685eeee2b36df311f83f4795e70e7071d9f0fd7881f',
      excludeImports:[...(qualificationCapture||trainingCapture?[
        {scope:'SameCallRouteTests.fixture',module:'ai_painter.complete_world',level:0,names:['parameter90_training_same_call_bridge_v1']},
        {scope:'SameCallRouteTests.test_real_three_callbacks_preserve_pair_first_error_and_secondary_admission',module:'ai_painter.complete_world',level:0,names:['parameter90_training_same_call_storage_v1']}
      ]:[]),...(!qualificationCapture?[{scope:'QualificationSequenceRouteTests.fixture',module:'qualification_parameter0_capture_v1',level:0,names:['target_selected','SAMPLE_ID']}]:[]),
      ...(!trainingCapture?[{scope:'TrainingCaptureRouteTests.fixture',module:'ai_painter.complete_world',level:0,names:['parameter0_training_same_call_bridge_v1']}]:[])],
      reason:'cpu_request selects TrainingCaptureRouteTests or its exact V2/V3/V4/V5/V6 subclass for the six fixed training-capture capabilities, QualificationSequenceRouteTests for the fixed qualification-capture capability, or SameCallRouteTests for every other route. Exclude only fixture imports in unselected classes. AdmissionTests, selected registered tests, exact v3/v4/v5/v6 canonical verification tests, Node regression, every module-level import and no-request component_suite behavior remain.'},
    'ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_quality_worker_v1.py':{
      sha256:'8b4329bfccea85b823eaba306872c4a7264fd41daf6a4036b1f1c677d3b45b79',
      excludeImports:[...(qualificationCapture||trainingCapture?[
        {scope:'training_loop_callbacks',module:'ai_painter.complete_world.parameter90_training_same_call_bridge_v1',level:0,names:['TrainingSameCallBridge']}]:[]),
        ...(!trainingCapture?[
        {scope:'training_loop_callbacks',module:'ai_painter.complete_world.parameter0_training_same_call_bridge_v1',level:0,names:['TrainingSameCallBridge']},
        {scope:'verify_capture_terminal',module:'ai_painter.complete_world.parameter0_training_same_call_storage_v1',level:0,names:['verify_same_call_failure']}]:[])],
      reason:'Each training bridge import is guarded by membership in the six fixed training-capture capabilities. The new storage terminal verifier is also guarded by the same fixed capability set. Other route selections cannot enter those exact bodies; qualification capture never uses the old training bridge. Keep all module-level imports and selected live bridge/storage imports.'},
    ...(!qualificationCapture?{
      'ml/ai-painter/scripts/qualify_stage4_decode1_entry_weight_quality_gpu_v1.py':{
        sha256:'0269452696d0b7ea3f5f426d2e11cc2f537102c9d1e80807fdafe1dcf56c42ea',
        excludeImports:[
          {scope:'invoke_original_probe',module:'qualification_parameter0_capture_v1',level:0,names:['invoke_probe']},
          {scope:'capture_for_sample',module:'qualification_parameter0_capture_v1',level:0,names:['Parameter0ProbeCapture','target_selected']}],
        reason:'capture_for_sample returns None before imports for every capability except the exact qualification-capture route, including the new training-capture route. Its only production caller passes that result to invoke_original_probe, whose None branch directly calls the original probe. The route-selected CPU suite never calls the qualification-only fixture.'}
    }:{})};
  const deferredImportEvidence=[],includedLateImports=[];lastSourceCollectionReport=null;
  const logical = name => {
    assert.equal(typeof name, 'string');
    assert.ok(name && !/[\\:\x00-\x1f\x7f]/u.test(name) && !name.startsWith('/')
      && name.split('/').every(v => v && v!=='.' && v!=='..'), 'unsafe execution source');
    return name;
  };
  const add = (name, role=null,from=null) => {
    name=logical(name);
    if(from)sourceEdges.push({from,to:name});
    if(role){assert.match(role,/^[A-Za-z0-9._-]{1,80}$/u);assert.ok(!['__proto__','constructor','prototype'].includes(role));
      const previous=roles.get(name);assert.ok(!previous || previous===role, 'required role duplicates an actual path');roles.set(name,role);}
    if(!seen.has(name)){seen.set(name,null);pending.push(name);}
  };
  for(const [role,name] of Object.entries(required))add(name,role,'required:'+role);
  for(const name of dynamicPaths)add(name,null,'registered-dynamic');
  if([TRAINING_CAPTURE_V3_CAPABILITY,TRAINING_CAPTURE_V4_CAPABILITY,TRAINING_CAPTURE_V5_CAPABILITY,TRAINING_CAPTURE_V6_CAPABILITY].includes(capabilityVersion)){
    add('scripts/lib/real-earth-region-governance.mjs','canonicalRegionProgram','registered-dynamic:canonicalSha256');
  }
  const exists = name => fs.existsSync(path.join(root,name));
  const addPython = (module, from, level=0) => {
    let prefixes=pythonRoots;
    if(level){let directory=path.posix.dirname(from);for(let i=1;i<level;i++)directory=path.posix.dirname(directory);prefixes=[directory];}
    const pieces=module.split('.').filter(Boolean);
    for(const prefix of prefixes){
      const stem=path.posix.join(prefix,...pieces),options=[stem+'.py',path.posix.join(stem,'__init__.py')];
      const found=options.find(exists);if(!found)continue;
      add(found,null,from);
      let directory=path.posix.dirname(found);
      while(directory && directory!=='.'){
        const init=directory+'/__init__.py';if(exists(init))add(init,null,found);directory=path.posix.dirname(directory);
      }
      return;
    }
    // External Python providers are checked by the existing runtime/loaded-source
    // verifier, never imported or substituted by this source parser.
  };
  const addNode = (specifier, from, optional=false) => {
    if(builtins.has(specifier) || specifier.startsWith('node:'))return;
    assert.ok(!specifier.includes('${'),'nonliteral module requires registered dynamic dependency');
    let target;
    try {target=createRequire(path.join(root,from)).resolve(specifier);} catch(error) {
      if(optional && !specifier.startsWith('.') && error.code==='MODULE_NOT_FOUND')return;
      throw new Error('unresolved static execution dependency '+specifier+' in '+from,{cause:error});
    }
    const relative=path.relative(root,target).split(path.sep).join('/');
    assert.ok(relative && !relative.startsWith('../') && !path.isAbsolute(relative),'dependency outside registered project');
    add(relative,null,from);
    if(!specifier.startsWith('.')){
      const parts=specifier.split('/'),pkg=specifier.startsWith('@')?parts.slice(0,2).join('/'):parts[0];
      let directory=path.dirname(target),found=false;
      while(directory.startsWith(root+path.sep)){
        const meta=path.join(directory,'package.json');
        if(fs.existsSync(meta)&&JSON.parse(fs.readFileSync(meta,'utf8')).name===pkg){
          add(path.relative(root,meta).split(path.sep).join('/'),null,from);found=true;break;
        }
        directory=path.dirname(directory);
      }
      assert.ok(found,'actual provider package manifest missing: '+specifier);
    }
  };
  while(pending.length){
    assert.ok(Date.now()<deadline,'read-only source collection deadline');
    const batch=pending.splice(0), pythonBatch=[];
    for(const name of batch){
      const binding=bind(name), raw=fs.readFileSync(path.join(root,name));
      assert.equal(binding.path,name);assert.equal(binding.sha256,digest(raw),'source changed during collection');
      assert.ok(raw.length<=1048576,'execution source file ceiling');seen.set(name,binding);
      collectedBytes+=raw.length;assert.ok(collectedBytes<=16777216,'complete execution source byte ceiling');
      if(name.endsWith('.py')){
        const deferredSurface=routeDeferredSurfaces[name]??null;
        if(deferredSurface)assert.equal(digest(raw),deferredSurface.sha256,'reviewed late import source changed: '+name);
        pythonBatch.push({path:name,source:raw.toString('utf8'),deferredSurface});continue;
      }
      if(!/\.(?:mjs|cjs|js|ts|tsx)$/u.test(name))continue;
      for(const edge of nodeImports(raw.toString('utf8'),{sourcePath:name,edges:true}))addNode(edge.value,name,edge.optional);
    }
    if(pythonBatch.length){
      assert.equal(typeof python,'string');assert.ok(path.isAbsolute(python),'bound Python required for AST parsing');
      const parsed=spawnSync(python,['-I','-B','-X','utf8','-c',pythonAst],{input:JSON.stringify(pythonBatch),encoding:'utf8',
        timeout:Math.max(1,deadline-Date.now()),maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
      assert.equal(parsed.status,0,'read-only Python AST parse failed: '+String(parsed.stderr).slice(0,2048));
      for(const row of JSON.parse(parsed.stdout)){
        if(row.excludedLateImports.length)deferredImportEvidence.push({path:row.path,
          registration:routeDeferredSurfaces[row.path],excludedLateImports:row.excludedLateImports});
        for(const item of row.imports){
          if(item.scope)includedLateImports.push({path:row.path,...item});
          addPython(item.module,row.path,item.level);
          for(const name of item.names)if(name!=='*')addPython([item.module,name].filter(Boolean).join('.'),row.path,item.level);
        }
      }
    }
  }
  // Complete the bounded read-only graph before refusing it, so a failure
  // reports the precise deficit. No oversized closure can be committed.
  if(seen.size>maximumEntries){
    const error=new Error('complete actual execution closure exceeds256 entries: '+seen.size+' (deficit '+(seen.size-maximumEntries)+')');
    Object.assign(error,{sourcePaths:[...seen.keys()],sourceEdges,collectedBytes,boundSourceCount:seen.size,maximumEntries,deficit:seen.size-maximumEntries});
    throw error;
  }
  const result={};let bytes=0;
  for(const [name,binding] of [...seen].sort(([a],[b])=>a.localeCompare(b))){
    const raw=fs.readFileSync(path.join(root,name));assert.equal(digest(raw),binding.sha256,'source changed before closure commit');bytes+=raw.length;
    assert.ok(bytes<=16777216,'complete execution source byte ceiling');
    result[roles.get(name)??('source-'+digest(Buffer.from(name)).slice(0,24))]=binding;
  }
  assert.equal(Object.keys(result).length,seen.size,'source role collision');
  lastSourceCollectionReport={schemaVersion:'decode1-entry-weight-quality-source-collection-report-v1',
    capabilityVersion,sourceCount:seen.size,totalBytes:bytes,sourceEdges,
    deferredImportEvidence,includedLateImports,loadedSourceRejection:'painter_stage4_object_support_structure_quality_worker_v1.verify_loaded_sources remains unchanged'};
  return result;
}

function nodeImports(source,{sourcePath=null,edges=false}={}){
  // The installed parser handles regular expressions, nested templates and TS
  // without evaluating any project source. Its own bytes join the closure.
  const tree=parse(source,{sourceType:'unambiguous',
    plugins:['typescript','jsx'],createImportExpressions:true});
  const imports=[];
  function visit(node,optional=false){
    if(!node || typeof node!=='object')return;
    // Sharp's installed loader has mutually exclusive native platform cases.
    // Bind the current platform case; foreign OS binaries cannot execute here.
    if(sourcePath==='node_modules/sharp/dist/sharp.cjs' && node.type==='SwitchStatement'
      && node.discriminant.type==='Identifier' && node.discriminant.name==='runtimePlatform'){
      assert.equal(process.platform,'win32','only the registered Windows runtime is supported');
      const selected=node.cases.find(c=>c.test?.type==='StringLiteral'&&c.test.value===process.platform+'-'+process.arch);
      assert.ok(selected,'installed native image provider has no exact platform case');
      selected.consequent.forEach(child=>visit(child,optional));return;
    }
    if(node.type==='TryStatement' && node.handler){
      visit(node.block,true);visit(node.handler,optional);visit(node.finalizer,optional);return;
    }
    if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)
      && node.source?.type==='StringLiteral')imports.push({start:node.start,value:node.source.value,optional:false});
    if(node.type==='CallExpression' && node.callee?.type==='Identifier'
      && ['require','requireSource'].includes(node.callee.name) && node.arguments.length===1
      && node.arguments[0].type==='StringLiteral')imports.push({start:node.start,value:node.arguments[0].value,optional});
    for(const [key,value]of Object.entries(node)){
      if(['loc','start','end','extra','comments','tokens'].includes(key))continue;
      if(Array.isArray(value))value.forEach(child=>visit(child,optional));else if(value&&typeof value==='object')visit(value,optional);
    }
  }
  visit(tree.program);const sorted=imports.sort((a,b)=>a.start-b.start);return edges?sorted:sorted.map(v=>v.value);
}

const roleCache=new Map();
function requiredProgramRoles({root,python,capabilityVersion,authPath}){
  const source=fs.readFileSync(path.join(root,authPath)),before=digest(source),key=[root,python,capabilityVersion,before].join('|');
  if(roleCache.has(key))return {...roleCache.get(key)};
  const code="import json,sys;from pathlib import Path;root=Path(sys.argv[1]);sys.path[:0]=[str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/src')];import decode1_entry_weight_quality_auth_v1 as auth;print(json.dumps(auth.required_program_roles(sys.argv[2]),sort_keys=True))";
  const call=spawnSync(python,['-I','-B','-c',code,root,capabilityVersion],{encoding:'utf8',timeout:15000,maxBuffer:1048576,windowsHide:true,
    env:{...process.env,OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}});
  assert.equal(call.status,0,'registered read-only role query failed: '+String(call.stderr).slice(0,256));
  assert.equal(digest(fs.readFileSync(path.join(root,authPath))),before,'auth changed across role query');
  const roles=JSON.parse(call.stdout);assert.ok(roles&&typeof roles==='object'&&!Array.isArray(roles));
  roleCache.set(key,Object.freeze({...roles}));return {...roles};
}

export {collectActualExecutionSources,requiredProgramRoles,nodeImports};


