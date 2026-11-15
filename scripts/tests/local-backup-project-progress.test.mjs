import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {readProjectProgress} from '../../src/server/local-backup/project-progress.mjs'
import {PROGRESS_PLAN,PROGRESS_SNAPSHOT,PROGRESS_SOURCES,PROGRESS_STAGES} from '../../src/server/local-backup/project-progress-catalog.mjs'
import {MVP_SPEC} from '../../src/server/local-backup/project-progress-mvp.mjs'

const sha=b=>createHash('sha256').update(b).digest('hex'),at='2026-10-28T08:00:00.000Z'
const fixtureBase=process.env.PROJECT_PROGRESS_FIXTURE_ROOT??os.tmpdir()
export function progressFixture(){
 fs.mkdirSync(fixtureBase,{recursive:true});const root=fs.mkdtempSync(path.join(fixtureBase,'local-backup-progress-')),runtimeRoot=path.join(root,'.runtime')
 const put=(logical,value)=>{const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value)),file=path.join(root,logical);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return {path:logical,sha256:sha(bytes)}}
 const values={
  closure095:{status:'experiment_completed_candidate_rejected',decision:{absoluteOutcome:'failed'},formalQualificationGranted:false},
  training095:{schemaVersion:'ai-painter-learning-capacity-experiment-terminal-v1',runId:'fixture-095',executionState:'completed',formalTrainingQualified:false,actualFinalOptimizerSteps:{generator:200,discriminator:200}},
  reference096:{status:'reference_comparison_verified_not_qualification',actualAuditCalls:112},
  persistence097:{status:'natural_persistence_component_accepted_with_limits',formalQualificationGranted:false,worldMvpCompleted:false,tests:{failed:0,controllerTargetedPassed:80},delivered:['actual independent-process read/write and full identity/state/RNG/hash restoration']},
  facts098:{taskId:'NATURAL-WORLD-FACTS-098',status:'facts_conditions_private_save_restore_component_accepted',hashBindingsChecked:115,independentReadback:{status:'independent_readback_and_real_source_replay_passed',factsReplay:true,channelCount:23}},
  input102:{taskId:'NATURAL-WORLD-MODEL-INPUT-102',status:'natural_world_model_input_component_accepted',bindingsChecked:868,independentNativeValuesCompared:18087936,objects:52,descriptor:{sha256:'a'.repeat(64)}},
  probe104:{status:'actual_image_and_existing_proxy_review_component_accepted',modelQualified:false,framePublished:false,mvpAccepted:false},
  gradient130:{status:'accepted_actual_wall_stop_not_full_qualification',actualCalls:{gGradientCompletions:4,gGradientAttempts:5},completeGradientGate:'not_evaluated_missing_objectSupportStructure',wallSeconds:599.906},
  observer131:{taskId:'NATIVE-BOUNDARY-OBSERVATION-131',status:'passed_observer_CPU_semantics_and_cleanup',CPUWallNotGPUAcceleration:true},
 }
 const plan=put(PROGRESS_PLAN,'# 唯一计划\n| 编号 | 模块 | 目标 | 状态 | 验收 |\n|---|---|---|---|---|\n'+Array.from({length:9},(_,i)=>`| ${i+1} | 正式模块${i+1} | 正式目标${i+1} | 指南声明${i+1} | 原验收${i+1} |`).join('\n'))
 const checklist={version:'mvp-acceptance-checklist-v1',...put(MVP_SPEC,fs.readFileSync(MVP_SPEC,'utf8')),changeReason:'隔离夹具：整体48项计数'}
 const snapshot={schemaVersion:'local-backup-project-progress-snapshot-v2',recordedAtUtc:at,verifiedAtUtc:at,source:{category:'codex',reporterId:'codex-backup',threadId:'01a15f92-889e-7772-a395-e8b9e7fe4b5a'},scopeId:'natural-world-first',plan,checklist,evidence:Object.entries(PROGRESS_SOURCES).map(([id,b])=>({id,...put(b.path,values[id])})),stages:PROGRESS_STAGES.map(s=>({id:s.id,status:s.status,summary:'限定范围的组件说明',detail:'真实审核与完整模型资格分别核验。',evidenceIds:[...s.evidence]})),notes:[{title:'外部分析',body:'只读情况说明，建议不是执行命令。',evidenceIds:['gradient130']}]}
 const save=()=>put(PROGRESS_SNAPSHOT,snapshot);save()
 return {root,runtimeRoot,snapshot,values,put,save,read:(now=Date.parse(at)+1000)=>readProjectProgress({projectRoot:root,runtimeRoot,now})}
}
function expectReject(change,code){const f=progressFixture();change(f);assert.throws(()=>f.read(),e=>e.message===code)}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
test('one authenticated projection separates components, native gate, old training, quality, release and world loop',()=>{
 const f=progressFixture(),v=f.read().projection;assert.equal(v.plan.modules.length,9);assert.equal(v.plan.sha256,f.snapshot.plan.sha256);assert.equal(v.live,false);assert.equal(v.source.category,'codex')
 assert.deepEqual(Object.values(v.counts).map(c=>c.count),[3,2,3]);assert.equal(v.stages.length,8);assert.equal(v.distinctions.historicalTraining.optimizerSteps.generator,200);assert.equal(v.distinctions.historicalTraining.qualified,false);assert.equal(v.distinctions.nativeGradient.completed,4);assert.equal(v.distinctions.nativeGradient.attempted,5);assert.equal(v.distinctions.worldLoop,'not_accepted')
 assert.equal(v.plan.modules.filter(m=>m.deferred).length,3);assert.equal(v.coverage.directoryScan,false);assert.equal(v.coverage.stateWrites,false);assert(v.coverage.files<=24)
 assert(v.evidence.filter(e=>e.href).every(e=>/^\/local-backup\/work\/codex-[a-f0-9]{64}$/.test(e.href)));assert(!Object.hasOwn(v,'percent'))
})
test('read does not enumerate directories or change any bound file',()=>{
 const f=progressFixture(),files=[PROGRESS_PLAN,PROGRESS_SNAPSHOT,MVP_SPEC,...f.snapshot.evidence.map(e=>e.path)],before=files.map(p=>sha(fs.readFileSync(path.join(f.root,p)))),original=fs.readdirSync
 fs.readdirSync=()=>{throw Error('GET must not scan')};try{f.read()}finally{fs.readdirSync=original}
 assert.deepEqual(files.map(p=>sha(fs.readFileSync(path.join(f.root,p)))),before)
})
for(const [name,change,code]of [
 ['missing snapshot',f=>fs.renameSync(path.join(f.root,PROGRESS_SNAPSHOT),path.join(f.root,PROGRESS_SNAPSHOT+'.retained')),'progress_fixed_source_missing'],
 ['corrupt snapshot',f=>f.put(PROGRESS_SNAPSHOT,'{"broken"'),'progress_json_invalid'],
 ['wrong schema',f=>{f.snapshot.schemaVersion='future';f.save()},'progress_snapshot_schema'],
 ['unknown producer',f=>{f.snapshot.source.category='local_program';f.save()},'progress_unknown_producer'],
 ['arbitrary extra path input',f=>{f.snapshot.readPath='.env';f.save()},'progress_snapshot_shape'],
 ['wrong plan digest',f=>{f.snapshot.plan.sha256='0'.repeat(64);f.save()},'progress_plan_sha_conflict'],
 ['actual plan revision changed',f=>fs.appendFileSync(path.join(f.root,PROGRESS_PLAN),'\nchanged'),'progress_plan_sha_conflict'],
 ['arbitrary plan path',f=>{f.snapshot.plan.path='../../.env';f.save()},'progress_plan_sha_conflict'],
 ['evidence traversal',f=>{f.snapshot.evidence[0].path='../../.env';f.save()},'progress_evidence_identity_invalid'],
 ['unknown evidence source',f=>{f.snapshot.evidence[0].id='unknown';f.save()},'progress_evidence_identity_invalid'],
 ['wrong actual digest',f=>{f.snapshot.evidence[0].sha256='0'.repeat(64);f.save()},'progress_evidence_sha_conflict'],
 ['duplicate evidence',f=>{f.snapshot.evidence.push(f.snapshot.evidence[0]);f.save()},'progress_evidence_identity_invalid'],
 ['unknown stage state',f=>{f.snapshot.stages[0].status='all_done';f.save()},'progress_stage_invalid'],
 ['unqualified world promoted',f=>{f.snapshot.stages[7].status='component_verified';f.save()},'progress_unbound_or_conflicting_state'],
 ['missing evidence claimed passed',f=>{f.snapshot.stages[0].evidenceIds=[];f.save()},'progress_unbound_or_conflicting_state'],
 ['unregistered evidence in stage',f=>{f.snapshot.stages[0].evidenceIds=['gradient130'];f.save()},'progress_stage_evidence_invalid'],
 ['oversize snapshot',f=>f.put(PROGRESS_SNAPSHOT,' '.repeat(128*1024+1)),'progress_file_limit_or_boundary'],
 ['oversize plan',f=>f.put(PROGRESS_PLAN,' '.repeat(256*1024+1)),'progress_file_limit_or_boundary'],
 ['oversize bound evidence',f=>f.put(f.snapshot.evidence[0].path,' '.repeat(256*1024+1)),'progress_file_limit_or_boundary'],
 ['future verification time',f=>{f.snapshot.recordedAtUtc='2027-01-01T00:00:00Z';f.snapshot.verifiedAtUtc=f.snapshot.recordedAtUtc;f.save()},'progress_snapshot_time_invalid'],
 ['mixed stage identities',f=>{[f.snapshot.stages[0],f.snapshot.stages[1]]=[f.snapshot.stages[1],f.snapshot.stages[0]];f.save()},'progress_stage_invalid'],
 ['caller supplied evidence link',f=>{f.snapshot.evidence[0].href='https://evil.example';f.save()},'progress_evidence_identity_invalid'],
])test('refuses '+name,()=>expectReject(change,code))
test('self-consistent SHA replacement cannot grant model qualification',()=>expectReject(f=>{
 const b=f.snapshot.evidence.find(e=>e.id==='probe104'),value={...f.values.probe104,modelQualified:true};b.sha256=f.put(b.path,value).sha256;f.save()
},'progress_evidence_semantic_conflict'))
test('missing stage evidence stays unverified and changes the shared count',()=>{
 const f=progressFixture();f.snapshot.stages[0].evidenceIds=[];f.snapshot.stages[0].status='not_verified';f.save();const v=f.read().projection;assert.equal(v.stages[0].evidenceComplete,false);assert.equal(v.counts.component_verified.count,2);assert.equal(v.counts.not_verified.count,4)
})
test('old snapshots remain explicitly historical and future timestamps never masquerade as fresh',()=>{
 const f=progressFixture(),v=f.read(Date.parse(at)+25*3600000);assert.equal(v.dataStatus,'unknown_or_stale');assert.equal(v.reasonCode,'progress_snapshot_stale');assert.equal(v.projection.stale,true);assert.equal(v.projection.live,false)
})
test('wrong runtime mapping refuses the only permitted root junction',()=>{
 const f=progressFixture(),elsewhere=path.join(f.root,'different-runtime');fs.mkdirSync(elsewhere);assert.throws(()=>readProjectProgress({projectRoot:f.root,runtimeRoot:elsewhere}),/progress_runtime_mapping_conflict/)
})
test('a descendant directory junction cannot escape even when its target bytes have the expected digest',()=>{
 const f=progressFixture(),b=f.snapshot.evidence.find(e=>e.id==='facts098'),original=path.join(f.root,path.dirname(b.path)),moved=original+'-retained';fs.renameSync(original,moved);fs.symlinkSync(moved,original,process.platform==='win32'?'junction':'dir');assert.throws(()=>f.read(),/progress_path_boundary/)
})
test('hard-linked evidence is rejected without reading target content',()=>{
 const f=progressFixture(),file=path.join(f.root,f.snapshot.evidence[0].path);fs.linkSync(file,file+'.retained-link');assert.throws(()=>f.read(),/progress_file_limit_or_boundary/)
})
test('a snapshot revision changed during child reads is refused',()=>{
 const f=progressFixture(),original=fs.openSync,trigger=PROGRESS_SOURCES.observer131.path;let changed=false
 fs.openSync=(file,...args)=>{if(!changed&&String(file).replaceAll('\\','/').endsWith(trigger)){changed=true;fs.appendFileSync(path.join(f.root,PROGRESS_SNAPSHOT),' ')}return original(file,...args)}
 try{assert.throws(()=>f.read(),/progress_mixed_revision/)}finally{fs.openSync=original}assert(changed)
})
}

