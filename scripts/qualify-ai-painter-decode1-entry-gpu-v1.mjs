// One immutable qualification package: CPU -> GPU -> stop, never training.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire,builtinModules} from 'node:module';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {resolveOwnedStopProjectDirectory} from './lib/ai-painter-owned-stop-request-v1.mjs';
import {runQualificationOwnedWorker} from './lib/ai-painter-parameter60-owned-worker-v1.mjs';
import {collectPythonClosure,frozenInactiveFunctions,createOwnedAccounting,proofPassed,directoryBytes} from './diagnose-ai-painter-parameter48-causal-gpu-v2.mjs';
import {nodeImports} from './lib/ai-painter-execution-source-closure-v1.mjs';
import {readCurrentExecutionRegistry,prepareCurrentExecutionRegistryAdvance,finalizePreparedCurrentExecutionRegistryAdvance} from '../src/server/ai-painter-current-execution-registry.mjs';

const SELF=fileURLToPath(import.meta.url),ROOT=path.resolve(path.dirname(SELF),'..');
const hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const OUTPUT='.runtime/ai-painter/decode1-entry-gpu-qualifications';
const WORKER='ml/ai-painter/scripts/qualify_decode1_entry_gpu_v1.py';
const PREFIX='ml/ai-painter/src/ai_painter/complete_world/';
export const CAPABILITY='stage4_mvp256_dry_decode1_entry_gpu_qualification_v1';
export const MODEL='stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1';
export let POLICY=Object.freeze({path:'data/ai-painter/system-governance/ai-painter-decode1-entry-gpu-qualification-policy-v1.json',sha256:null});
const RESOURCES={cpuPreparationSeconds:240,gpuQualificationSeconds:720,threads:2,maxGpuMemoryFraction:.7,
  maximumTemperatureC:85,minimumFreeVramMiB:2048,minimumFreeDiskMiB:2048,cpuOutputBytes:8388608,gpuOutputBytes:16777216,
  totalOutputBytes:134217728,maxStreamBytes:8388608,failureReserveBytes:65536,cleanupReserveMs:1000,finalizationReserveMs:8000,attempts:1,automaticRetries:0};
const PACKAGE_FIELDS=['schemaVersion','runId','capabilityVersion','modelCapabilityVersion','policy','programBindings','interpreter',
  'nodeInterpreter','scope','resources','dataBindings','frozenCpuModelBindings'];
const OWN=['scripts/qualify-ai-painter-decode1-entry-gpu-v1.mjs',WORKER,
  PREFIX+'object_decode1_entry_joint_priority_device_v1.py','ml/ai-painter/tests/test_decode1_entry_gpu_qualification_cpu_v1.py',
  'scripts/tests/ai-painter-decode1-entry-gpu-v1.test.mjs','scripts/tests/ai-painter-qualification-owned-worker-boundary.test.mjs',
  PREFIX+'decode1_entry_weight_reduction_precision_v1.py',PREFIX+'object_ecology_decode1_entry_weight_precision_v1.py',
  'scripts/windows/ai-painter-owned-worker-owner-stream-v2.cs','scripts/lib/real-earth-region-governance.mjs'];
const CANONICAL={path:OWN[9],sha256:'c4ae942c1f44a60fad1650f02c9dccb0f780472638693e7146fbbe9a2dc85af1'};
const builtins=new Set([...builtinModules,...builtinModules.map(name=>'node:'+name)]);
function logical(value){assert(typeof value==='string'&&value.length>0&&!/[\\:\x00-\x1f\x7f]/u.test(value)&&!value.startsWith('/')
  &&value.split('/').every(part=>part&&part!=='.'&&part!=='..'),'explicit project path required');return value;}
export function byteBinding(value){logical(value?.path);assert(hex(value.sha256),'byte SHA required');return {path:value.path,sha256:value.sha256};}
export function bindPolicy(value){assert.equal(value?.path,POLICY.path);assert(hex(value.sha256),'explicit policy SHA required');
  if(POLICY.sha256!==null)assert.equal(value.sha256,POLICY.sha256,'policy binding cannot change');POLICY=Object.freeze(byteBinding(value));return POLICY;}
