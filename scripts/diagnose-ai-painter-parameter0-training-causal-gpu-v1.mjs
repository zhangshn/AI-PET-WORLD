// One authenticated zero-update diagnostic; no training, repair or retry.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createRequire,builtinModules} from "node:module";
import {nodeImports} from "./lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs";
import {createReader} from "./lib/ai-painter-stage4-dataset-audit.mjs";
import {runParameter60OwnedWorker,validateParameter60NativeProof} from "./lib/ai-painter-parameter60-owned-worker-v1.mjs";
import {readCurrentExecutionRegistry, prepareCurrentExecutionRegistryAdvance, finalizePreparedCurrentExecutionRegistryAdvance} from "../src/server/ai-painter-current-execution-registry.mjs";

const SELF=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(SELF),"..");
export let POLICY=Object.freeze({path:"data/ai-painter/system-governance/ai-painter-parameter0-training-causal-gpu-policy-v1.json",sha256:null});
export function bindPolicy(binding){
  assert.equal(binding?.path,"data/ai-painter/system-governance/ai-painter-parameter0-training-causal-gpu-policy-v1.json","registered policy path required");
  assert(/^[a-f0-9]{64}$/.test(binding.sha256),"explicit policy SHA required");
  if(POLICY.sha256!==null)assert.equal(binding.path,POLICY.path,"policy route cannot change");
  if(POLICY.sha256!==null)assert.equal(binding.sha256,POLICY.sha256,"policy binding cannot change");
  POLICY=Object.freeze({path:binding.path,sha256:binding.sha256}); return POLICY;
}
const digest=b=>crypto.createHash("sha256").update(b).digest("hex");
export const CAPABILITY="parameter0_training_causal_zero_update_v1";
export const OUTPUT_ROOT=".runtime/ai-painter/parameter0-training-causal-gpu-runs";
export const SOURCE_RUN="d2o-p0c-v1-b1b09f3e-1822-4a4d-b9f7-2f47a4585ad5";
export const SOURCE_SAMPLE="ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2";
export const SOURCE_ROOT=".runtime/ai-painter/registered-training-d2o-p0c-v1-executions/"+SOURCE_RUN+"/";
export const OWN=Object.freeze([
  "scripts/diagnose-ai-painter-parameter0-training-causal-gpu-v1.mjs",
  "scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs",
  "scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs",
  "scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs",
  "scripts/lib/real-earth-region-governance.mjs",
  "src/server/ai-painter-current-execution-registry.mjs",
  "ml/ai-painter/scripts/diagnose_parameter0_training_causal_gpu_v1.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_causal_restore_v1.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_causal_observation_v1.py",
  "ml/ai-painter/tests/test_diagnose_parameter0_training_causal_gpu_v1.py",
  "ml/ai-painter/tests/test_parameter0_training_causal_observation_v1.py",
  "ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_restore_v1.py",
  "scripts/tests/ai-painter-parameter0-training-causal-gpu-v1.test.mjs",
  "scripts/lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs",
]);
const RESERVE=65536;
export function validateGpuPolicy(p){
  assert.equal(p.schemaVersion,"ai-painter-parameter0-training-causal-gpu-policy-v1");
  assert.equal(p.status,"registered_one_shot_zero_update_diagnostic_not_training");
  assert.equal(p.formalSpecification.path,"docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md");
  assert.equal(p.formalSpecification.version,"AI-PAINTER-SPEC-1.122");
  assert.equal(p.formalSpecification.clause,"15.14");
  assert(/^[a-f0-9]{64}$/.test(p.formalSpecification.sha256));
  assert.equal(p.scope.failureSampleId,SOURCE_SAMPLE);
  assert.equal(p.scope.sampleSplit,"train"); assert.equal(p.scope.sampleCount,1);
  assert.deepEqual(p.scope.resolution,[256,192]);
  assert.equal(p.scope.sourceStateTiming,"after_exception");
  assert.equal(p.sourceStateUse.trainingInitializationAllowed,false);
  assert.equal(p.sourceStateUse.historicalReplayAllowed,false);
  assert.equal(p.target.parameterIndex,0);
  assert.equal(p.scope.failureRunId,SOURCE_RUN);
  assert.deepEqual(p.sourceFailurePosition,{epoch:1,zeroBasedEpochPosition:14,trainIndex:8,sampleId:SOURCE_SAMPLE});
  assert.deepEqual(p.sourceOptimizerSteps,{generator:14,discriminator:15});
  assert.deepEqual(p.target.coordinates,[[1,13,0,0]]);
  assert.equal(p.target.captureInputChannel,13);assert.equal(p.target.captureOutputChannel,1);
  assert.equal(p.modelCapabilityVersion,"stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1");
  assert.equal(p.objectSupportStructureWeight,1);
  assert.equal(p.capabilityVersion,CAPABILITY);
  assert.equal(p.workerPath,"ml/ai-painter/scripts/diagnose_parameter0_training_causal_gpu_v1.py");
  assert.equal(p.entrypointPath,'scripts/diagnose-ai-painter-parameter0-training-causal-gpu-v1.mjs');
  assert.deepEqual(p.testPaths,[
    'ml/ai-painter/tests/test_parameter0_training_causal_observation_v1.py',
    'ml/ai-painter/tests/test_diagnose_parameter0_training_causal_gpu_v1.py',
    'scripts/tests/ai-painter-parameter0-training-causal-gpu-v1.test.mjs']);
  assert.deepEqual(p.sourceEvidence.map(b=>b.path),['quality-plan.json','model-identity.json','worker-terminal.json',
    'gradient-failure/manifest.json','gradient-failure/primary.json','capture-execution.json'].map(p=>SOURCE_ROOT+p));
  assert.deepEqual(p.sourceTensorArchive,{path:SOURCE_ROOT+'gradient-failure/tensors.pt',
    sha256:'39fc29fa80f8f425fcb400a07c45ec1d604b803e98e82c56116b6a96c56c8dcf',bytes:50447477});
  assert.equal(p.target.parameterName,"core.core.terrain.base_stem.layers.0.weight");
  assert.deepEqual(p.target.weightShape,[48,31,3,3]);
  assert.equal(p.comparison.atol,1e-6); assert.equal(p.comparison.rtol,1e-5);
  assert.equal(p.comparison.originalGateKept,true);
  assert.deepEqual(p.metadataCanonicalProgram,{path:"scripts/lib/real-earth-region-governance.mjs",sha256:"c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1"});
  assert.equal(typeof p.nodeInterpreter?.path,"string");assert(/^[a-f0-9]{64}$/.test(p.nodeInterpreter.sha256));
  assert.equal(p.comparison.originalGradientValuesKept,true);
  assert.equal(p.sourceStateUse.archivedGradientsInstalled,false);assert.equal(p.sourceStateUse.archivedRngRestored,false);
  assert.equal(p.captureRestrictions.persistSecondFullModelOrGlobalGradientSnapshot,false);
  assert.deepEqual(p.counts,{fullGeneratorForward:1,fullGeneratorAutograd:5,discriminatorAutograd:0,
    optimizerConstruction:0,optimizerUpdates:0,localFp64WeightVjp:5,extraNativeBackwardReplay:0,extraModelAutograd:0});
  assert.deepEqual(p.resources,{maxWallSeconds:180,threads:2,maxGpuMemoryFraction:0.7,maximumTemperatureC:85,
    minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,maxOutputBytes:134217728,maxTargetCaptureBytes:67108864,
    attempts:1,automaticRetries:0,maxStreamBytes:8388608,cleanupReserveMs:1000,
    failureEvidenceReserveBytes:65536,temperaturePollMs:1000,cpuPreflightMaxWallSeconds:120,
    cpuPreflightMaxOutputBytes:8388608,finalizationReserveMs:8000,maxTargetPersistedBytes:2097152});
  assert.equal(p.cleanup.transport,"bounded-stream-capture-v2");
  assert.equal(p.cleanup.historicalObservationIsAuthority,false);
  assert.equal(p.registry.diagnosisIsTraining,false);
  assert.deepEqual(p.qualification,{gpuExecutionAllowed:false,trainingAllowed:false,modelModificationAllowed:false,checkpointWritten:false,rootCauseProven:false,stage4Qualified:false,capabilityReleased:false,runtimeFrameAllowed:false});
  assert.equal(p.outputRoot,OUTPUT_ROOT);
  assert.equal(p.attemptClaimPath,p.outputRoot+"/attempt-v1.json");
  assert.deepEqual(p.gradientLabels,["actualTotal","structuredObjective","wholeFrameFidelity","objectCoreRgb","objectSupportStructure"]);
  assert.deepEqual(p.cpuPreparation,{maxWallSeconds:120,threads:2,maxOutputBytes:8388608,attempts:1,automaticRetries:0,
    fullModelForwards:0,fullModelAutogradCalls:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0,
    scope:"bound archive/state/sample identity, synthetic observer and exact request ABI; no real forward"});
  return true;
}
export function validateCoordinateNarrative(policy){
 const coordinate=JSON.stringify(policy.target.coordinates[0]);
 assert.equal(policy.gateFailureContinuation?.localContrastPermittedOnlyIf?.[2],
  'The bound '+coordinate+' coordinate exceeds the unchanged original absolute/relative tolerance',
  'policy coordinate narrative conflicts with bound target');
 assert.equal(policy.captureRestrictions?.upstreamDifference,
  'Only channel'+policy.target.captureInputChannel+' input and channel'+policy.target.captureOutputChannel+
  ' output-adjoint planes for bound '+coordinate+'; no second full activation or global-gradient capture persisted. Fixed coordinate is not dynamically replaced.',
  'policy channel narrative conflicts with bound target');
}
export function requireDeadline(deadline,now=Date.now()){assert(now<deadline,"diagnostic total wall budget exhausted");}
export function byteBinding(binding){
  assert(binding&&typeof binding.path==="string"&&/^[a-f0-9]{64}$/.test(binding.sha256),"byte binding required");
  return {path:binding.path,sha256:binding.sha256};
}
export function directoryBytes(absolute){
  let bytes=0;
  for(const row of fs.readdirSync(absolute,{withFileTypes:true})){
    const file=path.join(absolute,row.name),st=fs.lstatSync(file);
    assert(!st.isSymbolicLink(),"private diagnostic output link refused");
    if(st.isDirectory())bytes+=directoryBytes(file);
    else{assert(st.isFile(),"unknown diagnostic output kind");bytes+=st.size;}
  }
  return bytes;
}
export function createOwnedAccounting(root,absolute,policy){
  let scope=null;
  const registryTransactions=new Set();
  const registryRoot=path.resolve(root,".runtime/ai-painter/current-execution-registry");
  const registryShared=["registry.sqlite","registry.sqlite-journal","registry.sqlite-wal","events.jsonl","writer.claim.json"];
  const fileBytes=file=>{if(!fs.existsSync(file))return 0;const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());return st.size;};
  const registryBaseline=new Map(registryShared.map(name=>[name,fileBytes(path.join(registryRoot,name))]));
  const guardRoot=path.resolve(root,".runtime/ai-painter/owned-worker-guards");
  const observe=value=>{
    const id=value.guardRecord?.identity;
    assert(/^[a-f0-9-]{36}$/.test(id),"actual invocation guard identity required");
    assert.equal(path.resolve(value.nativeBuildDirectory),path.join(guardRoot,id+"-native"));
    for(const [key,suffix] of [["startedEvidence","-started.json"],["terminalEvidence","-terminal.json"],["terminalPath","-guard-terminal.json"]])
      assert.equal(path.resolve(value.guard[key]),path.join(guardRoot,id+suffix));
    scope=value;
  };
  const measure=(streamBytes=null)=>{
    let nativeBytes=0;
    if(scope){
      nativeBytes+=directoryBytes(scope.nativeBuildDirectory);
      for(const file of [scope.guard.startedEvidence,scope.guard.terminalEvidence,scope.guard.terminalPath]){
        if(fs.existsSync(file)){const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());nativeBytes+=st.size;}
      }
    }
    if(streamBytes===null){const live=scope?.getStreamBytes?.()??{stdout:0,stderr:0};streamBytes=live.stdout+live.stderr;}
    assert(Number.isSafeInteger(streamBytes)&&streamBytes>=0&&streamBytes<=policy.resources.maxStreamBytes);
    const diagnosticBytes=directoryBytes(absolute);
    const sharedNames=path.basename(absolute).startsWith("parameter0-training-cpu-current-")
      ?["cpu-preparation-attempt-v1.json","current-cpu-acceptance.json"]:["attempt-v1.json"];
    const phaseSharedBytes=sharedNames.reduce((n,name)=>n+fileBytes(path.join(root,policy.outputRoot,name)),0);
    let registryBytes=0;for(const logical of registryTransactions)registryBytes+=directoryBytes(path.join(root,logical));
    for(const name of registryShared)registryBytes+=Math.max(0,fileBytes(path.join(registryRoot,name))-registryBaseline.get(name));
    return {diagnosticBytes,nativeBytes,registryBytes,phaseSharedBytes,streamBytes,totalBytes:diagnosticBytes+nativeBytes+registryBytes+phaseSharedBytes+streamBytes};
  };
  let closingFailure=false,atomicCopyBytes=0;
  const requireBudget=(streamBytes=null)=>{
    const value=measure(streamBytes);
    value.atomicCopyBytes=atomicCopyBytes;value.totalBytes+=atomicCopyBytes;
    assert(value.totalBytes<=policy.resources.maxOutputBytes-(closingFailure?0:RESERVE),"diagnostic complete output quota exceeded");
    return value;
  };
  const observeRegistryTransaction=logical=>{
    assert(/^\.runtime\/ai-painter\/current-execution-registry\/transactions\/current-execution-registry-advance-[a-zA-Z0-9-]+$/.test(logical),"actual prepared registry transaction required");
    registryTransactions.add(logical);
  };
  return {observe,measure:()=>{const value=measure();return {...value,atomicCopyBytes,totalBytes:value.totalBytes+atomicCopyBytes};},
    requireBudget,observeRegistryTransaction,maximum:policy.resources.maxOutputBytes,
    beginFailureClosure(){closingFailure=true;},
    beforeAtomicWrite(_logical,bytes){assert(Number.isSafeInteger(bytes)&&bytes>=0);const current=requireBudget();
      assert(current.totalBytes+bytes<=policy.resources.maxOutputBytes-(closingFailure?0:RESERVE),"registry atomic copy exceeds total quota");atomicCopyBytes+=bytes;}};
}
async function publishRegistry(options,accounting){
  requireDeadline(options.deadlineUnixMs);
  const prepared=await prepareCurrentExecutionRegistryAdvance(options);
  assert(prepared.ok,prepared.errorCode);
  let result;
  try {
    accounting.observeRegistryTransaction(prepared.transactionRoot);accounting.requireBudget();
    requireDeadline(options.deadlineUnixMs);
    result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:options.projectRoot,
    transactionId:prepared.transactionId,deadlineUnixMs:options.deadlineUnixMs,beforeAtomicWrite:accounting.beforeAtomicWrite});
    assert(result.ok,result.errorCode);
    requireDeadline(options.deadlineUnixMs);return result;
  }catch(error){error.registryTransactionId=prepared.transactionId;error.registryTransactionRoot=prepared.transactionRoot;throw error;}
}
function environment(root,cpu){
  return {...process.env,CUDA_VISIBLE_DEVICES:cpu?"":"0",PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1",
    PYTHONPATH:[path.join(root,"ml/ai-painter/src"),path.join(root,"ml/ai-painter/scripts")].join(path.delimiter),
    OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2"};
}
export function frozenInactiveFunctions(logical,bytes,expected){
  if(logical==='ml/ai-painter/src/ai_painter/complete_world/parameter60_causal_restore_v1.py'){
    const original='edb87370b17ff1760b5dd812877a64c33fbbdc39199821b0ae31b9c6d9e71547';
    assert.equal(expected?.sha256,original);assert.equal(digest(bytes),original);
    // The new fixed restore imports only _state_plan/_restore_network/
    // _preserve_current_rng. Its own RGB factory is an explicit closure root;
    // the legacy parameter60 factory is never called and grants no admission.
    return ['_fresh_networks'];
  }
  if(logical==="ml/ai-painter/src/ai_painter/complete_world/split_release.py"){
    const splitSha="d6e05cf98a7902592d1b6518968eedb72961a57872d67a6e0695a4572101d7ea";
    assert.equal(expected?.sha256,splitSha,"inactive split loader requires exact original binding");
    assert.equal(digest(bytes),splitSha,"inactive split loader source changed");
    // This single-row diagnostic calls the bound original raster loader,
    // never load_package, prepare_metadata or the release builder.
    return ["load_package"];
  }
  if(logical==="ml/ai-painter/src/ai_painter/complete_world/object_support_structure_failure_capture_v1.py"){
    const captureSha="6363c4065b9dbec4376594d56664d6c0ecfdb395df61879f9045b2e75cb9e153";
    assert.equal(expected?.sha256,captureSha,"inactive capture branch requires exact original binding");
    assert.equal(digest(bytes),captureSha,"inactive capture branch source changed");
    // The diagnosis accepts at most256 original program roles. This exact
    // function only serves the distinct257..260 joint package, never this route.
    // Its bytes remain bound; runtime imports still undergo _verify_imports.
    return ["_joint_program_limit"];
  }
  const source="ml/ai-painter/src/ai_painter/complete_world/object_appearance_regime_detail_weight_precision.py";
  const sha="1a5468eb982e786c819861740fdd2921ef4873cebe2145c9d6e27507f70dafa9";
  if(logical!==source)return [];
  assert.equal(expected?.sha256,sha,"inactive-route exclusion requires exact original source binding");
  assert.equal(digest(bytes),sha,"inactive-route exclusion source changed");
  // Neither entry is used by the exact fresh factory, state-copy primitives or
  // one original G phase. Their bytes remain bound. Any unexpectedly imported
  // project module still fails the worker's loaded-module verification.
  return ["authenticate_diagnostic_capture","_install_diagnostic_capture"];
}
export function collectPythonClosure(root,reader,original,algorithms,deadline){
  const index=new Map();
  for(const b of Object.values(original))if(b.path.startsWith("ml/ai-painter/")&&b.path.endsWith(".py")){
    if(index.has(b.path))assert.equal(index.get(b.path).sha256,b.sha256,"original Python binding collision");
    index.set(b.path,b);
  }
  for(const item of algorithms){const b=item.binding;
    if(index.has(b.path))assert.equal(index.get(b.path).sha256,b.sha256,"algorithm source collision");
    index.set(b.path,b);
  }
  const dedicated=OWN.filter(p=>p.endsWith(".py")),profile="ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py";
  // CPU fixtures are execution roots too; appending their bytes alone misses imports.
  const roots=[...dedicated,profile];
  const pending=[...roots],seen=new Set(),result=new Map(),importOrigins=new Map();
  const python=path.join(root,"ml/ai-painter/.venv/Scripts/python.exe");
  // Pure bounded AST parsing: also resolve package-imported submodules and
  // distinguish literal stdlib imports from genuine dynamic profile dispatch.
  const parser=`import ast,json,sys
r=json.load(sys.stdin); result=[]
class Imports(ast.NodeVisitor):
 def __init__(self): self.scope=[]
 def visit_FunctionDef(self,n):
  if n.name not in r['inactiveFunctions']:
   self.scope.append(n.name); self.generic_visit(n); self.scope.pop()
 visit_AsyncFunctionDef=visit_FunctionDef
 def visit_Import(self,n):
  result.extend(dict(kind='python_static',specifier=a.name) for a in n.names)
 def visit_ImportFrom(self,n):
  p='.'*n.level+(n.module or '')
  if n.module: result.append(dict(kind='python_static',specifier=p))
  for a in n.names:
   if a.name!='*': result.append(dict(kind='python_static',specifier=p+('.' if n.module else '')+a.name))
 def visit_Call(self,n):
  f=n.func; k=f.id if isinstance(f,ast.Name) else f.attr if isinstance(f,ast.Attribute) else ''
  if k in ('__import__','import_module','spec_from_file_location'):
   if k!='spec_from_file_location' and n.args and isinstance(n.args[0],ast.Constant) and isinstance(n.args[0].value,str):
    result.append(dict(kind='python_static',specifier=n.args[0].value))
   else: result.append(dict(kind='nonliteral_dynamic',specifier='dynamic',scope='.'.join(self.scope),expression=ast.unparse(n)))
  self.generic_visit(n)
Imports().visit(ast.parse(r['source'],filename=r['logicalPath']))
json.dump(result,sys.stdout,separators=(',',':'))`;
  const dynamic=new Map([
    ['ml/ai-painter/src/ai_painter/complete_world/parameter0_training_causal_restore_v1.py',new Map([['_fresh_networks','importlib.import_module(path.stem)']])],
    ['ml/ai-painter/scripts/diagnose_parameter0_training_causal_gpu_v1.py',new Map([['_profile','importlib.import_module(path.stem)'],['run_cpu_component_tests','importlib.import_module(Path(logical).stem)']])]
  ]);
  function resolve(importer,specifier){
    const dots=specifier.match(/^[.]+/)?.[0].length??0,parts=specifier.replace(/^[.]+/,"").split(".");
    let bases;
    if(dots){let base=path.posix.dirname(importer);for(let n=1;n<dots;n++)base=path.posix.dirname(base);bases=[path.posix.join(base,...parts)];}
    else bases=[path.posix.join("ml/ai-painter/scripts",...parts),path.posix.join("ml/ai-painter/src",...parts)];
    for(const base of bases)for(const candidate of [base+".py",base+"/__init__.py"])
      if(fs.existsSync(path.join(root,candidate)))return candidate;
    return null;
  }
  while(pending.length){
    requireDeadline(deadline);const logical=pending.shift();if(seen.has(logical))continue;seen.add(logical);
    assert(seen.size<=256,"Python import closure count limit");
    const expected=index.get(logical);
    assert(expected||dedicated.includes(logical)||logical.endsWith("/__init__.py"),"unbound original Python import: "+logical+" from "+(importOrigins.get(logical)??"root"));
    const bytes=reader.bytes(logical,expected?.sha256);assert(bytes.length<=1048576,"Python source byte bound");
    if(!expected&&!dedicated.includes(logical))assert.equal(bytes.length,0,"unbound nonempty package initializer");
    result.set(logical,{path:logical,sha256:digest(bytes)});
    const parsed=JSON.parse(execFileSync(python,["-B","-c",parser],{
      input:JSON.stringify({source:bytes.toString("utf8"),logicalPath:logical,inactiveFunctions:frozenInactiveFunctions(logical,bytes,expected)}),encoding:"utf8",windowsHide:true,
      timeout:Math.max(1,Math.min(3000,deadline-Date.now())),maxBuffer:4194304,
      env:{...process.env,PYTHONUTF8:"1",PYTHONIOENCODING:"utf-8",PYTHONDONTWRITEBYTECODE:"1",OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2"}}));
    assert(Array.isArray(parsed),"Python import AST shape");
    for(const imported of parsed){
      if(imported.kind==="nonliteral_dynamic"){
        // These exact three dispatch sites load the explicit profile/test roots.
        // A historical source binding is never a wildcard dynamic-import permit.
        assert.equal(dynamic.get(logical)?.get(imported.scope),imported.expression,
          'unregistered dynamic Python import: '+logical+':'+imported.scope);continue;
      }
      assert.equal(imported.kind,"python_static");const target=resolve(logical,imported.specifier);if(!target)continue;
      if(!importOrigins.has(target))importOrigins.set(target,logical);pending.push(target);
      let folder=path.posix.dirname(target);
      while(folder.startsWith("ml/ai-painter/src/")){
        const init=folder+"/__init__.py";if(fs.existsSync(path.join(root,init)))pending.push(init);folder=path.posix.dirname(folder);
      }
    }
  }
  requireDeadline(deadline);return [...result.values()];
}
export function collectNodeClosure(root,reader,roots,deadline){
  const pending=[...roots],seen=new Map(),edges=[];
  const builtins=new Set([...builtinModules,...builtinModules.map(x=>'node:'+x)]);
  function add(target,from){
    const logical=path.relative(root,target).split(path.sep).join('/');
    assert(logical&&!logical.startsWith('../')&&!path.isAbsolute(logical),'dependency outside project');
    edges.push({from,to:logical});if(!seen.has(logical)){seen.set(logical,null);pending.push(logical);}
  }
  for(const logical of roots)seen.set(logical,null);
  while(pending.length){
    requireDeadline(deadline);const logical=pending.shift();
    const bytes=reader.bytes(logical);assert(bytes.length<=1048576,'Node source individual byte limit');
    seen.set(logical,{path:logical,sha256:digest(bytes)});
    assert(seen.size<=256,'Node source count limit');
    if(!/\.(?:mjs|cjs|js|ts|tsx)$/.test(logical))continue;
    for(const item of nodeImports(bytes.toString('utf8'),{sourcePath:logical,edges:true})){
      if(builtins.has(item.value)||item.value.startsWith('node:'))continue;
      let target;
      try{target=createRequire(path.join(root,logical)).resolve(item.value);}
      catch(error){if(item.optional&&!item.value.startsWith('.')&&error.code==='MODULE_NOT_FOUND')continue;throw error;}
      add(target,logical);
      if(!item.value.startsWith('.')){
        const parts=item.value.split('/'),name=parts[0].startsWith('@')?parts.slice(0,2).join('/'):parts[0];
        let directory=path.dirname(target),found=false;
        while(directory.startsWith(root+path.sep)){
          const metadata=path.join(directory,'package.json');
          if(fs.existsSync(metadata)&&JSON.parse(fs.readFileSync(metadata,'utf8')).name===name){add(metadata,logical);found=true;break;}
          directory=path.dirname(directory);
        }
        assert(found,'actual provider manifest absent');
      }
    }
  }
  return {bindings:[...seen.values()],edges};
}
export function resolvePolicy(root,deadline=Date.now()+120000){
  assert(/^[a-f0-9]{64}$/.test(POLICY.sha256??""),"policy must be explicitly bound");
  const reader=createReader(root),policy=reader.bound(POLICY);validateGpuPolicy(policy);validateCoordinateNarrative(policy);
  reader.bytes(policy.formalSpecification.path,policy.formalSpecification.sha256);
  reader.bytes(policy.designBinding.path,policy.designBinding.sha256);
  const evidence=policy.sourceEvidence.map(b=>reader.bound(b));
  const sourcePlan=evidence[policy.sourceEvidence.findIndex(b=>b.path.endsWith("/quality-plan.json"))];
  const nodeInterpreter={path:process.execPath,sha256:digest(fs.readFileSync(process.execPath))};
  assert.equal(path.resolve(nodeInterpreter.path),path.resolve(sourcePlan.runtimeIdentity.node.absolutePath),"original Node path differs");
  assert.equal(nodeInterpreter.sha256,sourcePlan.runtimeIdentity.node.sha256,"original Node bytes differ");
  assert.deepEqual(policy.nodeInterpreter,nodeInterpreter,"policy Node binding differs");
  reader.bytes(policy.metadataCanonicalProgram.path,policy.metadataCanonicalProgram.sha256);
  assert.equal(policy.priorSavedGradientAlgebra.path,".runtime/ai-painter/controller-repair-reviews/training-failure-analysis-021-20261024/numeric/parameter0-analysis-001.json");
  const prior=reader.bound(byteBinding(policy.priorSavedGradientAlgebra));
  assert.equal(prior.runId,policy.scope.failureRunId);
  assert.equal(prior.status,"saved_tensor_evidence_analyzed");
  assert.equal(prior.qualificationGranted,false);assert.equal(prior.replayPerformed,false);
  assert.equal(prior.numeric.parameterIndex,0);assert.equal(prior.numeric.parameterName,policy.target.parameterName);
  assert.deepEqual(prior.numeric.shape,policy.target.weightShape);
  assert.deepEqual(prior.numeric.firstViolation.coordinate,[1,13,0,0]);
  assert.equal(prior.numeric.outsideToleranceElements,1);
  assert.deepEqual(prior.failurePosition,policy.sourceFailurePosition);
  assert.deepEqual(prior.optimizerStepsAtFailure,policy.sourceOptimizerSteps);
  const manifest=evidence[policy.sourceEvidence.findIndex(b=>b.path.endsWith("/gradient-failure/manifest.json"))];
  assert.equal(manifest.context.sampleId,policy.scope.failureSampleId);
  assert.equal(manifest.context.split,"train");
  assert.equal(manifest.stateTiming,"after_exception");
  assert.deepEqual(manifest.context.failurePosition,policy.sourceFailurePosition);
  assert.deepEqual(manifest.context.optimizerSteps,policy.sourceOptimizerSteps);
  assert.equal(sourcePlan.runId,SOURCE_RUN);
  const terminal=evidence[policy.sourceEvidence.findIndex(b=>b.path.endsWith('/worker-terminal.json'))];
  assert.equal(terminal.originalError.message,'actual four-term total gradient identity differs at parameter 0');
  assert.deepEqual(terminal.optimizerSteps,policy.sourceOptimizerSteps);
  assert.deepEqual(manifest.context.sampleBindings,policy.sourceSampleBindings);
  assert.deepEqual(manifest.artifacts.tensors,policy.sourceTensorArchive);
  assert.equal(sourcePlan.configuration.modelCapabilityVersion,policy.modelCapabilityVersion);
  assert.equal(sourcePlan.configuration.objectSupportStructureWeight,1);
  const lineage=new Map();
  for(const b of collectPythonClosure(root,reader,manifest.context.programBindings,policy.sourceAlgorithmBindings,deadline))lineage.set(b.path,b);
  for(const item of policy.sourceAlgorithmBindings)reader.bytes(item.binding.path,item.binding.sha256);
  const nodeClosure=collectNodeClosure(root,reader,OWN.filter(p=>!p.endsWith('.py')),deadline);
  for(const b of nodeClosure.bindings)lineage.set(b.path,b);
  assert(lineage.size<=256,"program count limit");
  assert([...lineage.values()].reduce((n,b)=>n+reader.bytes(b.path,b.sha256).length,0)<=16777216,"program total byte limit");
  reader.bytes(policy.sourceTensorArchive.path,policy.sourceTensorArchive.sha256);
  for(const b of Object.values(policy.sourceSampleBindings))reader.bytes(b.path,b.sha256);
  const python=path.join(root,"ml/ai-painter/.venv/Scripts/python.exe");
  const interpreter={path:python,sha256:digest(fs.readFileSync(python))};
  reader.verifyStable();
  return {reader,policy,lineage:[...lineage.values()].sort((a,b)=>a.path.localeCompare(b.path)),python,interpreter,nodeInterpreter,nodeClosure};
}
export function makeOutput(root,prefix,policy){
  const runId=prefix+"-"+crypto.randomUUID(),logical=policy.outputRoot+"/"+runId,absolute=path.join(root,logical);
  fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.mkdirSync(absolute);
  assert.equal(fs.realpathSync(absolute),path.join(fs.realpathSync(path.join(root,".runtime")),...policy.outputRoot.split("/").slice(1),runId));
  let completeAccounting=null;
  const put=(name,value,{failure=false,replace=false}={})=>{
    assert(/^[a-z-]+\.json$/.test(name),"private evidence name");
    const bytes=Buffer.from(JSON.stringify(value,null,2)+"\n");
    const previousBytes=completeAccounting?completeAccounting.measure().totalBytes:directoryBytes(absolute);
    const maximum=completeAccounting?.maximum??policy.resources.maxOutputBytes;
    assert(previousBytes+bytes.length<=maximum-(failure?0:RESERVE),"diagnostic complete evidence limit");
    const file=path.join(absolute,name);
    if(replace){const tmp=file+"."+crypto.randomUUID()+".tmp";fs.writeFileSync(tmp,bytes,{flag:"wx"});fs.renameSync(tmp,file);}
    else fs.writeFileSync(file,bytes,{flag:"wx"});
    return {path:logical+"/"+name,sha256:digest(bytes),bytes:bytes.length};
  };
  return {runId,logical,absolute,put,setAccounting(value){completeAccounting=value;}};
}
export function proofPassed(receipt){
  assert.equal(receipt?.cleanupConfirmed,true,"live managed cleanup required");
  assert.equal(receipt.guardReleaseConfirmed,true,"guard release must follow confirmed cleanup");
  assert.equal(receipt.ownerClosed,true,"owner closure required");
  assert.equal(receipt.emptyJob,true,"empty Job must derive from live process count");
  const observation={ownerClosed:receipt.ownerClosed,ownerExitCode:receipt.ownerExitCode,ownerSignal:receipt.ownerSignal,
    stdoutClosed:receipt.ownerPipeEOF?.stdout,stderrClosed:receipt.ownerPipeEOF?.stderr,protocolError:receipt.protocolError,ownerError:receipt.ownerError,
    forced:receipt.termination!==null,ownerPid:receipt.ownerIdentity.pid,bindingBase64:receipt.proof?.bindingBase64,
    stdoutBytes:receipt.streamBytes.stdout,stderrBytes:receipt.streamBytes.stderr,maxBuffer:8388608};
  assert.equal(validateParameter60NativeProof(receipt.proof,observation).valid,true,"complete native identity and closure proof required");
}
export function validateWorkerTerminal(value,cpu){
  assert(value&&typeof value==="object","worker result required");
  assert.equal(value.schemaVersion,'parameter0-training-causal-worker-result-v1');
  assert.equal(value.sampleId,SOURCE_SAMPLE);assert.equal(value.sourceStateTiming,'after_exception');
  assert.equal(value.trainingAllowed,false);assert.equal(value.stage4Qualified,false);
  assert.equal(value.historicalReplayAllowed,false);
  assert.equal(value.counts.optimizerConstruction,0);
  assert.equal(value.counts.optimizerUpdates,0);
  assert.equal(value.counts.discriminatorAutograd,0);
  for(const key of ["generatorForwards","generatorAutogradAttempts","generatorAutogradCompleted"])
    assert(Number.isSafeInteger(value.counts[key])&&value.counts[key]>=0,"invalid observed count: "+key);
  assert(value.counts.generatorAutogradCompleted<=value.counts.generatorAutogradAttempts);
  if(cpu){assert.equal(value.status,"cpu_preflight_passed_not_gpu_or_root_cause");
    assert.equal(value.counts.generatorForwards,0);assert.equal(value.counts.generatorAutogradAttempts,0);assert.equal(value.counts.cudaCalls,0);
    assert.equal(value.cpuComponentTests?.status,'passed');assert(Number.isSafeInteger(value.cpuComponentTests.testsRun)&&value.cpuComponentTests.testsRun>0);
    for(const key of ['failures','errors','skipped'])assert.equal(value.cpuComponentTests[key],0);
    assert.deepEqual([...value.cpuComponentTests.testPaths].sort(),OWN.filter(p=>p.startsWith('ml/ai-painter/tests/')).sort());}
  else {
    assert(["diagnostic_target_evidence_complete","diagnostic_not_reproduced","diagnostic_failed_closed"].includes(value.status));
    assert(value.counts.generatorForwards<=1&&value.counts.generatorAutogradAttempts<=5&&value.counts.generatorAutogradCompleted<=5);
    assert((value.counts.localFp64WeightVjp??0)<=5);
    assert(Number.isSafeInteger(value.counts.localFp64WeightVjp??0)&&(value.counts.localFp64WeightVjp??0)>=0);
    if(value.status==="diagnostic_not_reproduced")assert.equal(value.counts.localFp64WeightVjp??0,0);
    if(value.status!=="diagnostic_failed_closed"){
      assert.equal(value.counts.generatorForwards,1);assert.equal(value.counts.generatorAutogradCompleted,5);
      assert.equal(value.counts.generatorAutogradAttempts,5);
    }
    if(value.status==="diagnostic_target_evidence_complete")assert.equal(value.counts.localFp64WeightVjp,5);
    if(Object.hasOwn(value.counts,"localFp64WeightVjpAttempts")){
      assert(Number.isSafeInteger(value.counts.localFp64WeightVjpAttempts)&&value.counts.localFp64WeightVjpAttempts<=5
        &&value.counts.localFp64WeightVjpAttempts>=(value.counts.localFp64WeightVjp??0));
    }
  }
}
function failureRecord(error,context,result){
  const {put,runId}=context;
  try{return put("failure.json",{schemaVersion:"parameter0-training-causal-diagnostic-terminal-v1",runId,
    executionState:"failed_closed",status:"diagnostic_failed_closed",recordedAtUtc:new Date().toISOString(),
    error:String(error.stack??error).slice(0,16384),
    workerError:error.workerError??null,workerSecondaryErrors:error.workerSecondaryErrors??[],
    workerOutput:boundedFailureStream(error.stdout??result?.stdout),stderr:boundedFailureStream(error.stderr??result?.stderr),
    ownedReceipt:error.ownedReceipt??result?.ownedReceipt??null,
    startedAtUtc:context.startedAtUtc??null,endedAtUtc:new Date().toISOString(),
    elapsedMs:context.monotonicStarted===undefined?null:performance.now()-context.monotonicStarted,
    durationScope:context.durationScope??'managed_phase_including_authentication_transport_cleanup',
    registryTransactionId:error.registryTransactionId??null,registryTransactionRoot:error.registryTransactionRoot??null,
    trainingAllowed:false,stage4Qualified:false},{failure:true});}
  catch(secondary){error.secondaryEvidenceError=String(secondary.message);return null;}
}
export function verifyWorkerResult(reader,value,outputRoot,cpu){
  const binding=value.workerResult;byteBinding(binding);
  assert.equal(binding?.path,outputRoot+(cpu?'/cpu-worker-result.json':'/worker-result.json'));
  const raw=reader.bytes(binding.path,binding.sha256);
  assert.equal(raw.length,binding.bytes,'worker result byte count differs');
  const printed={...value};delete printed.workerResult;
  assert.deepEqual(JSON.parse(raw),printed,'worker stdout differs from bound result bytes');
}
export function workerFailureError(value,result){
  assert.equal(value.status,'diagnostic_failed_closed');
  assert.equal(typeof value.error?.type,'string','failed worker original error type absent');
  assert.equal(typeof value.error?.message,'string','failed worker original error message absent');
  assert(value.error.type.length>0&&value.error.type.length<=256&&value.error.message.length<=8192);
  assert(Array.isArray(value.secondaryErrors)&&value.secondaryErrors.length<=4);
  assert(value.secondaryErrors.every(item=>typeof item==='string'&&item.length<=2048));
  const error=new Error(value.error.message);error.name=value.error.type;
  return Object.assign(error,{workerError:{...value.error},workerSecondaryErrors:[...value.secondaryErrors],
    ownedReceipt:result.ownedReceipt,stdout:result.stdout,stderr:result.stderr});
}
function boundedFailureStream(raw){
  if(raw==null)return null;const bytes=Buffer.from(String(raw));
  return {text:bytes.subarray(0,16384).toString("utf8"),originalBytes:bytes.length,truncated:bytes.length>16384};
}
export function preserveFinalizationError(firstError,secondary,context,terminal){
  const original=firstError??secondary;
  original.evidence??=terminal;
  if(firstError)original.secondaryFinalizationError=String(secondary.stack??secondary).slice(0,8192);
  const value={schemaVersion:'parameter0-training-secondary-finalization-failure-v1',runId:context.runId,
    recordedAtUtc:new Date().toISOString(),originalError:String(original.stack??original).slice(0,8192),
    secondaryFinalizationError:firstError?original.secondaryFinalizationError:null,terminal,
    registryTransactionId:secondary.registryTransactionId??null,registryTransactionRoot:secondary.registryTransactionRoot??null,
    cleanupAuthorityGranted:false,automaticRetries:0};
  try{original.secondaryFinalizationEvidence=context.put('finalization-failure.json',value,{failure:true});}
  catch(e){original.secondaryEvidenceError=[original.secondaryEvidenceError,String(e.stack??e).slice(0,2048)].filter(Boolean).join('\n');}
  return original;
}
export function resourceStopReason(current,expectedUuid,freeDiskBytes){
  const failed=[];
  if(current.uuid!==expectedUuid)failed.push('gpu_identity');
  if(current.temperatureC>=85)failed.push('temperature');
  if(current.freeMiB<2048)failed.push('free_vram');
  if(freeDiskBytes<2048*1048576)failed.push('free_disk');
  return failed.length?JSON.stringify({reason:'diagnostic_resource_protection',sample:current,freeDiskBytes,failed}):null;
}
async function emptyRegistry(root,deadlineUnixMs){
  const value=await readCurrentExecutionRegistry(root,{deadlineUnixMs});
  assert(value.ok,"verified registry required: "+value.errorCode);assert.equal(value.registry.activeExecution,null,"active execution refused");
  assert(!fs.existsSync(path.join(root,".runtime/ai-painter/owned-worker-guards/active.json")),"existing guard refused; no cleanup inferred");
  return value;
}
export async function runCpuPreflight(root=ROOT,policyBinding=POLICY){
  bindPolicy(policyBinding);
  const cpuClaim=path.join(root,OUTPUT_ROOT,"cpu-preparation-attempt-v1.json");
  assert(!fs.existsSync(cpuClaim),"CPU preparation already consumed; no retry");
  const start=Date.now(),monotonicStarted=performance.now(),bound=resolvePolicy(root,start+120000),{policy,reader,lineage,python,interpreter}=bound;
  const deadline=start+policy.cpuPreparation.maxWallSeconds*1000;
  const registry=await emptyRegistry(root,deadline),context=makeOutput(root,"parameter0-training-cpu-current",policy);
  Object.assign(context,{startedAtUtc:new Date(start).toISOString(),monotonicStarted,
    durationScope:'managed_cpu_preparation_including_authentication_restore_sample_components_transport_cleanup'});
  const {put,runId,logical}=context;
  fs.writeFileSync(cpuClaim,JSON.stringify({schemaVersion:"parameter0-training-cpu-preparation-single-attempt-v1",runId,policy:POLICY,
    recordedAtUtc:new Date().toISOString(),automaticRetries:0})+"\n",{flag:"wx"});
  const cpuAccountingPolicy={...policy,resources:{...policy.resources,maxOutputBytes:policy.cpuPreparation.maxOutputBytes}};
  const accounting=createOwnedAccounting(root,context.absolute,cpuAccountingPolicy);
  context.setAccounting(accounting);
  const request={schemaVersion:"parameter0-training-causal-gpu-request-v1",runId,outputRoot:logical,policy:POLICY,
    programBindings:lineage,interpreter,nodeInterpreter:bound.nodeInterpreter,deadlineUnixMs:deadline-policy.resources.finalizationReserveMs,mode:"cpu_preflight"};
  const requestBinding=put("request.json",request);
  let result;
  try{
    result=await runParameter60OwnedWorker(python,["-B",path.join(root,policy.workerPath),"--cpu-preflight","--request",requestBinding.path,"--request-sha256",requestBinding.sha256],
      {cwd:root,env:environment(root,true),timeout:deadline-Date.now()-policy.resources.finalizationReserveMs,maxBuffer:policy.resources.maxStreamBytes,
        onSpawn:accounting.observe,abortReason:()=>{accounting.requireBudget();const disk=fs.statfsSync(context.absolute);
          if(disk.bavail*disk.bsize<2048*1048576)return 'CPU free disk below2048MiB';
          return Date.now()>=deadline-policy.resources.finalizationReserveMs?"CPU execution/cleanup deadline":null;}});
    const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateWorkerTerminal(value,true);
    verifyWorkerResult(reader,value,logical,true);proofPassed(result.ownedReceipt);
    reader.verifyStable();requireDeadline(deadline);
    const current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(current.ok&&current.registrySha256===registry.registrySha256,"CPU registry changed");
    const report=put("cpu-acceptance.json",{schemaVersion:"parameter0-training-current-cpu-acceptance-v1",status:"current_cpu_accepted_not_gpu_result",
      runId,request:requestBinding,policy:POLICY,programBindings:lineage,interpreter,nodeInterpreter:bound.nodeInterpreter,worker:value,
      ownedReceipt:result.ownedReceipt,outputAccounting:accounting.requireBudget(result.ownedReceipt.streamBytes.stdout+result.ownedReceipt.streamBytes.stderr),
      registrySha256:registry.registrySha256,elapsedMs:performance.now()-monotonicStarted,
      startedAtUtc:new Date(start).toISOString(),endedAtUtc:new Date().toISOString(),durationScope:'managed_cpu_preparation_including_authentication_restore_sample_components_transport_cleanup'});
    accounting.requireBudget();
    requireDeadline(deadline);
    const pointer=path.join(root,policy.outputRoot,"current-cpu-acceptance.json"),tmp=pointer+"."+crypto.randomUUID()+".tmp";
    const pointerBytes=Buffer.from(JSON.stringify(report)+"\n");
    assert(accounting.requireBudget().totalBytes+pointerBytes.length<=policy.cpuPreparation.maxOutputBytes-RESERVE,"CPU pointer quota");
    fs.writeFileSync(tmp,pointerBytes,{flag:"wx"});fs.renameSync(tmp,pointer);
    accounting.requireBudget();requireDeadline(deadline);
    return report;
  }catch(error){error.evidence=failureRecord(error,context,result);throw error;}
}
export function currentCpuAcceptance(root,bound){
  const {policy,reader,lineage,interpreter,nodeInterpreter}=bound;
  const pointer=JSON.parse(fs.readFileSync(path.join(root,policy.outputRoot,"current-cpu-acceptance.json"),"utf8"));
  assert(pointer.path.startsWith(policy.outputRoot+"/parameter0-training-cpu-current-")&&pointer.path.endsWith("/cpu-acceptance.json"));
  const value=reader.bound(pointer);assert.equal(value.status,"current_cpu_accepted_not_gpu_result");
  assert.deepEqual(value.policy,POLICY);assert.deepEqual(value.programBindings,lineage);assert.deepEqual(value.interpreter,interpreter);assert.deepEqual(value.nodeInterpreter,nodeInterpreter);
  assert.equal(value.worker.runId,value.runId);assert(pointer.path.includes("/"+value.runId+"/"));
  const request=reader.bound(value.request);
  assert.equal(request.schemaVersion,"parameter0-training-causal-gpu-request-v1");assert.equal(request.mode,"cpu_preflight");
  assert.equal(request.runId,value.runId);assert.equal(request.outputRoot,policy.outputRoot+"/"+value.runId);
  assert.deepEqual(request.policy,POLICY);assert.deepEqual(request.programBindings,lineage);assert.deepEqual(request.interpreter,interpreter);assert.deepEqual(request.nodeInterpreter,nodeInterpreter);
  const receipt=value.ownedReceipt,proof=receipt.proof;
  assert.equal(proof.exitCode,0,"CPU execution must actually succeed");assert.equal(proof.stopReason,null);
  assert.equal(receipt.firstStop,null);assert.equal(receipt.primaryError,null);
  verifyWorkerResult(reader,value.worker,request.outputRoot,true);
  const binding=JSON.parse(Buffer.from(proof.bindingBase64,"base64").toString("utf8"));
  assert.equal(binding.guard.identity,receipt.guard.identity);
  const startedRecord=JSON.parse(fs.readFileSync(receipt.guard.startedEvidence,"utf8"));
  assert.equal(startedRecord.runnerPid,binding.guard.runnerPid);assert.equal(startedRecord.ownerIdentity.pid,proof.ownerPid);
  assert.equal(startedRecord.bindingBase64,proof.bindingBase64);assert.deepEqual(startedRecord.ownerIdentity,receipt.ownerIdentity);
  assert.equal(receipt.ownerIdentity.executable,binding.nativeBuild.binary);
  assert.equal(binding.guard.executableSha256,interpreter.sha256);assert.equal(path.resolve(binding.guard.executable),path.resolve(interpreter.path));
  assert.equal(binding.guard.helperSha256,digest(reader.bytes('scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs')),'CPU native helper source differs');
  assert.equal(binding.nativeBuild.source.sha256,digest(reader.bytes('scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs')),'CPU native source differs');
  assert.equal(binding.scope,path.resolve(root));
  const expectedArgs=["-B",path.join(root,policy.workerPath),"--cpu-preflight","--request",value.request.path,"--request-sha256",value.request.sha256];
  assert.equal(binding.guard.commandSha256,digest(JSON.stringify(expectedArgs)),"CPU invocation request differs");
  for(const [file,expected] of [[receipt.guard.terminalPath,binding.guardSha256],[binding.nativeBuild.binary,binding.nativeBuild.binarySha256],
    [binding.nativeBuild.source.path,binding.nativeBuild.source.sha256],[binding.nativeBuild.compiler,binding.nativeBuild.compilerSha256]])
    assert.equal(digest(fs.readFileSync(file)),expected,"CPU native immutable evidence differs");
  const liveRecord=JSON.parse(fs.readFileSync(receipt.guard.terminalEvidence,"utf8"));
  assert.deepEqual(liveRecord.proof,proof);assert.equal(liveRecord.liveOwnerCleanupConfirmed,true);
  validateWorkerTerminal(value.worker,true);proofPassed(value.ownedReceipt);return pointer;
}
function gpuObservation(){
  const value=execFileSync("nvidia-smi",["--query-gpu=index,uuid,memory.total,memory.free,temperature.gpu","--format=csv,noheader,nounits"],
    {encoding:"utf8",windowsHide:true,timeout:2500,maxBuffer:16384}).trim().split(/\r?\n/).find(v=>v.trim().startsWith("0,"));
  assert(value,"GPU0 observation unavailable");
  const [index,uuid,total,free,temp]=value.split(",").map(v=>v.trim());
  assert([+index,+total,+free,+temp].every(Number.isFinite),"invalid GPU observation");
  return {index:+index,uuid,totalMiB:+total,freeMiB:+free,temperatureC:+temp,observedAtUtc:new Date().toISOString()};
}
function processIdentity(){
  const command="$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+process.pid+"'; $p.CreationDate.ToUniversalTime().ToString('o')";
  const creation=execFileSync("powershell.exe",["-NoProfile","-Command",command],{encoding:"utf8",windowsHide:true,timeout:3000,maxBuffer:4096}).trim();
  assert(creation,"supervisor process creation identity missing");return process.pid+":"+creation;
}
export async function runGpuDiagnostic(root=ROOT,policyBinding=POLICY){
  bindPolicy(policyBinding);
  const start=Date.now(),monotonicStarted=performance.now(),bound=resolvePolicy(root,start+180000),{policy,reader,lineage,python,interpreter}=bound;
  const deadline=start+policy.resources.maxWallSeconds*1000,registryBefore=await emptyRegistry(root,deadline);
  assert(!fs.existsSync(path.join(root,policy.attemptClaimPath)),"diagnostic attempt already consumed; no retry");
  const cpuAcceptance=byteBinding(currentCpuAcceptance(root,bound)),gpu=gpuObservation();
  assert(gpu.freeMiB>=policy.resources.minimumFreeVramMiB&&gpu.temperatureC<policy.resources.maximumTemperatureC,"GPU startup resource guard");
  const storage=fs.statfsSync(path.join(root,policy.outputRoot));
  assert(storage.bavail*storage.bsize>=policy.resources.minimumFreeDiskMiB*1048576,"free disk guard");
  const context=makeOutput(root,"parameter0-training-gpu",policy),{put,runId,logical,absolute}=context;
  Object.assign(context,{startedAtUtc:new Date(start).toISOString(),monotonicStarted,
    durationScope:'managed_diagnostic_including_authentication_restore_math_transport_cleanup'});
  const accounting=createOwnedAccounting(root,absolute,policy);
  context.setAccounting(accounting);
  const packageId=runId+"-package";
  fs.writeFileSync(path.join(root,policy.attemptClaimPath),JSON.stringify({schemaVersion:"parameter0-training-single-attempt-claim-v1",runId,policy:POLICY,
    recordedAtUtc:new Date().toISOString(),automaticRetries:0})+"\n",{flag:"wx"});
  let result,activeRegistered=false,heartbeatTimer=null,heartbeatError=null,terminal=null,firstError=null,liveReceipt=null;
  const requestBinding=put("request.json",{schemaVersion:"parameter0-training-causal-gpu-request-v1",runId,outputRoot:logical,
    policy:POLICY,programBindings:lineage,interpreter,nodeInterpreter:bound.nodeInterpreter,cpuAcceptance,gpuIdentity:gpu,
    deadlineUnixMs:deadline-policy.resources.finalizationReserveMs,mode:"gpu_diagnostic"});
  const admission=put("admission.json",{executionState:"completed",status:"current_cpu_and_input_binding_verified_not_training",
    runId,request:requestBinding,trainingAllowed:false});
  const capsule=put("task-capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v1",taskId:runId,runId,
    integrity:{status:"verified"},evidence:[{...requestBinding,sha256Verified:true},{...admission,sha256Verified:true}]});
  const capability=CAPABILITY;
  const common={projectRoot:root,capabilityVersion:capability,packageId,taskId:runId,taskKind:"zero_update_causal_diagnostic",
    taskGoal:"Observe the exact failed G phase without updates; stop with bounded selected-coordinate evidence.",
    priority:1,runId,lifecycleStage:"numerical_diagnosis",taskCapsulePath:capsule.path,nextMachineAction:null,deadlineUnixMs:deadline};
  let lastGpuCheck=0;
  try{
    const identity=processIdentity(),activeBase={schemaVersion:"ai-painter-current-active-execution-lock-v1",
      capabilityVersion:capability,packageId,runId,processId:process.pid,processStartIdentity:identity};
    const lock=put("active-lock.json",activeBase);
    const beat=()=>put("heartbeat.json",{...activeBase,schemaVersion:"ai-painter-current-active-execution-heartbeat-v1",
      executionState:"executing",heartbeatAtUtc:new Date().toISOString(),ttlSeconds:30},{replace:fs.existsSync(path.join(absolute,"heartbeat.json"))});
    beat();heartbeatTimer=setInterval(()=>{try{if(Date.now()>=deadline){clearInterval(heartbeatTimer);throw new Error("diagnostic total deadline exhausted");}beat();}catch(e){heartbeatError=e;}},5000);
    const active={...activeBase,schemaVersion:"ai-painter-current-active-execution-v1",executionState:"executing",
      programLineage:Object.fromEntries(OWN.filter(p=>!p.includes("/tests/")).map((p,i)=>["diagnosticProgram"+i,lineage.find(b=>b.path===p)])),
      lock:{path:lock.path,sha256:lock.sha256},heartbeat:{path:logical+"/heartbeat.json",ttlSeconds:30}};
    await publishRegistry({...common,executionState:"executing",activity:"zero_update_diagnostic_not_training",
      queueStatus:"running",activeExecution:active,terminalEvidencePath:admission.path,
      expectedPreviousRegistryRevision:registryBefore.registry.registryRevision,expectedPreviousRegistrySha256:registryBefore.registrySha256},accounting);
    activeRegistered=true;requireDeadline(deadline-policy.resources.finalizationReserveMs);
    result=await runParameter60OwnedWorker(python,["-B",path.join(root,policy.workerPath),"--request",requestBinding.path,"--request-sha256",requestBinding.sha256],
      {cwd:root,env:environment(root,false),timeout:deadline-Date.now()-policy.resources.finalizationReserveMs,maxBuffer:policy.resources.maxStreamBytes,
        onSpawn:accounting.observe,
        abortReason:()=>{
          if(heartbeatError)return "diagnostic heartbeat persistence failure";
          if(Date.now()>=deadline-policy.resources.finalizationReserveMs)return "diagnostic execution and cleanup budget exhausted";
          accounting.requireBudget();
          if(Date.now()-lastGpuCheck>=policy.resources.temperaturePollMs){
            lastGpuCheck=Date.now();const now=gpuObservation();
            const disk=fs.statfsSync(path.join(root,policy.outputRoot));
            const stop=resourceStopReason(now,gpu.uuid,disk.bavail*disk.bsize);if(stop)return stop;
          }return null;
        }});
    liveReceipt=result.ownedReceipt;
    const value=JSON.parse(result.stdout);assert.equal(value.runId,runId);validateWorkerTerminal(value,false);
    verifyWorkerResult(reader,value,logical,false);proofPassed(liveReceipt);
    if(value.status==="diagnostic_failed_closed")throw workerFailureError(value,result);
    reader.verifyStable();requireDeadline(deadline);
    terminal=put("terminal.json",{schemaVersion:"parameter0-training-causal-diagnostic-terminal-v1",runId,
      executionState:value.status==="diagnostic_failed_closed"?"failed_closed":"completed",status:value.status,
      request:requestBinding,worker:value,ownedReceipt:result.ownedReceipt,elapsedMs:performance.now()-monotonicStarted,
      startedAtUtc:new Date(start).toISOString(),endedAtUtc:new Date().toISOString(),durationScope:'managed_diagnostic_including_authentication_restore_math_transport_cleanup',
      outputAccounting:accounting.requireBudget(result.ownedReceipt.streamBytes.stdout+result.ownedReceipt.streamBytes.stderr),
      trainingAllowed:false,stage4Qualified:false,rootCauseProven:false});
  }catch(error){firstError=error;liveReceipt=error.ownedReceipt??result?.ownedReceipt??null;
    accounting.beginFailureClosure();terminal=failureRecord(error,context,result);error.evidence=terminal;}
  try{
  assert(terminal,"diagnostic terminal missing");accounting.requireBudget();requireDeadline(deadline);
  // Clearing an active execution requires this invocation's actual live cleanup, never a disk observation.
  const terminalBytes=fs.readFileSync(path.join(root,terminal.path));assert.equal(digest(terminalBytes),terminal.sha256,"terminal evidence changed");
  const terminalValue=JSON.parse(terminalBytes);assert.equal(terminalValue.runId,runId,"terminal Run changed");
  if(activeRegistered&&liveReceipt?.cleanupConfirmed===true&&liveReceipt.guardReleaseConfirmed===true){
    proofPassed(liveReceipt);
    const before=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(before.ok&&before.registry.runId===runId,"own registry identity changed");
    await publishRegistry({...common,executionState:terminalValue.executionState,activity:"diagnostic_terminal_not_training",
      queueStatus:terminalValue.executionState==="completed"?"completed":"failed_closed",activeExecution:null,
      terminalEvidencePath:terminal.path,expectedPreviousRegistrySha256:before.registrySha256},accounting);
    const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok&&after.registry.activeExecution===null);
    assert.deepEqual(after.registry.latestTrainingTerminal,registryBefore.registry.latestTrainingTerminal,"latest training must stay unchanged");
  }
  accounting.requireBudget();requireDeadline(deadline);
  }catch(secondary){accounting.beginFailureClosure();firstError=preserveFinalizationError(firstError,secondary,context,terminal);}
  finally{if(heartbeatTimer)clearInterval(heartbeatTimer);}
  if(firstError)throw firstError;
  return terminal;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
  const args=process.argv.slice(2);
  assert.equal(args.length,5,"mode --policy <logical> --policy-sha256 <sha> required");
  assert(["--cpu","--run"].includes(args[0])); assert.equal(args[1],"--policy");assert.equal(args[3],"--policy-sha256");
  const binding=bindPolicy({path:args[2],sha256:args[4]});
  (args[0]==="--cpu"?runCpuPreflight(ROOT,binding):runGpuDiagnostic(ROOT,binding)).then(v=>console.log(JSON.stringify(v))).catch(e=>{
    console.error(JSON.stringify({status:"failed_closed",error:String(e.message),evidence:e.evidence??null,secondaryEvidenceError:e.secondaryEvidenceError??null,
      workerError:e.workerError??null,workerSecondaryErrors:e.workerSecondaryErrors??[],
      secondaryFinalizationError:e.secondaryFinalizationError??null,secondaryFinalizationEvidence:e.secondaryFinalizationEvidence??null,
      registryTransactionId:e.registryTransactionId??null,registryTransactionRoot:e.registryTransactionRoot??null}));process.exitCode=1;
  });
}