import ts from 'typescript'
import {need,ModuleError} from '../../src/server/local-backup/contracts.mjs'

for(const kind of ['progress','truth','work-plan'])for(const scenario of ['stable','file-replaced','device-replaced',...(kind==='progress'?['opened-file']:[])]) {
 test(`progress readers exact identity ${kind}/${scenario}`,t=>{
  const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'progress-exact-identity-'))),runtime=path.join(root,'.runtime'),logical='docs/fixture.md',file=path.join(root,'docs','fixture.md'),original='private progress evidence'
  fs.mkdirSync(runtime);fs.mkdirSync(path.dirname(file));fs.writeFileSync(file,original,{flag:'wx'})
  const sourceFile='src/server/local-backup/project-progress'+(kind==='progress'?'':kind==='truth'?'-truth':'-work-plan')+'.mjs'
  const tree=ts.createSourceFile(sourceFile,fs.readFileSync(sourceFile,'utf8'),ts.ScriptTarget.Latest,true)
  let fn
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===(kind==='progress'?'fixedReader':'read')){assert.equal(fn,undefined);fn=node}ts.forEachChild(node,visit)}visit(tree);assert(fn)
  const base=9007199254740992n,opened=new Set();let read=false
  const alter=(stat,options,handle=false)=>{const ino=base+(scenario==='opened-file'&&handle||scenario==='file-replaced'&&read&&!handle?1n:0n),dev=7n+(scenario==='device-replaced'&&read&&!handle?1n:0n);stat.ino=options?.bigint?ino:Number(ino);stat.dev=options?.bigint?dev:Number(dev);return stat}
  const io={...fs,
   lstatSync(p,options){const stat=fs.lstatSync(p,options);return p===file?alter(stat,options):stat},
   openSync(p,...args){const fd=fs.openSync(p,...args);if(p===file)opened.add(fd);return fd},
   fstatSync(fd,options){const stat=fs.fstatSync(fd,options);return opened.has(fd)?alter(stat,options,true):stat},
   readSync(fd,...args){const n=fs.readSync(fd,...args);if(opened.has(fd))read=true;return n},
   readFileSync(p,...args){const bytes=fs.readFileSync(p,...args);if(p===file)read=true;return bytes},
   closeSync(fd){opened.delete(fd);return fs.closeSync(fd)},
  }
  const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
  const globals={fs:io,path,need,ModuleError,TextDecoder,Buffer,hash:sha,sha,same,samePath:same,root,runtime,cache:new Map(),began:Date.now(),caps:{files:24,total:4*1024*1024},CURRENT_WORLD_BASELINE_SOURCE_PATHS:[]}
  const handleTree=ts.createSourceFile('read-handle.mjs',fs.readFileSync('src/server/local-backup/read-handle.mjs','utf8'),ts.ScriptTarget.Latest,true)
  const handleFunction=handleTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='withReadHandle').getText(handleTree).replace(/^export\s+/,'')
  const code='let files=0,totalBytes=0,reads=0,bytes=0;'+handleFunction+';'+fn.getText(tree)+';return '+(kind==='progress'?'fixedReader(root,runtime).read':'read')+';'
  const invoke=new Function(...Object.keys(globals),code)(...Object.values(globals))
  if(scenario==='stable'){const result=invoke(logical,1024);assert.equal(result.sha256,sha(Buffer.from(original)));assert.equal(kind==='progress'?result.body:result.bytes.toString('utf8'),original);assert.doesNotThrow(()=>JSON.stringify(result))}
  else assert.throws(()=>invoke(logical,1024),error=>error.message===(kind==='work-plan'?'work_plan':kind)+'_source_changed')
  assert.equal(opened.size,0);assert.equal(fs.readFileSync(file,'utf8'),original);t.diagnostic('retained private fixture: '+root)
 })
}