export function requireDeadline(deadline,now=Date.now()){assert(Number.isSafeInteger(deadline)&&now<deadline,'qualification phase deadline exceeded');}
export function validatePolicy(p){
  assert.equal(p.schemaVersion,'ai-painter-decode1-entry-gpu-qualification-policy-v1');assert.equal(p.status,'registered_qualification_route_not_qualified');
  assert.equal(p.capabilityVersion,CAPABILITY);assert.equal(p.modelCapabilityVersion,MODEL);assert.deepEqual(p.resources,RESOURCES);
  assert.deepEqual(p.formalSpecification,{path:'docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md',version:'AI-PAINTER-SPEC-1.92',
    sha256:'b57bfd1856ddb3092940acf4518b543d15087e959865abe877c843bee646e8dd'});
  assert.deepEqual(p.allowedModes,['cpu_prepare','gpu_qualify']);assert.equal(p.outputRoot,OUTPUT);assert.equal(p.attemptClaimPath,OUTPUT+'/attempt-v1.json');
  assert.deepEqual(p.packageFields,PACKAGE_FIELDS);
  assert.deepEqual(p.wireProtocols,{package:'decode1-entry-gpu-qualification-package-v1',request:'decode1-entry-gpu-qualification-request-v1',worker:'decode1-entry-gpu-qualification-worker-result-v1'});
  assert.deepEqual(p.scope,{resolution:[256,192],worldCount:1,trainSamples:48,validationSamples:8,splitCapacity:'48/8/4/4 unchanged',
    initializationSeed:20260929,waterFactPresent:false,buildingsRequired:false,personalityRequired:false,challengeAndRegressionContentRead:false});
  assert.deepEqual(p.target,{parameterIndex:48,parameterName:'core.core.terrain.decode_1.layers.0.weight',weightShape:[48,144,3,3]});
  assert.deepEqual(p.sourceClosure,{maximumEntries:256,maximumFileBytes:1048576,maximumTotalBytes:16777216,actualLoadedModulesMustBeBound:true,old260ExceptionInherited:false});
  assert.deepEqual(p.cpuPreparation,{modelForwards:0,generatorAutograd:0,discriminatorAutograd:0,optimizerConstruction:0,optimizerUpdates:0,cudaCalls:0,
    validationLoadSamples:8,trainImageContentRead:false,scope:'metadata, own adapter component/request ABI, fresh model identity and original fixed-eight validation loading only; no selection'});
  assert.deepEqual(p.gpuQualification,{sampleSplit:'train',sampleCount:48,generatorForwardsPerSample:1,generatorAutogradPerSample:5,
    discriminatorAutogradPerSample:1,totalGeneratorForwards:48,totalGeneratorAutograd:240,totalDiscriminatorAutograd:48,
    optimizerConstruction:0,optimizerUpdates:0,samePackageRequired:true,stateAndRngUnchanged:true,oldQualificationReusable:false});
  assert.deepEqual(p.comparison,{atol:1e-6,rtol:1e-5,originalScalarAndGradientGatesKept:true,jointPriorityArithmeticUnchanged:true,projectionRoundoffBoundUnchanged:true});
  assert.deepEqual(p.executionBoundary,{cpuPreparation:true,gpuQualification:true,training:false,checkpoint:false,png:false,publication:false,
    failedStateInitialization:false,automaticRetry:false,automaticLayerExtension:false});
  assert.deepEqual(p.qualification,{gpuQualified:false,trainingAllowed:false,checkpointWritten:false,stage4Qualified:false,capabilityReleased:false,runtimeFrameAllowed:false});
  assert.deepEqual(p.metadataCanonicalProgram,CANONICAL);assert(path.isAbsolute(p.nodeInterpreter.path)&&hex(p.nodeInterpreter.sha256));
  assert.deepEqual(p.implementations,{host:OWN[0],worker:WORKER,deviceBridge:OWN[2],nodeTests:OWN[4],pythonTests:OWN[3],sharedNativeWorker:'scripts/lib/ai-painter-parameter60-owned-worker-v1.mjs'});
  assert.deepEqual(p.frozenCpuModelBindings,[{path:OWN[6],sha256:'2ee9e87343509c298f9cdd44fbbd004bf66690c64cf9edd68a636a2b673e51a6'},
    {path:OWN[7],sha256:'4913645e95b731ea5e51512a726cd2fd777938639122e853289de15308a44083'}]);
  assert.equal(p.priorCpuEvidence.oldAttemptReplayAllowed,false);assert.equal(p.priorCpuEvidence.grantsGpuOrTrainingQualification,false);
  for(const value of Object.values(p.dataBindings))byteBinding(value);byteBinding(p.originalSourceLocator);
  assert.deepEqual(Object.keys(p.dataBindings).sort(),['conditionContract','datasetManifest','regimeDiagnostic','trainSplit','validationSplit']);
  assert.equal(p.sourceAlgorithmBindings.length,7);for(const row of p.sourceAlgorithmBindings)byteBinding(row.binding);
  assert.equal(p.registry.sameWriter,true);assert.equal(p.registry.latestTrainingTerminalUnchanged,true);assert.equal(p.registry.qualificationIsTraining,false);
  assert.deepEqual(p.cleanup,{sameNativeJobAndGuard:true,proof:'this_invocation_live_owner_pipe_and_empty_job_proof_only',unknownCleanup:'retain_guard_and_fail_closed',automaticRecovery:false});
  return true;
}
export function validatePackage(value,p){
  assert.deepEqual(Object.keys(value).sort(),[...p.packageFields].sort(),'exact immutable package fields');
  assert.equal(value.schemaVersion,p.wireProtocols.package);assert(/^decode1-entry-qualification-[a-f0-9-]{36}$/.test(value.runId));
  assert.equal(value.capabilityVersion,CAPABILITY);assert.equal(value.modelCapabilityVersion,MODEL);assert.deepEqual(value.policy,POLICY);
  for(const key of ['scope','resources','dataBindings','frozenCpuModelBindings','nodeInterpreter'])assert.deepEqual(value[key],p[key]);
  assert(path.isAbsolute(value.interpreter.path)&&hex(value.interpreter.sha256));
  assert(Array.isArray(value.programBindings)&&value.programBindings.length>0&&value.programBindings.length<=256);
  assert.equal(new Set(value.programBindings.map(row=>row.path)).size,value.programBindings.length);
  for(const b of value.programBindings){assert.deepEqual(Object.keys(b).sort(),['path','sha256']);byteBinding(b);}
  for(const b of [...p.frozenCpuModelBindings,p.metadataCanonicalProgram])assert.deepEqual(value.programBindings.find(row=>row.path===b.path),b);
  for(const name of OWN)assert(value.programBindings.some(row=>row.path===name),'missing qualification source '+name);
  return true;
}
export function createHostPaths(root){
  assert(path.isAbsolute(root));const pins=new Map();
  function directory(name){logical(name);let resolved;
    for(let i=1;i<=name.split('/').length;i++){const part=name.split('/').slice(0,i).join('/');resolved=resolveOwnedStopProjectDirectory(root,part);
      const stat=fs.statSync(resolved,{bigint:true}),pin=[resolved,stat.dev,stat.ino,fs.realpathSync(resolved)].join('|');
      if(pins.has(part))assert.equal(pins.get(part),pin,'directory identity changed');else pins.set(part,pin);}return resolved;}
  function file(name){logical(name);const target=path.join(directory(path.posix.dirname(name)),path.posix.basename(name));
    if(fs.existsSync(target)){const stat=fs.lstatSync(target);assert(stat.isFile()&&!stat.isSymbolicLink(),'regular unredirected file required');}return target;}
  return {directory,file,mkdir(name){const target=path.join(directory(path.posix.dirname(logical(name))),path.posix.basename(name));if(!fs.existsSync(target))fs.mkdirSync(target);return directory(name);}};
}
export function createReader(root){const paths=createHostPaths(root),observed=new Map();
  const reader={paths,bytes(name,expected,maximum=64*1024**2){const file=paths.file(name),before=fs.statSync(file);assert(before.size<=maximum,'input byte ceiling');
    const raw=fs.readFileSync(file);assert.equal(raw.length,before.size);const sha=hash(raw);if(expected!==undefined)assert.equal(sha,expected,'source SHA mismatch: '+name);
    if(observed.has(name))assert.equal(sha,observed.get(name),'source changed: '+name);observed.set(name,sha);return raw;},
    bound(value){const raw=reader.bytes(value.path,value.sha256);if(value.bytes!==undefined)assert.equal(raw.length,value.bytes);return JSON.parse(raw);},
    verifyStable(){for(const [name,sha] of observed)reader.bytes(name,sha);},receipts(){return [...observed].map(([path,sha256])=>({path,sha256}));}};return reader;
}
export function collectSourceClosure(root,reader,p,deadline){
  requireDeadline(deadline);const manifest=reader.bound(byteBinding(p.originalSourceLocator));
  const base=collectPythonClosure(root,reader,manifest.context.programBindings,p.sourceAlgorithmBindings,deadline);
  const rows=new Map(base.map(b=>[b.path,b]));let total=0;
  for(const name of OWN){const raw=reader.bytes(name,name===CANONICAL.path?CANONICAL.sha256:undefined);assert(raw.length<=1048576);const b={path:name,sha256:hash(raw)};
    if(rows.has(name))assert.deepEqual(rows.get(name),b,'source binding collision');rows.set(name,b);}

  // Follow actual Node imports (including installed providers and manifests),
  // never append full training/auth/lifecycle roots merely because they exist.
  const pending=[...rows.keys()],visited=new Set();
  while(pending.length){
    requireDeadline(deadline);const name=pending.shift();if(visited.has(name))continue;visited.add(name);
    if(!/\.(?:mjs|cjs|js|ts|tsx)$/.test(name))continue;
    const raw=reader.bytes(name,rows.get(name).sha256);
    for(const edge of nodeImports(raw.toString('utf8'),{sourcePath:name,edges:true})){
      if(builtins.has(edge.value)||edge.value.startsWith('node:'))continue;
      let resolved;
      try{resolved=createRequire(path.join(root,name)).resolve(edge.value);}
      catch(error){if(edge.optional&&!edge.value.startsWith('.')&&error.code==='MODULE_NOT_FOUND')continue;throw error;}
      const logicalName=path.relative(root,resolved).split(path.sep).join('/');logical(logicalName);
      assert(!path.isAbsolute(logicalName)&&!logicalName.startsWith('../'),'Node dependency outside project');
      const add=name=>{if(rows.has(name))return;const bytes=reader.bytes(name);assert(bytes.length<=1048576,'Node source individual bound');
        rows.set(name,{path:name,sha256:hash(bytes)});pending.push(name);
        if(rows.size>256){const error=new Error('qualification actual source closure exceeds256 at '+name);error.sourcePaths=[...rows.keys()];throw error;}};
      add(logicalName);
      if(!edge.value.startsWith('.')){
        const parts=edge.value.split('/'),provider=edge.value.startsWith('@')?parts.slice(0,2).join('/'):parts[0];
        let folder=path.dirname(resolved),found=false;
        while(folder.startsWith(root+path.sep)){
          const meta=path.join(folder,'package.json');
          if(fs.existsSync(meta)&&JSON.parse(fs.readFileSync(meta)).name===provider){add(path.relative(root,meta).split(path.sep).join('/'));found=true;break;}
          folder=path.dirname(folder);
        }
        assert(found,'Node provider manifest missing');
      }
    }
  }

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
   if k=='spec_from_file_location' and s['path']=='ml/ai-painter/scripts/qualify_decode1_entry_gpu_v1.py':
    # One closed registered in-process test module, never a caller path.
    expected='ml/ai-painter/tests/test_decode1_entry_gpu_qualification_cpu_v1.py'
    assert len(n.args)==2 and isinstance(n.args[0],ast.Constant) and n.args[0].value=='_decode1_entry_qualification_abi_tests'
    q=n.args[1]
    assert isinstance(q,ast.Call) and isinstance(q.func,ast.Attribute) and isinstance(q.func.value,ast.Name) and q.func.value.id=='reader' and q.func.attr=='path'
    assert len(q.args)==1 and isinstance(q.args[0],ast.Name) and q.args[0].id=='TEST' and expected in names
    declarations=[v.value.value for v in ast.parse(s['source']).body if isinstance(v,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='TEST' for t in v.targets) and isinstance(v.value,ast.Constant)]
    assert declarations==[expected], 'closed TEST binding changed'
   elif k in ('__import__','import_module','spec_from_file_location'):
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
export function makePackage(p,runId,programBindings,interpreter,nodeInterpreter){
  const value={schemaVersion:p.wireProtocols.package,runId,capabilityVersion:CAPABILITY,modelCapabilityVersion:MODEL,
    policy:POLICY,programBindings,interpreter,nodeInterpreter,scope:structuredClone(p.scope),resources:structuredClone(p.resources),
    dataBindings:structuredClone(p.dataBindings),frozenCpuModelBindings:structuredClone(p.frozenCpuModelBindings)};
  validatePackage(value,p);return value;
}
export function dryResolve(root=ROOT,value=POLICY,deadline=Date.now()+240000){
  bindPolicy(value);const reader=createReader(root),p=reader.bound(POLICY);validatePolicy(p);
  reader.bytes(p.formalSpecification.path,p.formalSpecification.sha256);
  const prior=p.priorCpuEvidence,terminal=reader.bound(prior.terminal),request=reader.bound(prior.request);
  reader.bound(prior.acceptance);reader.bound(prior.policy);reader.bytes(prior.originalNormativeBytes.path,prior.originalNormativeBytes.sha256);
  assert.equal(terminal.runId,request.runId);assert.deepEqual(byteBinding(terminal.request),byteBinding(prior.request));
  assert.deepEqual(request.policy,byteBinding(prior.policy));assert.equal(terminal.worker.status,'cpu_candidate_verified_inactive');
  assert.equal(terminal.worker.strictReloadPassed,true);assert.equal(terminal.worker.trainingAllowed,false);
  for(const b of p.frozenCpuModelBindings){reader.bytes(b.path,b.sha256);assert.deepEqual(request.programBindings.find(row=>row.path===b.path),b);}
  for(const row of p.sourceAlgorithmBindings)reader.bytes(row.binding.path,row.binding.sha256);
  for(const b of Object.values(p.dataBindings))reader.bound(b);
  const programBindings=collectSourceClosure(root,reader,p,deadline);
  const python=path.join(root,'ml/ai-painter/.venv/Scripts/python.exe'),interpreter={path:python,sha256:hash(fs.readFileSync(reader.paths.file('ml/ai-painter/.venv/Scripts/python.exe')))};
  const nodeInterpreter={path:process.execPath,sha256:hash(fs.readFileSync(process.execPath))};assert.deepEqual(nodeInterpreter,p.nodeInterpreter);
  reader.verifyStable();requireDeadline(deadline);return {reader,policy:p,programBindings,python,interpreter,nodeInterpreter};
}
export function createAccounting(root,absolute,p){
  const entries=[];let active=null;
  const fileBytes=file=>{if(!fs.existsSync(file))return 0;const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink());return st.size;};
  function common(entry){const value=entry.base.measure(),live=entry.scope?.getStreamBytes?.()??{stdout:0,stderr:0};
    const rawStreams=live.stdout+live.stderr;let guardBytes=0;
    if(entry.scope&&fs.existsSync(entry.scope.guard.path)){
      const bytes=fs.readFileSync(entry.scope.guard.path);assert.equal(JSON.parse(bytes).identity,entry.scope.guardRecord.identity);guardBytes=bytes.length;}
    return {...value,extraBytes:entry.preparationBytes+entry.retiredBytes+entry.externalBytes+8*rawStreams+65536+16384+guardBytes};}
  function measure(){assert(active,'phase accounting required');const current=common(active),diagnosticBytes=directoryBytes(absolute);
    const claimBytes=fileBytes(path.join(root,p.attemptClaimPath));
    const totalBytes=diagnosticBytes+claimBytes+entries.reduce((sum,e)=>{const v=common(e);return sum+v.nativeBytes+v.registryBytes+v.streamBytes+v.atomicCopyBytes+v.extraBytes;},0);
    const phaseBytes=diagnosticBytes-active.initialDirectoryBytes+current.nativeBytes+current.registryBytes+current.streamBytes+
      current.atomicCopyBytes+current.extraBytes+(active.mode==='cpu_prepare'?claimBytes:0);
    return {phase:active.mode,phaseBytes,totalBytes,diagnosticBytes,claimBytes,nativeBytes:current.nativeBytes,
      registryBytes:current.registryBytes,streamBytes:current.streamBytes,atomicCopyBytes:current.atomicCopyBytes,
      preparationStreamBytes:active.preparationBytes,conservativeTransportAndRetiredBytes:current.extraBytes-active.preparationBytes-active.externalBytes};}
  function requireBudget(extra=0){assert(Number.isSafeInteger(extra)&&extra>=0);const value=measure(),reserve=active.failure?0:65536;
    assert(value.phaseBytes+extra<=active.maximum-reserve,'qualification phase cumulative output ceiling');
    assert(value.totalBytes+extra<=p.resources.totalOutputBytes-reserve,'qualification total output ceiling');return value;}
  return {measure,requireBudget,
    begin(mode){assert(p.allowedModes.includes(mode));assert(!entries.some(e=>e.mode===mode),'phase already consumed');
      const base=createOwnedAccounting(root,absolute,{outputRoot:p.outputRoot,resources:{...p.resources,maxOutputBytes:p.resources.totalOutputBytes}});
      active={base,mode,initialDirectoryBytes:mode==='cpu_prepare'?0:directoryBytes(absolute),
        maximum:mode==='cpu_prepare'?p.resources.cpuOutputBytes:p.resources.gpuOutputBytes,
        scope:null,failure:false,preparationBytes:0,retiredBytes:0,externalBytes:0};entries.push(active);return active;},
    preparation(bytes){assert(Number.isSafeInteger(bytes)&&bytes>=0);active.preparationBytes+=bytes;requireBudget();},
    external(bytes){assert(Number.isSafeInteger(bytes)&&bytes>=0);active.externalBytes+=bytes;requireBudget();},
    retired(bytes){assert(Number.isSafeInteger(bytes)&&bytes>=0);active.retiredBytes+=bytes;requireBudget();},
    failure(){active.failure=true;active.base.beginFailureClosure();},
    observe(scope){assert.equal(active.scope,null,'one owner per phase');
      assert.equal(path.resolve(scope.guard.path),path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json'));
      active.base.observe(scope);active.scope=scope;requireBudget();},
    observeFailure(error){if(active.scope||error.ownedReceipt?.guard?.state==='existing_guard_refused')return;
      const guard=error.ownedReceipt?.guard;if(!guard)return;assert(/^[a-f0-9-]{36}$/.test(guard.identity));
      const native=path.join(root,'.runtime/ai-painter/owned-worker-guards',guard.identity+'-native');
      if(fs.existsSync(native)){active.base.observe({guard,guardRecord:{identity:guard.identity},nativeBuildDirectory:native});}},
    requireLive(receipt){const scope=active.scope;assert(scope,'this phase retained owner observation required');
      assert.equal(receipt.guard.identity,scope.guardRecord.identity);assert.equal(receipt.ownerIdentity.pid,scope.ownerPid);
      assert.equal(receipt.proof.bindingBase64,scope.bindingBase64);proofPassed(receipt);},
    observeRegistryTransaction(name){active.base.observeRegistryTransaction(name);requireBudget();},
    beforeAtomicWrite(name,bytes){requireBudget(bytes);active.base.beforeAtomicWrite(name,bytes);requireBudget();}};
}
export async function sequenceQualification(cpu,gpu){
  assert.equal(typeof cpu,'function');assert.equal(typeof gpu,'function');const accepted=await cpu();
  assert.equal(accepted.status,'cpu_preparation_passed','CPU did not pass; no GPU');return gpu(accepted);
}
export function validateRequest(value,p,pkg){
  const mode=value.mode;assert(p.allowedModes.includes(mode));const keys=['schemaVersion','runId','mode','outputRoot','policy','package','deadlineUnixMs'];
  if(mode==='gpu_qualify')keys.push('cpuAcceptance');assert.deepEqual(Object.keys(value).sort(),keys.sort());
  assert.equal(value.schemaVersion,p.wireProtocols.request);assert.equal(value.runId,pkg.runId);
  assert.equal(value.outputRoot,p.outputRoot+'/'+pkg.runId);assert.deepEqual(value.policy,POLICY);byteBinding(value.package);
  if(mode==='gpu_qualify')byteBinding(value.cpuAcceptance);requireDeadline(value.deadlineUnixMs);return true;
}
function processIdentity(accounting,deadline){
  requireDeadline(deadline);const command="$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "+process.pid+"'; @{pid=$p.ProcessId;created=$p.CreationDate.ToUniversalTime().ToString('o');executable=$p.ExecutablePath;command=$p.CommandLine}|ConvertTo-Json -Compress";
  const raw=execFileSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:Math.max(1,Math.min(3000,deadline-Date.now())),maxBuffer:8192});
  accounting.external(Buffer.byteLength(raw));const value=JSON.parse(raw);assert.equal(value.pid,process.pid);
  assert.equal(path.resolve(value.executable),path.resolve(process.execPath));assert.equal(path.resolve(process.argv[1]),SELF);
  assert(value.created&&value.command.toLowerCase().includes(path.basename(SELF).toLowerCase()));
  assert(value.command.includes(POLICY.sha256),'OS command does not bind this policy invocation');
  return {processId:process.pid,processStartIdentity:process.pid+':'+value.created,creationTimeUtc:value.created,
    executable:{path:process.execPath,sha256:hash(fs.readFileSync(process.execPath))},commandSha256:hash(Buffer.from(value.command))};
}
function gpuObservation(accounting,deadline){requireDeadline(deadline);
  const raw=execFileSync('nvidia-smi',['--query-gpu=index,uuid,memory.total,memory.free,temperature.gpu','--format=csv,noheader,nounits'],
    {encoding:'utf8',windowsHide:true,timeout:Math.max(1,Math.min(2500,deadline-Date.now())),maxBuffer:16384});
  accounting.external(Buffer.byteLength(raw));const row=raw.trim().split(/\r?\n/).find(value=>value.trim().startsWith('0,'));assert(row,'GPU0 missing');
  const [index,uuid,total,free,temp]=row.split(',').map(value=>value.trim());assert([+index,+total,+free,+temp].every(Number.isFinite));
  return {index:+index,uuid,totalMiB:+total,freeMiB:+free,temperatureC:+temp,observedAtUtc:new Date().toISOString()};
}
export function validateGpuResources(value,p,expectedUuid=null){assert.equal(value.index,0);
  assert(typeof value.uuid==='string'&&value.uuid.length>0);if(expectedUuid!==null)assert.equal(value.uuid,expectedUuid,'GPU identity changed');
  assert(value.freeMiB>=p.resources.minimumFreeVramMiB&&value.temperatureC<p.resources.maximumTemperatureC,'GPU resource guard');return true;}
