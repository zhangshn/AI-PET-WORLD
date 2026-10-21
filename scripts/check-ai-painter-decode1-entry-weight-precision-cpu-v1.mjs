// One inactive CPU candidate check. Imports never launch work or consume claims.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {createReader} from './lib/ai-painter-stage4-dataset-audit.mjs';
import {resolveOwnedStopProjectDirectory} from './lib/ai-painter-owned-stop-request-v1.mjs';
import {runParameter60OwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs';
import {collectPythonClosure, frozenInactiveFunctions, createOwnedAccounting, proofPassed} from './diagnose-ai-painter-parameter48-causal-gpu-v2.mjs';
import {readCurrentExecutionRegistry} from '../src/server/ai-painter-current-execution-registry.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTPUT='.runtime/ai-painter/decode1-entry-weight-precision-cpu-checks';
const WORKER='ml/ai-painter/scripts/check_decode1_entry_weight_precision_cpu_v1.py';
const PREFIX='ml/ai-painter/src/ai_painter/complete_world/';
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export let POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-weight-precision-cpu-policy-v1.json',sha256:null});
export const CANDIDATE='stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1';
export const LIMITS=Object.freeze({fullBaselineForwards:1,fullCandidateForwards:1,fullGeneratorAutogradCalls:5,
  discriminatorAutogradCalls:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0});
const RESOURCES=Object.freeze({maxWallSeconds:120,threads:2,maxOutputBytes:8388608,maxStreamBytes:8388608,
  failureReserveBytes:65536,cleanupReserveMs:1000,finalizationReserveMs:8000,attempts:1,automaticRetries:0});
const CANONICAL={path:'scripts/lib/real-earth-region-governance.mjs',sha256:'c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1'};
const SOURCE='.runtime/ai-painter/joint-object-priority-quality-executions/joint-object-quality-v1-c6ec20e3-a5bc-4969-9bb8-437f47fa2802/';
const OPERATOR=PREFIX+'decode1_entry_weight_reduction_precision_v1.py',MODEL=PREFIX+'object_ecology_decode1_entry_weight_precision_v1.py';
const TESTS=['ml/ai-painter/tests/test_decode1_entry_weight_precision_cpu_v1.py',
  'ml/ai-painter/tests/test_check_decode1_entry_weight_precision_cpu_v1.py',
  'scripts/tests/ai-painter-decode1-entry-weight-precision-cpu-v1.test.mjs'];
const OWN=['scripts/check-ai-painter-decode1-entry-weight-precision-cpu-v1.mjs',WORKER,OPERATOR,MODEL,...TESTS,
  'scripts/diagnose-ai-painter-parameter48-causal-gpu-v2.mjs','scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs',
  'scripts/lib/ai-painter-ecology-decode1-native-owner-v2.mjs','scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs',
  'scripts/lib/ai-painter-stage4-dataset-audit.mjs','src/server/ai-painter-current-execution-registry.mjs',CANONICAL.path,
  'scripts/lib/ai-painter-owned-stop-request-v1.mjs','scripts/lib/ai-pet-world-storage.mjs',
  'src/server/ai-console-control/operator-session.ts','scripts/lib/ai-painter-object-support-structure-quality-registration-v1.mjs'];

function logical(value){assert(typeof value==='string'&&!/[\\:\x00-\x1f]/u.test(value)&&!value.startsWith('/')
  &&value.split('/').every(p=>p&&p!=='.'&&p!=='..'),'explicit project path required');return value;}
function binding(value){logical(value?.path);assert(hex(value.sha256),'byte SHA required');return {path:value.path,sha256:value.sha256};}
export function bindPolicy(value){
  assert.equal(value?.path,POLICY.path);assert(hex(value.sha256),'explicit policy SHA required');
  if(POLICY.sha256!==null)assert.equal(value.sha256,POLICY.sha256,'policy binding cannot change');
  POLICY=Object.freeze(binding(value));return POLICY;
}
export function requireDeadline(deadline,now=Date.now()){assert(Number.isSafeInteger(deadline)&&now<deadline,'CPU total deadline exceeded');}
export function validatePolicy(p){
  assert.equal(p.schemaVersion,'ai-painter-decode1-entry-weight-precision-cpu-policy-v1');
  assert.equal(p.status,'registered_cpu_candidate_verification_only');assert.equal(p.candidate,CANDIDATE);
  assert.deepEqual(p.formalSpecification,{path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',
    version:'AI-PAINTER-SPEC-1.91',sha256:'d58ad7953aacf331bfa3be8f32651b7f11a466b23d9ef4237b5d303d16d7a823'});
  assert.deepEqual(p.target,{parameterIndex:48,parameterName:'core.core.terrain.decode_1.layers.0.weight',weightShape:[48,144,3,3]});
  assert.deepEqual(p.scope,{resolution:[256,192],sampleId:'ai-cold-start-v7-v7-capacity-slot-172-seasonal-evergreen-semi-evergreen-forest-v2',
    split:'train',sampleCount:1,originalDataSplits:'48/8/4/4 unchanged',initializationSeed:20260929,
    parameterCount:108,parameterElements:2242687,failureStateInitializationAllowed:false});
  assert.deepEqual(p.resources,RESOURCES);assert.deepEqual(p.limits,LIMITS);
  assert.deepEqual(p.comparison,{atol:1e-6,rtol:1e-5,originalGateKept:true,nativeForwardBytesIdentical:true,onlyTargetWeightGradientChanged:true});
  assert.deepEqual(p.qualification,{gpuExecutionAllowed:false,trainingAllowed:false,checkpointWritten:false,
    stage4Qualified:false,capabilityReleased:false,runtimeFrameAllowed:false});
  assert.deepEqual(p.sourceClosure,{maxFiles:256,maxFileBytes:1048576,maxTotalBytes:16777216,loadedModulesMustBeVerified:true,
    scope:'Original explicitly bound source closure plus exact new candidate and validation source; inactive functions remain source-bound, no imported project module may be omitted.'});
  assert.equal(p.entrypointPath,OWN[0]);assert.equal(p.workerPath,WORKER);assert.deepEqual(p.testPaths,TESTS);
  assert.deepEqual(p.candidateImplementation,{operator:OPERATOR,model:MODEL});
  assert.equal(p.outputRoot,OUTPUT);assert.equal(p.attemptClaimPath,OUTPUT+'/attempt-v1.json');
  assert.deepEqual(binding(p.dataLocator),{path:SOURCE+'gradient-failure/manifest.json',sha256:'cd809d9c4d7d59507fdcadad78eae09cb1a76c52f4f84830f6c18611a43f3c1a'});
  assert.deepEqual(p.metadataCanonicalProgram,CANONICAL);assert(path.isAbsolute(p.nodeInterpreter?.path));assert(hex(p.nodeInterpreter.sha256));
  assert.deepEqual(p.sourceEvidence.map(b=>b.path),['quality-plan.json','model-identity.json','worker-terminal.json',
    'gradient-failure/manifest.json','gradient-failure/primary.json','capture-execution.json'].map(s=>SOURCE+s));
  for(const b of [...p.sourceEvidence,p.diagnosticEvidence,p.controllerReview,p.frozenPredecessorSpecification,...Object.values(p.sourceSampleBindings)])binding(b);
  assert.deepEqual(p.sourceAlgorithmBindings.map(row=>row.role),['parameter60_causal_restore_v1',
    'painter_stage4_joint_object_priority_training_profile_v1','object_joint_rgb_structure_priority_update_device_v1',
    'object_joint_rgb_structure_priority_update_cpu_v1','object_support_structure_failure_capture_v1',
    'native_rgb_structured_object_cpu_v17','native_rgb_complete_support_partition_v23_cpu']);
  for(const row of p.sourceAlgorithmBindings){binding(row.binding);assert.equal(row.binding.path,
    (row.role.startsWith('painter_stage4_')?'ml/ai-painter/scripts/':PREFIX)+row.role+'.py');}
  assert.equal(p.arithmeticCarrier.capability,'stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1');
  assert.equal(p.arithmeticCarrier.qualificationInherited,false);return true;
}
export function validateResult(v,p){
  assert.equal(v.schemaVersion,'decode1-entry-precision-cpu-worker-result-v1');
  assert.equal(v.status,'cpu_candidate_verified_inactive');assert.equal(v.executionState,'completed');
  assert.deepEqual(v.policy,POLICY);assert.equal(v.candidate,CANDIDATE);assert.deepEqual(v.counts,LIMITS);
  for(const key of ['nativeFull256ForwardBytesEqual','fullOriginalLossGradientGatePassed','beforeAfterStateBytesEqual','strictReloadPassed'])assert.equal(v[key],true,key);
  for(const key of ['cudaInitialized','trainingAllowed','stage4Qualified','checkpointWritten','failedStateOrCheckpointLoaded','pngOrCheckpointWritten'])assert.equal(v[key],false,key);
  assert(hex(v.fullForwardHashes?.baseline));assert.equal(v.fullForwardHashes.baseline,v.fullForwardHashes.candidate);
  const f=v.gradientFacts;assert.equal(f.modelCapabilityVersion,CANDIDATE);
  for(const key of ['actualTotalProvenanceVerified','actualTotalIndependentFullModelGradient','originalGateAndProjectionUnchanged',
    'carrierAllParameterNamesShapesBytesVerified','nonHeadActualTotalIdentityPreserved','nonConflictHeadActualTotalBytesPreserved'])assert.equal(f[key],true,key);
  assert.equal(f.autogradGradCalls,5);assert.deepEqual(f.independentFullParameterGradientTensorCounts,[108,108,108,108,108]);
  assert.equal(f.carrierQualificationInherited,false);assert.equal(f.arithmeticCarrierCapabilityVersion,p.arithmeticCarrier.capability);
  assert.equal(f.gradientIdentityAtol,1e-6);assert.equal(f.gradientIdentityRtol,1e-5);
  assert.equal(f.generatorGradientFacts.tensorCount,108);assert.equal(f.generatorGradientFacts.allFinite,true);
  assert.equal(f.generatorGradientFacts.parameterElements,2242687);assert.equal(f.generatorGradientFacts.parametersUpdated,false);return true;
}

// Reuse the original dependency set, not a claim that every bound function runs.
// The second AST pass authenticates ALL static imports of explicit new OWN and
// also counts the original parser's exact successful JSON output conservatively.
export function collectSourceClosure(root,reader,p,deadline){
  requireDeadline(deadline);const manifest=reader.bound(binding(p.dataLocator));
  const base=collectPythonClosure(root,reader,manifest.context.programBindings,p.sourceAlgorithmBindings,deadline);
  const rows=new Map(base.map(b=>[b.path,b]));let total=0;
  for(const name of OWN){const raw=reader.bytes(name,name===CANONICAL.path?CANONICAL.sha256:undefined);assert(raw.length<=1048576);const b={path:name,sha256:hash(raw)};
    if(rows.has(name))assert.deepEqual(rows.get(name),b,'source binding collision');rows.set(name,b);}
  assert(rows.size<=256,'program count limit');
  const sources=[...rows.values()].map(b=>{const raw=reader.bytes(b.path,b.sha256);assert(raw.length<=1048576);total+=raw.length;
    return {path:b.path,source:raw.toString('utf8'),base:base.some(r=>r.path===b.path),
      inactiveFunctions:b.path.endsWith('.py')?frozenInactiveFunctions(b.path,raw,b):[]};});
  assert(total<=16777216,'complete source byte limit');
  const parser=`import ast,json,pathlib,sys
r=json.load(sys.stdin); root=pathlib.Path(r['root']); names={s['path'] for s in r['sources']}; parser_bytes=0
def resolve(importer,spec):
 dots=len(spec)-len(spec.lstrip('.')); parts=spec.lstrip('.').split('.')
 if dots:
  base=pathlib.PurePosixPath(importer).parent
  for _ in range(1,dots): base=base.parent
  bases=[str(base.joinpath(*parts))]
 else: bases=['ml/ai-painter/scripts/'+'/'.join(parts),'ml/ai-painter/src/'+'/'.join(parts)]
 for base in bases:
  for name in (base+'.py',base+'/__init__.py'):
   if (root/name).is_file(): return name
for s in r['sources']:
 if not s['path'].endswith('.py'): continue
 found=[]
 class Imports(ast.NodeVisitor):
  def visit_FunctionDef(self,n):
   if n.name not in s['inactiveFunctions']: self.generic_visit(n)
  visit_AsyncFunctionDef=visit_FunctionDef
  def visit_Import(self,n): found.extend(dict(kind='python_static',specifier=a.name) for a in n.names)
  def visit_ImportFrom(self,n):
   p='.'*n.level+(n.module or '')
   if n.module: found.append(dict(kind='python_static',specifier=p))
   found.extend(dict(kind='python_static',specifier=p+('.' if n.module else '')+a.name) for a in n.names if a.name!='*')
  def visit_Call(self,n):
   f=n.func; k=f.id if isinstance(f,ast.Name) else f.attr if isinstance(f,ast.Attribute) else ''
   if k in ('__import__','import_module','spec_from_file_location'):
    if k!='spec_from_file_location' and n.args and isinstance(n.args[0],ast.Constant) and isinstance(n.args[0].value,str): found.append(dict(kind='python_static',specifier=n.args[0].value))
    else: found.append(dict(kind='nonliteral_dynamic',specifier='dynamic'))
   self.generic_visit(n)
 Imports().visit(ast.parse(s['source'],filename=s['path']))
 if s['base']: parser_bytes+=len(json.dumps(found,separators=(',',':')).encode())
 else:
  for item in found:
   assert item['kind']=='python_static', 'new dynamic project loader refused: '+s['path']
   target=resolve(s['path'],item['specifier'])
   assert target is None or target in names, 'unregistered new static import: '+s['path']+' -> '+str(target)
json.dump({'originalParserBytes':parser_bytes},sys.stdout,separators=(',',':'))`;
  const output=execFileSync(path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B','-c',parser],{
    input:JSON.stringify({root,sources}),encoding:'utf8',windowsHide:true,timeout:Math.max(1,deadline-Date.now()),maxBuffer:1048576,
    env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
  const parserBytes=JSON.parse(output).originalParserBytes+Buffer.byteLength(output);
  assert(Number.isSafeInteger(parserBytes)&&parserBytes>=0&&parserBytes<8388608-65536,'preparation parser output limit');
  reader.verifyStable?.();requireDeadline(deadline);const result=[...rows.values()];
  Object.defineProperty(result,'preparationStreamBytes',{value:parserBytes});return result;
}

// Only the pre-existing formal .runtime mapping is allowed; nested redirects
// and replaced directory identities fail on each subsequent IO operation.
export function createHostPaths(root){
  assert(path.isAbsolute(root));const pins=new Map();
  function directory(name){logical(name);let resolved;
    for(let i=1;i<=name.split('/').length;i++){
      const part=name.split('/').slice(0,i).join('/');resolved=resolveOwnedStopProjectDirectory(root,part);
      const st=fs.statSync(resolved,{bigint:true}),pin=[resolved,String(st.dev),String(st.ino),fs.realpathSync(resolved)].join('|');
      if(pins.has(part))assert.equal(pin,pins.get(part),'output directory identity changed');else pins.set(part,pin);
    }return resolved;}
  function file(name){logical(name);const target=path.join(directory(path.posix.dirname(name)),path.posix.basename(name));
    if(fs.existsSync(target)){const st=fs.lstatSync(target);assert(st.isFile()&&!st.isSymbolicLink(),'regular unredirected file required');}return target;}
  return {directory,file,mkdir(name){logical(name);const target=path.join(directory(path.posix.dirname(name)),path.posix.basename(name));
    if(!fs.existsSync(target))fs.mkdirSync(target);return directory(name);}};
}
export function createCpuAccounting(root,absolute,p,{preparationStreamBytes=0}={}){
  const base=createOwnedAccounting(root,absolute,p);let scope=null;
  const size=file=>{if(!fs.existsSync(file))return 0;const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());return st.size;};
  function measure(){const value=base.measure();const live=scope?.getStreamBytes?.()??{stdout:0,stderr:0};
    const actualStreamBytes=live.stdout+live.stderr;
    // Native O/E base64 framing is at most 7 bytes per one-byte payload; R has
    // the fixed 64 KiB frame ceiling. Debit 8x plus R, owner errors and CLI.
    const conservativeTransportBytes=8*actualStreamBytes+65536+16384;
    const claimBytes=size(path.join(root,p.attemptClaimPath));let activeGuardBytes=0;
    if(scope&&fs.existsSync(scope.guard.path)){
      const raw=fs.readFileSync(scope.guard.path);assert.equal(JSON.parse(raw).identity,scope.guardRecord.identity);
      activeGuardBytes=size(scope.guard.path);}
    return {...value,phaseSharedBytes:claimBytes,preparationStreamBytes,conservativeTransportBytes,activeGuardBytes,
      totalBytes:value.totalBytes-value.phaseSharedBytes+claimBytes+preparationStreamBytes+conservativeTransportBytes+activeGuardBytes};}
  let failure=false;
  return {measure,observe(value){assert.equal(scope,null,'one managed invocation only');
      assert.equal(path.resolve(value.guard.path),path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json'));
      base.observe(value);scope=value;},
    observeFailure(error){if(scope||!error.ownedReceipt?.guard||error.ownedReceipt.guard.state==='existing_guard_refused')return;
      const guard=error.ownedReceipt.guard,id=guard.identity;
      assert(/^[a-f0-9-]{36}$/.test(id));const native=path.join(root,'.runtime/ai-painter/owned-worker-guards',id+'-native');
      if(fs.existsSync(native)){const value={guard,guardRecord:{identity:id},nativeBuildDirectory:native};base.observe(value);scope=value;}},
    beginFailureClosure(){failure=true;base.beginFailureClosure();},
    requireBudget(){const value=measure();assert(value.totalBytes<=p.resources.maxOutputBytes-(failure?0:65536),'CPU cumulative output quota exceeded');return value;}};
}

// Dry resolver: hashes source/JSON metadata only, never consumes an attempt or
// deserializes capture tensors. The controller may call it before the one run.
export function dryResolve(root=ROOT,value=POLICY,deadline=Date.now()+120000){
  bindPolicy(value);const paths=createHostPaths(root),raw=createReader(root);
  const reader={...raw,bytes(name,sha){paths.file(name);return raw.bytes(name,sha);},
    bound(b){const bytes=this.bytes(b.path,b.sha256);if(b.bytes!==undefined)assert.equal(bytes.length,b.bytes);return JSON.parse(bytes);},
    verifyStable(){for(const row of raw.receipts())this.bytes(row.path,row.sha256);}};
  const p=reader.bound(POLICY);validatePolicy(p);reader.bytes(p.formalSpecification.path,p.formalSpecification.sha256);
  const evidence=p.sourceEvidence.map(b=>reader.bound(b)),plan=evidence[0];
  reader.bound(p.diagnosticEvidence);reader.bound(p.controllerReview);
  reader.bytes(p.frozenPredecessorSpecification.path,p.frozenPredecessorSpecification.sha256);
  const nodeInterpreter={path:process.execPath,sha256:hash(fs.readFileSync(process.execPath))};
  assert.deepEqual(nodeInterpreter,p.nodeInterpreter);assert.equal(path.resolve(plan.runtimeIdentity.node.absolutePath),path.resolve(nodeInterpreter.path));
  assert.equal(plan.runtimeIdentity.node.sha256,nodeInterpreter.sha256);reader.bytes(CANONICAL.path,CANONICAL.sha256);
  for(const row of p.sourceAlgorithmBindings)reader.bytes(row.binding.path,row.binding.sha256);
  for(const b of Object.values(p.sourceSampleBindings))reader.bytes(b.path,b.sha256);
  const programBindings=collectSourceClosure(root,reader,p,deadline);
  const python=paths.file('ml/ai-painter/.venv/Scripts/python.exe'),interpreter={path:path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),sha256:hash(fs.readFileSync(python))};
  reader.verifyStable();requireDeadline(deadline);return {policy:p,reader,paths,programBindings,python,interpreter,nodeInterpreter};
}
export async function runCpuCheck(root=ROOT,value=POLICY){
  const began=Date.now(),mono=performance.now(),deadline=began+120000,workDeadline=deadline-8000;
  const check=()=>{requireDeadline(deadline);assert(performance.now()-mono<120000,'monotonic CPU deadline exceeded');};
  bindPolicy(value);const paths=createHostPaths(root);paths.file(POLICY.path);
  const reader=createReader(root),p=reader.bound(POLICY);validatePolicy(p);
  paths.directory('.runtime');
  assert(!fs.existsSync(path.join(root,p.attemptClaimPath)),'CPU attempt already consumed; zero retries');
  const before=await readCurrentExecutionRegistry(root,{deadlineUnixMs:workDeadline});
  assert(before.ok&&before.registry.activeExecution===null,'verified inactive registry required');
  assert(!fs.existsSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json')),'existing guard refused');
  paths.mkdir('.runtime/ai-painter');paths.mkdir(OUTPUT);
  const runId='decode1-entry-cpu-'+crypto.randomUUID(),out=OUTPUT+'/'+runId,absolute=paths.mkdir(out);
  let accounting=createCpuAccounting(root,absolute,p),request=null,managed=null,error=null,terminal=null,successFile=false;
  function put(name,data,failure=false){check();const bytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
    assert(accounting.measure().totalBytes+bytes.length<=8388608-(failure?0:65536),'CPU write exceeds cumulative quota');
    fs.writeFileSync(paths.file(out+'/'+name),bytes,{flag:'wx'});return {path:out+'/'+name,sha256:hash(bytes),bytes:bytes.length};}
  const claim=Buffer.from(JSON.stringify({runId,policy:POLICY,recordedAtUtc:new Date().toISOString(),automaticRetries:0})+'\n');
  assert(accounting.requireBudget().totalBytes+claim.length<=8388608-65536);fs.writeFileSync(paths.file(p.attemptClaimPath),claim,{flag:'wx'});
  try{
    const resolved=dryResolve(root,POLICY,workDeadline);accounting=createCpuAccounting(root,absolute,p,{preparationStreamBytes:resolved.programBindings.preparationStreamBytes});
    request=put('request.json',{schemaVersion:'decode1-entry-precision-cpu-request-v1',runId,outputRoot:out,policy:POLICY,
      programBindings:resolved.programBindings,interpreter:resolved.interpreter,nodeInterpreter:resolved.nodeInterpreter,
      deadlineUnixMs:workDeadline,mode:'cpu_candidate_check'});
    requireDeadline(workDeadline);
    try{managed=await runParameter60OwnedWorker(resolved.python,['-B',path.join(root,WORKER),'--request',request.path,'--request-sha256',request.sha256],{
      cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',
        PYTHONPATH:[path.join(root,'ml/ai-painter/src'),path.join(root,'ml/ai-painter/scripts')].join(path.delimiter),OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'},
      timeout:workDeadline-Date.now(),maxBuffer:8388608,onSpawn:accounting.observe,
      abortReason:()=>{accounting.requireBudget();return Date.now()>=workDeadline?'CPU deadline':null;}});}
    catch(first){accounting.observeFailure(first);throw first;}
    const result=JSON.parse(managed.stdout);assert.equal(result.runId,runId);validateResult(result,p);proofPassed(managed.ownedReceipt);
    resolved.reader.verifyStable();check();
    const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});
    assert(after.ok);assert.equal(after.registrySha256,before.registrySha256);assert.deepEqual(after.registry,before.registry,'CPU must not change registry or training terminal');
    terminal=put('terminal.pending.json',{schemaVersion:'decode1-entry-precision-cpu-terminal-v1',runId,status:result.status,executionState:'completed',
      request,worker:result,ownedReceipt:managed.ownedReceipt,registryBeforeSha256:before.registrySha256,registryAfterSha256:after.registrySha256,
      outputAccounting:accounting.requireBudget(),accountingScope:'snapshot_before_terminal_write; final returned accounting includes terminal',qualification:p.qualification});
    check();fs.renameSync(paths.file(terminal.path),paths.file(out+'/terminal.json'));successFile=true;terminal={...terminal,path:out+'/terminal.json'};
    const finalRegistry=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(finalRegistry.ok);
    assert.equal(finalRegistry.registrySha256,before.registrySha256);assert.deepEqual(finalRegistry.registry,before.registry);
    const outputAccounting=accounting.requireBudget();check();
    return {runId,status:result.status,terminal,outputAccounting,elapsedMs:Date.now()-began,qualification:p.qualification};
  }catch(first){
    error=first;accounting.beginFailureClosure();
    if(successFile){try{fs.renameSync(paths.file(out+'/terminal.json'),paths.file(out+'/unaccepted-terminal.json'));}catch(secondary){error.secondaryRejectionError=String(secondary);}}
    terminal=null;
    try{const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok);
      assert.equal(after.registrySha256,before.registrySha256);assert.deepEqual(after.registry,before.registry);}
    catch(secondary){error.secondaryRegistryError=String(secondary);}
    try{terminal=put('failure.json',{schemaVersion:'decode1-entry-precision-cpu-terminal-v1',runId,status:'cpu_candidate_failed_closed',executionState:'failed_closed',
      request,error:String(first.stack??first).slice(0,8192),stdout:String(first.stdout??managed?.stdout??'').slice(0,8192),stderr:String(first.stderr??managed?.stderr??'').slice(0,8192),
      ownedReceipt:first.ownedReceipt??managed?.ownedReceipt??null,qualification:p.qualification},true);}
    catch(secondary){error.secondaryEvidenceError=String(secondary);}
    error.evidence=terminal;throw error;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);assert(args.length===4&&args[0]==='--policy'&&args[1]===POLICY.path
      &&args[2]==='--policy-sha256'&&hex(args[3]),'fixed CPU scope requires explicit --policy PATH --policy-sha256 SHA');
    const result=await runCpuCheck(ROOT,{path:args[1],sha256:args[3]});const text=JSON.stringify(result)+'\n';
    assert(Buffer.byteLength(text)<=8192,'CLI stream ceiling');process.stdout.write(text);
  }catch(error){process.exitCode=1;process.stderr.write(JSON.stringify({error:String(error.message).slice(0,2048),evidence:error.evidence??null})+'\n');}
}
