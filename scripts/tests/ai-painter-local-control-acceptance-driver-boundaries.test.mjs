import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {parse} from '@babel/parser';
import {ACCEPTANCE_DRIVER_PARENT,ACCEPTANCE_DRIVER_PROTOCOL,ACCEPTANCE_DRIVER_CANDIDATES,
  ACCEPTANCE_SOURCE_FILES,captureCurrentAcceptanceSources,verifyCurrentAcceptanceSources,
  parseNativeAcceptanceArguments,validateNativeAcceptanceRoot,withNativeAcceptanceCredentials,
  requireAcceptanceIdleSnapshot} from './ai-painter-local-control-native-cpu-v1.mjs';
import {parseInitiatorExitArguments,validateInitiatorFixtureBinding}
  from './ai-painter-local-control-initiator-exit-cpu-v1.mjs';
import {validateLocalStartPackage,LOCAL_CONTROL_REGISTRATION,LOCAL_CONTROL_CAPABILITY,
  LOCAL_CONTROL_PLAN_SCHEMA,LOCAL_CONTROL_OUTPUT_ROOT} from '../run-ai-painter-local-control-v1.mjs';
import {loadPhaseAdapters,PHASES} from '../lib/ai-painter-autonomous-closed-loop-v1.mjs';

// Pure metadata/parameter tests: never create a native owner, launch a lifecycle
// or submit a stop request. All fixture files remain as bounded evidence.
const project=path.resolve('.'),parent=fs.realpathSync(ACCEPTANCE_DRIVER_PARENT);
const selected=process.env.AI_PAINTER_ACCEPTANCE_DRIVER_COMPONENT_ROOT;
assert.ok(selected&&path.isAbsolute(selected));assert.equal(fs.realpathSync(path.dirname(selected)),parent);
assert.match(path.basename(selected),/^components-[a-f0-9]{16}$/u);assert.equal(fs.existsSync(selected),false);fs.mkdirSync(selected);
const root=fs.realpathSync(selected),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const put=(base,relative,value)=>{const file=path.join(base,relative);fs.mkdirSync(path.dirname(file),{recursive:true});const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');fs.writeFileSync(file,bytes,{flag:'wx'});return {path:relative,sha256:hash(bytes)};};
const fresh=kind=>path.join(parent,(kind==='native'?'nc-':'ie-')+crypto.randomBytes(8).toString('hex'));
const identity=kind=>({protocol:ACCEPTANCE_DRIVER_PROTOCOL,candidateSelection:ACCEPTANCE_DRIVER_CANDIDATES[kind],kind});
const argv=(kind,file)=>kind==='native'?['--acceptance-root',file,'--credential-mode','isolated_acceptance_only','--protocol',ACCEPTANCE_DRIVER_PROTOCOL,'--candidate',ACCEPTANCE_DRIVER_CANDIDATES[kind]]:['--acceptance-root',file,'--protocol',ACCEPTANCE_DRIVER_PROTOCOL,'--candidate',ACCEPTANCE_DRIVER_CANDIDATES[kind]];

test('new roots require the exact fixture protocol/candidate; legacy argv retains its result shape',()=>{
  const native=fresh('native'),initiator=fresh('initiator');
  const parsed=parseNativeAcceptanceArguments(argv('native',native));assert.equal(parsed.protocol,ACCEPTANCE_DRIVER_PROTOCOL);assert.equal(validateNativeAcceptanceRoot(native,parsed),native);
  assert.equal(parseInitiatorExitArguments(argv('initiator',initiator)),initiator);
  assert.ok(path.join(initiator,'p','.runtime/ai-painter/autonomous-closed-loop-executions/pe-cpu-pkg01/execution.sqlite').length<260,'new private SQLite path stays within the Windows filename limit');
  const legacy=fs.realpathSync('.runtime/ai-painter/controller-parallel-20261011/migration-local-control');
  const oldNative=path.join(legacy,'native-acceptance-component-'+crypto.randomUUID()),oldInitiator=path.join(legacy,'native-acceptance-initiator-exit-'+crypto.randomUUID());
  assert.deepEqual(parseNativeAcceptanceArguments(['--acceptance-root',oldNative,'--credential-mode','isolated_acceptance_only']),{evidenceRoot:oldNative,credentialMode:'isolated_acceptance_only'});
  assert.equal(validateNativeAcceptanceRoot(oldNative),oldNative);assert.equal(parseInitiatorExitArguments(['--acceptance-root',oldInitiator]),oldInitiator);
  assert.throws(()=>validateNativeAcceptanceRoot(native));assert.throws(()=>parseInitiatorExitArguments(['--acceptance-root',initiator]));
});

test('unknown/current model candidates, arbitrary runners, paths, duplicate flags and protocol drift reject',()=>{
  for(const kind of ['native','initiator']){
    const file=fresh(kind),valid=argv(kind,file),parseArgs=kind==='native'?parseNativeAcceptanceArguments:parseInitiatorExitArguments;
    for(const change of [a=>a.concat('--runner','scripts/arbitrary.mjs'),a=>a.concat('--acceptance-root',file),a=>a.map(v=>v===ACCEPTANCE_DRIVER_PROTOCOL?'ai-painter-local-control-v2':v),a=>a.map(v=>v===ACCEPTANCE_DRIVER_CANDIDATES[kind]?'d1-src-v1':v),a=>a.map(v=>v===ACCEPTANCE_DRIVER_CANDIDATES[kind]?'../candidate.json':v)])assert.throws(()=>parseArgs(change(valid)));
    assert.throws(()=>validateNativeAcceptanceRoot(project,identity(kind)));assert.throws(()=>validateNativeAcceptanceRoot(path.join(root,path.basename(file)),identity(kind)));
    assert.throws(()=>validateNativeAcceptanceRoot(file,identity(kind==='native'?'initiator':'native')));
  }
});

test('reused roots and wrong scope fail before ephemeral authentication mutation',async()=>{
  const before=process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET,reused=fresh('native');fs.mkdirSync(reused);
  await assert.rejects(withNativeAcceptanceCredentials({evidenceRoot:reused,credentialMode:'isolated_acceptance_only',...identity('native')},async()=>assert.fail('no credential callback permitted')));
  await assert.rejects(withNativeAcceptanceCredentials({evidenceRoot:fresh('native'),credentialMode:'isolated_acceptance_only',...identity('initiator')},async()=>assert.fail('wrong fixture kind')));
  assert.equal(process.env.AI_PET_WORLD_OPERATOR_SESSION_SECRET,before);
});

test('current fixed source identity rejects old digests, omissions, extra paths, duplicates and false qualification',()=>{
  for(const kind of ['native','initiator']){
    const binding=captureCurrentAcceptanceSources(kind),result=verifyCurrentAcceptanceSources(binding,kind);
    assert.equal(result.sourceCount,ACCEPTANCE_SOURCE_FILES.length);assert.equal(result.trainingQualified,false);assert.equal(result.nativeCleanupAuthority,false);
    for(const mutate of [b=>b.sources[0].sha256='0'.repeat(64),b=>b.sources.pop(),b=>b.sources.push(b.sources[0]),b=>b.sources[0].path='../arbitrary.mjs',b=>b.candidateSelection='d1-src-v1',b=>b.protocol='ai-painter-local-control-v2',b=>b.trainingQualified=true,b=>b.nativeCleanupAuthority=true,b=>b.historicalFreeze='old.json']){
      const bad=structuredClone(binding);mutate(bad);assert.throws(()=>verifyCurrentAcceptanceSources(bad,kind));
    }
    put(root,kind+'-current-sources.json',binding);
  }
});

test('fixed execution source set covers current relative static imports without adding runtime dispatch paths',()=>{
  // The original production quality adapter is identity-only: private CPU code
  // deliberately replaces it, so its model dependency tree is never executed.
  const excluded=new Set(['scripts/run-ai-painter-ecology-quality-v1.mjs']);
  const files=new Set(ACCEPTANCE_SOURCE_FILES);
  for(const file of files){if(excluded.has(file)||!/[.](?:mjs|ts)$/u.test(file))continue;
    const ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript']});
    for(const n of ast.program.body){if(!['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)||!n.source||n.importKind==='type'||n.exportKind==='type')continue;
      const source=n.source.value;if(source.startsWith('node:'))continue;assert.ok(source.startsWith('.'),'no unbound external runtime import');
      let target=path.posix.normalize(path.posix.join(path.posix.dirname(file),source));if(!fs.existsSync(target))target=['.mjs','.ts','.js'].map(e=>target+e).find(p=>fs.existsSync(p));assert.ok(files.has(target),file+' missing source '+target);
    }
  }
});

test('official idle snapshot, request states and cleanup authority remain separate',()=>{
  const idle={ok:true,status:'verified',registry:{activeExecution:null}};
  assert.deepEqual(requireAcceptanceIdleSnapshot(idle,false),{resourceWindowObservedIdle:true,trainingQualified:false,nativeCleanupAuthority:false});
  for(const current of [null,{ok:false,status:'unknown'}, {...idle,status:'stale'}, {...idle,registry:{}},{...idle,registry:{activeExecution:{runId:'active-training'}}}])assert.throws(()=>requireAcceptanceIdleSnapshot(current,false));
  assert.throws(()=>requireAcceptanceIdleSnapshot(idle,true));
});

function privatePackage(base){
  fs.mkdirSync(base);const programs={},sourceCopies=[];
  for(const file of ACCEPTANCE_SOURCE_FILES){if(file==='scripts/run-ai-painter-ecology-quality-v1.mjs')continue;const bytes=fs.readFileSync(file);programs['source'+sourceCopies.length]=put(base,file,bytes);sourceCopies.push({path:file,sha256:hash(bytes),bytes:bytes.length});}
  const adapter='scripts/run-ai-painter-ecology-quality-v1.mjs';programs.fixtureAdapter=put(base,adapter,fs.readFileSync('scripts/tests/ai-painter-local-control-initiator-exit-cpu-v1.mjs'));
  put(base,'data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json',fs.readFileSync('data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json'));
  put(base,'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json',{schemaVersion:'ai-painter-current-entrypoint-registry-v1',status:'active',currentEntrypoints:[],localControlEntrypoints:[LOCAL_CONTROL_REGISTRATION]});
  const runId='pe-cpu-run01',packageId='pe-cpu-pkg01',outputRoot=LOCAL_CONTROL_OUTPUT_ROOT+'/'+runId;
  const plan=put(base,outputRoot+'/quality-plan.json',{schema:LOCAL_CONTROL_PLAN_SCHEMA,runId,packageId,capabilityVersion:LOCAL_CONTROL_CAPABILITY,outputRoot,programBindings:programs});
  const spec={schemaVersion:'ai-painter-autonomous-closed-loop-package-v1',packageIdentity:packageId,capabilityVersion:LOCAL_CONTROL_CAPABILITY,ownerAuthorizationRequired:false,ownerInStateMachine:false,maxInfrastructureRecoveryAttempts:0,outputRoot,programLineage:Object.fromEntries(Object.entries(programs).map(([k,b])=>[k,b.sha256])),inputEvidence:[plan],phaseAdapters:Object.fromEntries(PHASES.map(p=>[p,{kind:'project_module_export',...programs.fixtureAdapter,exportName:p}])),fixtureOnly:true,modelTraining:false,gpuAllowed:false};
  const pkg=put(base,'.runtime/ai-painter/autonomous-closed-loop-packages/'+packageId+'/package.json',spec);
  validateLocalStartPackage(base,{command:'start',packagePath:pkg.path,packageSha256:pkg.sha256});
  return {spec,pkg,sourceCopies,fixtureAdapter:programs.fixtureAdapter};
}

test('private copied CLI package and CPU adapter remain importable and exactly SHA validated',async()=>{
  const base=path.join(root,'private-project'),{spec}=privatePackage(base);
  const adapters=await loadPhaseAdapters(spec,{root:base});for(const p of PHASES)assert.equal(typeof adapters[p],'function');
  const loaded=await import(pathToFileURL(path.join(base,'scripts/run-ai-painter-local-control-v1.mjs')).href);assert.equal(typeof loaded.runLocalControl,'function');
  assert.equal(fs.existsSync(path.join(base,'.runtime/ai-painter/autonomous-closed-loop-executions')),false,'no lifecycle was started');
});

test('internal initiator validates private package/root/source/deadline and one-time consumption',()=>{
  const base=fresh('initiator');fs.mkdirSync(base);const privateRoot=path.join(base,'p'),{pkg,sourceCopies,fixtureAdapter}=privatePackage(privateRoot);
  const packagePath=pkg.path;
  const binding={schema:'private-initiator-exit-cpu-binding-v1',acceptanceRoot:base,fixtureProjectRoot:privateRoot,currentSourceBinding:captureCurrentAcceptanceSources('initiator'),sourceCopies,fixtureAdapter,fixtureOnly:true,modelTraining:false,gpuAllowed:false,packagePath,packageSha256:pkg.sha256,deadlineMs:Date.now()+30000};
  assert.equal(validateInitiatorFixtureBinding(base,binding).trainingQualified,false);
  for(const patch of [{fixtureProjectRoot:project},{packagePath:'.runtime/ai-painter/current-execution-registry/current.json'},{packageSha256:'0'.repeat(64)},{gpuAllowed:true},{modelTraining:true},{deadlineMs:Date.now()-1},{deadlineMs:Date.now()+130000},{currentSourceBinding:{}},{sourceCopies:[]},{fixtureAdapter:{path:fixtureAdapter.path,sha256:'0'.repeat(64)}}])assert.throws(()=>validateInitiatorFixtureBinding(base,{...binding,...patch}));
  put(privateRoot,'.runtime/fixture/initiator.json',{privateConsumed:true});assert.throws(()=>validateInitiatorFixtureBinding(base,binding),/already consumed/);
  fs.appendFileSync(path.join(privateRoot,fixtureAdapter.path),'\n// altered private adapter');assert.throws(()=>validateInitiatorFixtureBinding(base,binding),/CPU adapter bytes changed/);
  const changedAdapter={path:fixtureAdapter.path,sha256:hash(fs.readFileSync(path.join(privateRoot,fixtureAdapter.path)))};
  assert.throws(()=>validateInitiatorFixtureBinding(base,{...binding,fixtureAdapter:changedAdapter}),/exact fixed CPU adapter/u,'recomputing a caller SHA cannot authorize a replacement script');
});

test('help commands are read-only and disclose scope without running native fixtures',()=>{
  for(const file of ['ai-painter-local-control-native-cpu-v1.mjs','ai-painter-local-control-initiator-exit-cpu-v1.mjs']){
    const result=spawnSync(process.execPath,['scripts/tests/'+file,'--help'],{cwd:project,env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2'},windowsHide:true,encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/ai-painter-local-control-v1/u);assert.match(result.stdout,/v2 preparation/u);
  }
});

test('real driver argument dispatch rejects another cwd before any acceptance files or native build',()=>{
  for(const kind of ['native','initiator']){
    const file=fresh(kind),driver=kind==='native'?'ai-painter-local-control-native-cpu-v1.mjs':'ai-painter-local-control-initiator-exit-cpu-v1.mjs';
    const result=spawnSync(process.execPath,[path.join(project,'scripts/tests',driver),...argv(kind,file)],{cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:''},windowsHide:true,encoding:'utf8',timeout:5000});
    assert.equal(result.status,1);assert.match(result.stderr,/source project working directory/u);assert.equal(fs.existsSync(file),false);
  }
});