for(const scenario of ['stable','chunked','early-eof','short-read','negative','noninteger','oversized','opened-mtime','opened-ctime','opened-links','after-ctime','path-mtime','path-ctime','path-size','path-links','read-error','read-null','read-undefined','close-error','both-error','both-null','both-domain']){
 test(`progress exact read and cleanup ${scenario}`,t=>{
  const f=progressFixture(),target=path.join(f.root,PROGRESS_PLAN),baseline=f.read(),initial=fs.readFileSync(target)
  const first=scenario==='read-null'||scenario==='both-null'?null:scenario==='read-undefined'?undefined:scenario==='both-domain'?new ModuleError('progress_source_changed',409):new Error('private progress read error')
  const closing=new Error('private progress close error'),readFails=scenario.startsWith('read-')||scenario.startsWith('both-'),closeFails=scenario==='close-error'||scenario.startsWith('both-')
  const native={openSync:fs.openSync,readSync:fs.readSync,closeSync:fs.closeSync,fstatSync:fs.fstatSync,lstatSync:fs.lstatSync},held=new Set();let reads=0,stats=0,closes=0
  const amend=(s,key)=>{if(key==='links')s.nlink+=1n;else if(key==='size')s.size+=1n;else s[key+'Ns']+=1n;return s}
  const mocks=[t.mock.method(fs,'openSync',(p,...args)=>{const fd=native.openSync(p,...args);if(p===target)held.add(fd);return fd}),t.mock.method(fs,'readSync',(fd,buffer,offset,length,position)=>{
   if(!held.has(fd))return native.readSync(fd,buffer,offset,length,position)
   reads++;if(readFails)throw first
   if(scenario==='early-eof'||scenario==='short-read'&&reads>1)return 0
   if(scenario==='negative')return -1
   if(scenario==='noninteger')return NaN
   if(scenario==='oversized')return length+1
   return native.readSync(fd,buffer,offset,['chunked','short-read'].includes(scenario)?Math.min(4,length):length,position)
  }),t.mock.method(fs,'fstatSync',(fd,options)=>{const s=native.fstatSync(fd,options);if(held.has(fd)){const n=stats++;if(n===0&&scenario.startsWith('opened-'))return amend(s,scenario.slice(7));if(n>0&&scenario==='after-ctime')return amend(s,'ctime')}return s}),t.mock.method(fs,'lstatSync',(p,options)=>{const s=native.lstatSync(p,options);return p===target&&reads>0&&scenario.startsWith('path-')?amend(s,scenario.slice(5)):s}),t.mock.method(fs,'closeSync',fd=>{const tracked=held.delete(fd),result=native.closeSync(fd);if(tracked){closes++;if(closeFails)throw closing}return result})]
  try{
   if(['stable','chunked'].includes(scenario))assert.deepEqual(f.read(),baseline)
   else{
    let error;try{f.read();assert.fail('unexpected progress success')}catch(e){error=e}
    assert(error instanceof ModuleError)
    const boundary=!(scenario.startsWith('read-')||scenario==='close-error'||scenario.startsWith('both-'))||scenario==='both-domain'
    assert.equal(error.message,boundary?'progress_source_changed':'progress_source_unavailable');assert.equal(error.status,boundary?409:503)
    if(readFails&&closeFails){assert(error.cause instanceof AggregateError);assert.deepEqual(error.cause.errors,[first,closing]);assert.strictEqual(error.cause.cause,first)}
    else if(readFails||closeFails){assert(Object.hasOwn(error,'cause'));assert.strictEqual(error.cause,readFails?first:closing)}
    assert(!JSON.stringify(error).includes('private progress'))
   }
   assert.equal(held.size,0);assert.equal(closes,['stable','chunked'].includes(scenario)?2:1)
  }finally{for(const mock of mocks.reverse())mock.mock.restore()}
  assert.deepEqual(fs.readFileSync(target),initial);t.diagnostic('retained private fixture: '+f.root)
 })
}