async function publish(options,accounting){requireDeadline(options.deadlineUnixMs);const prepared=await prepareCurrentExecutionRegistryAdvance(options);
  accounting.observeRegistryTransaction(prepared.transactionRoot);requireDeadline(options.deadlineUnixMs);
  const result=await finalizePreparedCurrentExecutionRegistryAdvance({projectRoot:options.projectRoot,transactionId:prepared.transactionId,
    deadlineUnixMs:options.deadlineUnixMs,beforeAtomicWrite:accounting.beforeAtomicWrite});accounting.requireBudget();requireDeadline(options.deadlineUnixMs);return result;}

const COUNTS=['forwardAttempted','forwardCompleted','generatorAttempted','generatorCompleted','discriminatorAttempted','discriminatorCompleted',
  'optimizerConstruction','optimizerUpdates','cudaCalls','cudaInitializationAttempted','cudaInitializationCompleted'];
export function validateWorkerResult(value,p,mode,packageBinding,runId,expectedSampleIds=null){
  assert.equal(value.schemaVersion,p.wireProtocols.worker);assert.equal(value.runId,runId);assert.equal(value.mode,mode);
  assert.deepEqual(value.policy,POLICY);assert.deepEqual(value.package,byteBinding(packageBinding));
  for(const [key,want] of Object.entries(p.qualification))assert.equal(value[key],want,key);
  assert.deepEqual(Object.keys(value.counts).sort(),[...COUNTS].sort());
  for(const key of COUNTS)assert(Number.isSafeInteger(value.counts[key])&&value.counts[key]>=0,'invalid observed count '+key);
  for(const [kind,max] of [['forward',48],['generator',240],['discriminator',48],['cudaInitialization',1]]){
    assert(value.counts[kind+'Completed']<=value.counts[kind+'Attempted']&&value.counts[kind+'Attempted']<=max,'observed call ceiling '+kind);}
  assert.equal(value.counts.optimizerConstruction,0);assert.equal(value.counts.optimizerUpdates,0);
  if(mode==='cpu_prepare')for(const key of COUNTS)assert.equal(value.counts[key],0,'CPU no-compute boundary');
  if(value.status==='failed_closed'){assert.equal(value.executionState,'failed_closed');assert(value.firstError&&typeof value.firstError.message==='string');return false;}
  assert.equal(value.executionState,'completed');assert.equal(value.status,mode==='cpu_prepare'?'cpu_preparation_passed':'gpu_qualification_passed');
  assert.deepEqual(value.stateDigestBefore,value.stateDigestAfter);assert.deepEqual(value.stateDigestBefore,value.modelIdentity.initialState);
  assert.equal(value.modelIdentity.capabilityVersion,MODEL);assert.equal(value.modelIdentity.parameterCount,108);assert.equal(value.modelIdentity.parameterElements,2242687);
  assert.equal(value.modelIdentity.graph[48].name,p.target.parameterName);assert.deepEqual(value.modelIdentity.graph[48].shape,p.target.weightShape);
  assert(Array.isArray(value.cpuAffinity)&&value.cpuAffinity.length>=1&&value.cpuAffinity.length<=2
    &&new Set(value.cpuAffinity).size===value.cpuAffinity.length&&value.cpuAffinity.every(v=>Number.isInteger(v)&&v>=0));
  assert.equal(value.sampleIds.length,mode==='cpu_prepare'?8:48);assert.equal(new Set(value.sampleIds).size,value.sampleIds.length);
  if(expectedSampleIds!==null)assert.deepEqual(value.sampleIds,expectedSampleIds,'exact original split sample order');
  if(mode==='cpu_prepare'){
    assert.equal(value.cudaInitialized,false);assert.deepEqual(value.completedSampleIds,[]);
    assert.equal(value.componentTests.status,'passed');assert(value.componentTests.testsRun>0);
    for(const key of ['failures','errors','skipped'])assert.equal(value.componentTests[key],0);assert.equal(value.componentTests.realModelAutograd,false);
  }else{
    assert.equal(value.cudaInitialized,true);assert(value.counts.cudaCalls>0);
    for(const [kind,count] of [['forward',48],['generator',240],['discriminator',48],['cudaInitialization',1]])
      for(const suffix of ['Attempted','Completed'])assert.equal(value.counts[kind+suffix],count);
    assert.deepEqual(value.completedSampleIds,value.sampleIds);
  }return true;
}
export function validateCpuAcceptance(value,p,packageBinding,runId){
  assert.equal(value.schemaVersion,'decode1-entry-gpu-qualification-cpu-acceptance-v1');assert.equal(value.status,'cpu_preparation_passed');
  assert.equal(value.runId,runId);assert.deepEqual(value.policy,POLICY);assert.deepEqual(value.package,byteBinding(packageBinding));
  byteBinding(value.ownedReceipt);validateWorkerResult(value.worker,p,'cpu_prepare',packageBinding,runId);return true;
}

export async function runQualification(root=ROOT,value=POLICY){
  const began=Date.now(),mono=performance.now(),cpuDeadline=began+240000;bindPolicy(value);
  const reader=createReader(root),p=reader.bound(POLICY);validatePolicy(p);const paths=reader.paths;
  assert(!fs.existsSync(path.join(root,p.attemptClaimPath)),'qualification attempt already consumed; no retries');
  const initial=await readCurrentExecutionRegistry(root,{deadlineUnixMs:cpuDeadline-8000});assert(initial.ok&&initial.registry.activeExecution===null,'verified idle registry required');
  assert(!fs.existsSync(path.join(root,'.runtime/ai-painter/owned-worker-guards/active.json')),'existing guard refused');
  paths.mkdir('.runtime/ai-painter');paths.mkdir(OUTPUT);
  const runId='decode1-entry-qualification-'+crypto.randomUUID(),out=OUTPUT+'/'+runId,absolute=paths.mkdir(out);
  const accounting=createAccounting(root,absolute,p);accounting.begin('cpu_prepare');
  let deadline=cpuDeadline,phaseMono=mono,phaseMaximum=240000,heartbeatTimer=null,heartbeatError=null,resolved=null,pkg=null,packageBinding=null;
  const phaseResults=[];let cpuAcceptance=null;
  const check=()=>{requireDeadline(deadline);assert(performance.now()-phaseMono<phaseMaximum,'monotonic phase deadline exceeded');
    assert(performance.now()-mono<960000,'qualification total lifecycle deadline exceeded');accounting.requireBudget();};
  function put(name,data,{replace=false,failure=false}={}){
    logical(name);assert(name.endsWith('.json'));check();const bytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
    if(failure)assert(bytes.length<=65536,'bounded first-error evidence');accounting.requireBudget(bytes.length);
    const file=paths.file(out+'/'+name);let retired=0;
    if(replace){retired=fs.statSync(file).size;const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,file);accounting.retired(retired);}
    else fs.writeFileSync(file,bytes,{flag:'wx'});
    return {path:out+'/'+name,sha256:hash(bytes),bytes:bytes.length};
  }
  const totalClaim=Buffer.from(JSON.stringify({schemaVersion:'decode1-entry-qualification-attempt-v1',runId,policy:POLICY,automaticRetries:0,recordedAtUtc:new Date().toISOString()})+'\n');
  accounting.requireBudget(totalClaim.length);fs.writeFileSync(paths.file(p.attemptClaimPath),totalClaim,{flag:'wx'});
  async function phase(mode){
    if(mode==='gpu_qualify'){assert(cpuAcceptance,'same-call CPU proof required');accounting.begin(mode);deadline=Date.now()+720000;phaseMono=performance.now();phaseMaximum=720000;}
    const tag=mode==='cpu_prepare'?'cpu':'qualification',workDeadline=deadline-8000;
    let current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:workDeadline});assert(current.ok&&current.registry.activeExecution===null);
    assert.deepEqual(current.registry.latestTrainingTerminal,initial.registry.latestTrainingTerminal,'training terminal changed');
    put(tag+'-attempt-v1.json',{runId,mode,policy:POLICY,automaticRetries:0});
    let requestBinding=null,capsule=null,live=null,managed=null,worker=null,workerFailure=null,terminal=null,firstError=null,acceptance=null;
    const admission=put(tag+'-admission.json',{runId,executionState:'completed',status:'qualification_phase_admitted_not_training',mode,trainingAllowed:false});
    capsule=put(tag+'-admission-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:runId,runId,integrity:{status:'verified'},
      evidence:[{...admission,sha256Verified:true},{...POLICY,sha256Verified:true}]});
    const common={projectRoot:root,capabilityVersion:CAPABILITY,packageId:runId+'-package',taskId:runId,taskKind:'zero_update_gpu_qualification',
      taskGoal:'Same-package CPU preparation and one zero-update full-train GPU qualification; never start training.',priority:1,
      runId,lifecycleStage:mode,taskCapsulePath:capsule.path,nextMachineAction:null,deadlineUnixMs:deadline};
    try{
      if(mode==='cpu_prepare'){
        resolved=dryResolve(root,POLICY,workDeadline);accounting.preparation(resolved.programBindings.preparationStreamBytes);
        pkg=makePackage(p,runId,resolved.programBindings,resolved.interpreter,resolved.nodeInterpreter);packageBinding=put('package.json',pkg);
      }else{
        const raw=fs.readFileSync(paths.file(packageBinding.path));assert.equal(hash(raw),packageBinding.sha256);assert.deepEqual(JSON.parse(raw),pkg);
        const accepted=reader.bound(cpuAcceptance);validateCpuAcceptance(accepted,p,packageBinding,runId);
      }
      let gpu=null;
      const disk=fs.statfsSync(absolute);assert(disk.bavail*disk.bsize>=2048*1048576,'free disk floor');
      if(mode==='gpu_qualify'){gpu=gpuObservation(accounting,workDeadline);validateGpuResources(gpu,p);put('qualification-gpu-identity.json',gpu);}
      const request={schemaVersion:p.wireProtocols.request,runId,mode,outputRoot:out,policy:POLICY,package:byteBinding(packageBinding),deadlineUnixMs:workDeadline};
      if(mode==='gpu_qualify')request.cpuAcceptance=byteBinding(cpuAcceptance);validateRequest(request,p,pkg);requestBinding=put(tag+'-request.json',request);
      const identity=processIdentity(accounting,workDeadline);put(tag+'-supervisor.json',identity);
      const base={capabilityVersion:CAPABILITY,packageId:common.packageId,runId,processId:identity.processId,processStartIdentity:identity.processStartIdentity};
      const lock=put(tag+'-active-lock.json',{...base,schemaVersion:'ai-painter-current-active-execution-lock-v1'});
      const heartbeatName=tag+'-heartbeat.json';const beat=()=>put(heartbeatName,{...base,schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',
        executionState:'executing',heartbeatAtUtc:new Date().toISOString(),ttlSeconds:30},{replace:fs.existsSync(path.join(absolute,heartbeatName))});
      beat();heartbeatTimer=setInterval(()=>{try{beat();}catch(error){heartbeatError=error;}},5000);
      const lineage=[OWN[0],WORKER,OWN[2],p.implementations.sharedNativeWorker,OWN[6],OWN[7],OWN[8],CANONICAL.path];
      const active={...base,schemaVersion:'ai-painter-current-active-execution-v1',executionState:'executing',
        programLineage:Object.fromEntries(lineage.map((name,index)=>['qualificationProgram'+index,pkg.programBindings.find(b=>b.path===name)])),
        lock:byteBinding(lock),heartbeat:{path:out+'/'+heartbeatName,ttlSeconds:30}};
      capsule=put(tag+'-task-capsule.json',{schemaVersion:'ai-painter-local-task-capsule-v1',taskId:runId,runId,integrity:{status:'verified'},
        evidence:[{...requestBinding,sha256Verified:true},{...packageBinding,sha256Verified:true},{...admission,sha256Verified:true}]});common.taskCapsulePath=capsule.path;
      await publish({...common,executionState:'executing',activity:mode==='cpu_prepare'?'qualification_cpu_preparation_not_training':'zero_update_gpu_qualification_not_training',
        queueStatus:'running',activeExecution:active,terminalEvidencePath:admission.path,expectedPreviousRegistrySha256:current.registrySha256},accounting);
      let lastGpuCheck=0;
      try{managed=await runQualificationOwnedWorker(resolved.python,['-B',path.join(root,WORKER),'--request',requestBinding.path,'--request-sha256',requestBinding.sha256],{
        cwd:root,qualificationPolicy:POLICY,phase:mode==='cpu_prepare'?'cpu':'qualification',
        env:{...process.env,CUDA_VISIBLE_DEVICES:mode==='cpu_prepare'?'':'0',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',
          PYTHONPATH:[path.join(root,'ml/ai-painter/src'),path.join(root,'ml/ai-painter/scripts')].join(path.delimiter),OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'},
        timeout:Math.max(1,workDeadline-Date.now()),maxBuffer:8388608,onSpawn:accounting.observe,
        abortReason:()=>{if(heartbeatError)return 'qualification heartbeat failure';if(Date.now()>=workDeadline)return 'phase execution/cleanup deadline';accounting.requireBudget();
          if(mode==='gpu_qualify'&&Date.now()-lastGpuCheck>=1000){lastGpuCheck=Date.now();validateGpuResources(gpuObservation(accounting,workDeadline),p,gpu.uuid);
            const disk=fs.statfsSync(absolute);assert(disk.bavail*disk.bsize>=2048*1048576,'free disk floor');}return null;}});}
      catch(error){accounting.observeFailure(error);throw error;}
      live=managed.ownedReceipt;accounting.requireLive(live);worker=JSON.parse(managed.stdout);
      const ids=resolved.reader.bound(mode==='cpu_prepare'?p.dataBindings.validationSplit:p.dataBindings.trainSplit).sampleIds;
      assert(validateWorkerResult(worker,p,mode,packageBinding,runId,ids),'worker failed closed');resolved.reader.verifyStable();check();
      const owned=put(tag+'-owned-receipt.json',live);
      if(mode==='cpu_prepare'){
        acceptance=put('cpu-acceptance.json',{schemaVersion:'decode1-entry-gpu-qualification-cpu-acceptance-v1',runId,status:'cpu_preparation_passed',
          policy:POLICY,package:byteBinding(packageBinding),worker,ownedReceipt:byteBinding(owned)});
        validateCpuAcceptance(reader.bound(acceptance),p,packageBinding,runId);
      }
    }catch(error){firstError=error;live=error.ownedReceipt??managed?.ownedReceipt??null;accounting.failure();
      try{if(!worker&&error.stdout)worker=JSON.parse(error.stdout);}catch{/* raw first error remains authoritative */}
      if(worker){try{workerFailure=put(tag+'-worker-failure.json',worker,{failure:true});}
        catch(secondary){firstError.secondaryWorkerEvidenceError=String(secondary);}}
    }finally{if(heartbeatTimer)clearInterval(heartbeatTimer);heartbeatTimer=null;}
    try{
      terminal=put(tag+'-terminal.json',{schemaVersion:'decode1-entry-gpu-qualification-phase-terminal-v1',runId,mode,
        status:firstError?'failed_closed':mode==='cpu_prepare'?'cpu_preparation_passed':'qualification_completed_training_not_started',
        executionState:firstError?'failed_closed':'completed',policy:POLICY,package:packageBinding?byteBinding(packageBinding):null,request:requestBinding,
        worker:firstError?null:worker,workerFailure,actualCounts:worker?.counts??null,
        firstError:firstError?(worker?.firstError??{type:firstError.name,message:String(firstError.message).slice(0,4096)}):null,
        sampleIdentity:worker?.sampleIdentity??null,finiteGradientSummaries:worker?.finiteGradientSummaries??[],cleanup:live,
        outputAccounting:accounting.requireBudget(),accountingScope:'before terminal; returned accounting includes final terminal and registry writes',trainingAllowed:false},
        {failure:firstError!==null});
      current=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(current.ok);
      if(current.registry.activeExecution!==null){assert.equal(current.registry.runId,runId,'unrelated active execution');accounting.requireLive(live);}
      else assert.equal(current.registrySha256,mode==='cpu_prepare'?initial.registrySha256:phaseResults[0].registrySha256,'registry identity changed before terminal');
      await publish({...common,executionState:firstError?'failed_closed':'completed',activity:'qualification_terminal_not_training',
        queueStatus:firstError?'failed_closed':'completed',activeExecution:null,terminalEvidencePath:terminal.path,
        expectedPreviousRegistrySha256:current.registrySha256},accounting);
      const after=await readCurrentExecutionRegistry(root,{deadlineUnixMs:deadline});assert(after.ok&&after.registry.activeExecution===null);
      assert.deepEqual(after.registry.latestTrainingTerminal,initial.registry.latestTrainingTerminal);accounting.requireBudget();check();
      if(firstError)throw firstError;
      const phaseResult={status:mode==='cpu_prepare'?'cpu_preparation_passed':'qualification_completed_training_not_started',terminal,
        registrySha256:after.registrySha256,outputAccounting:accounting.measure(),cpuAcceptance:acceptance};phaseResults.push(phaseResult);return phaseResult;
    }catch(error){if(firstError&&error!==firstError)firstError.secondaryFinalizationError=String(error.stack??error);else firstError??=error;
      firstError.evidence=terminal;throw firstError;}
  }
  const result=await sequenceQualification(()=>phase('cpu_prepare'),async accepted=>{
    assert(accepted===phaseResults[0]);cpuAcceptance=accepted.cpuAcceptance;return phase('gpu_qualify');});
  check();return {runId,status:result.status,terminal:result.terminal,cpuTerminal:phaseResults[0].terminal,
    outputAccounting:accounting.measure(),elapsedMs:Date.now()-began,trainingAllowed:false,stage4Qualified:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
  try{const args=process.argv.slice(2);assert(args.length===4&&args[0]==='--policy'&&args[1]===POLICY.path&&args[2]==='--policy-sha256'&&hex(args[3]),
      'fixed qualification-only scope requires --policy PATH --policy-sha256 SHA; no training mode');
    const value=await runQualification(ROOT,{path:args[1],sha256:args[3]}),raw=JSON.stringify(value)+'\n';assert(Buffer.byteLength(raw)<=8192);process.stdout.write(raw);
  }catch(error){process.exitCode=1;process.stderr.write(JSON.stringify({error:String(error.message).slice(0,4096),evidence:error.evidence??null})+'\n');}
}
