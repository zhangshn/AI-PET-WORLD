import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {parseWorkPlan,readProjectWorkPlan,WORK_PLAN_GUIDE,WORK_PLAN_STATUS} from '../../src/server/local-backup/project-progress-work-plan.mjs'
import {diagramSources,extractDiagrams,safeDiagramSource} from '../../src/server/local-backup/diagram-extract.mjs'
import {documentRegistration} from '../../src/server/local-backup/document-catalog.mjs'
import {uiHarness,response} from './helpers/local-backup-ui.mjs'
import ts from 'typescript'
import {progressFixture} from './local-backup-project-progress.test.mjs'
import {readProjectProgress} from '../../src/server/local-backup/project-progress.mjs'
import {verifyFrozenMvpBindings} from '../../src/server/local-backup/mvp-acceptance-contracts.mjs'
import {PROGRESS_SNAPSHOT} from '../../src/server/local-backup/project-progress-catalog.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
function fixture(mode='missing'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'world-baseline-plan-141-')),put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v))}
 const markdown=fs.readFileSync(WORK_PLAN_GUIDE,'utf8'),definition=parseWorkPlan(markdown);put(WORK_PLAN_GUIDE,markdown);fs.mkdirSync(path.join(root,'.runtime'),{recursive:true})
 const planSha256=hash(markdown),specificationSha256='a'.repeat(64),report={schemaVersion:'work-plan-status-v1',taskId:'WORK-PLAN-139',source:{category:'codex',reporterId:'codex-controller',threadId:'01a16ccd-a67b-7ae0-b614-a0415398ae0b'},planSha256:mode==='conflict'?'b'.repeat(64):planSha256,specificationSha256,verifiedAtUtc:'2026-10-28T14:00:00Z',evidenceCatalog:[],rows:definition.items.map(item=>({itemId:item.id,status:'unverified',completedParts:[],remainingParts:['私有夹具未提交本轮实际核验证据'],reason:'私有夹具不授予真实世界或组件完成',evidenceIds:[],completedAtUtc:null,verifiedAtUtc:'2026-10-28T14:00:00Z'}))}
 if(mode!=='missing')put(WORK_PLAN_STATUS,report)
 const read=()=>readProjectWorkPlan({projectRoot:root,runtimeRoot:path.join(root,'.runtime'),planSha256,specificationSha256,modules:Array.from({length:9},(_,i)=>({id:String(i+1),title:'模块'+(i+1)}))})
 return {root,put,read,definition,report,markdown}
}
test('formal4 steps survive missing status; no current world or stage percentage invented',()=>{
 const f=fixture(),r=f.read(),d=r.currentDelivery;assert.equal(r.status,'not_connected');assert.equal(r.totals,null);assert.equal(d.steps.length,4);assert.equal(d.worldBaseline.label,'本轮世界基线尚未登记');assert.equal(d.worldBaseline.worldId,null);assert.equal(d.worldBaseline.percentage,null)
 assert.deepEqual(d.steps.map(({planItems,...rest})=>{assert(planItems.length>0);return rest}),f.definition.currentDelivery.steps);assert.equal(f.definition.items.length,134)
})
test('status authority conflict cannot hide valid formal goals; reference definitions remain available',()=>{
 const f=fixture('conflict'),r=f.read();assert.equal(r.status,'unverifiable');assert.equal(r.reasonCode,'work_plan_authority_conflict');assert.equal(r.totals,null);assert.equal(r.currentDelivery.objective,f.definition.currentDelivery.objective);assert(r.currentDelivery.steps.every(s=>s.planItems.every(i=>i.title&&i.doneWhen)))
})

test('missing fixed selection remains explicitly unregistered in every plan state and both views',()=>{
 for(const mode of ['missing','conflict','current']){
  const plan=fixture(mode).read(),baseline=plan.currentDelivery.worldBaseline
  assert.equal(baseline.status,'not_registered');assert.notEqual(baseline.status,'baseline_verified');assert.equal(baseline.worldId,null);assert.equal(baseline.percentage,null)
  assert(baseline.reason.includes('已查询本轮固定选择记录'));assert(baseline.reason.includes('不代表其他世界不存在'))
  for(const compact of [false,true]){
   const ui=uiHarness('src/app/local-backup/progress/current-delivery.tsx','CurrentDelivery',{props:{plan,compact}})
   try{const text=ui.text();assert(text.includes('本轮世界基线尚未登记'));assert(text.includes('本轮worldId：尚未登记'));assert(!text.includes('本轮worldId：尚未查询'));assert(!ui.nodes().some(n=>n.type==='progress'))}finally{ui.unmount()}
  }
 }
})
test('current world aggregation does not add a fifth group or change134 denominator',()=>{
 const f=fixture('current'),r=f.read();assert.equal(r.totals.total,134);assert.equal(r.modules.length,9);assert.equal(r.totals.completed,0);assert.equal(r.currentDelivery.worldBaseline.percentage,null);assert.equal(r.currentDelivery.planSource.version,'work-plan-141-v1')
})
test('documents use fixed IDs and Guide diagram appends to position16 with actual source hash',()=>{
 const f=fixture(),d=f.read().currentDelivery;for(const item of d.documents){assert(documentRegistration.some(r=>r.documentId===item.documentId&&r.relativePath===item.path&&!r.restricted));assert.equal(new URL(item.href,'http://localhost').searchParams.get('id'),item.documentId)}
 assert.equal(diagramSources.indexOf(WORK_PLAN_GUIDE),16);assert.equal(diagramSources[0],'docs/BUSINESS_SPEC.md');assert.equal(diagramSources[15],'docs/ziwei/DATA_DICTIONARY_MASTER_BLUEPRINT.md')
 const diagrams=extractDiagrams({content:f.markdown,sha256:hash(f.markdown),relativePath:WORK_PLAN_GUIDE,documentId:d.diagram.documentId,title:'唯一计划'}),actual=diagrams.find(item=>item.diagramId===d.diagram.diagramId);assert(actual);assert.equal(actual.section,d.diagram.section);assert.equal(actual.module,'world');assert.equal(actual.sourceDocumentSha256,d.planSource.sha256);assert.equal(safeDiagramSource(actual.source),actual.source)
})
test('invalid step target and unregistered/restricted document cannot enter current plan',()=>{
 for(const change of [p=>p.currentDelivery.steps[0].planItemIds=['PLAN-99-999'],p=>p.currentDelivery.documents[0].path='docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md',p=>p.currentDelivery.documents[0].path='../../secrets.md']){const f=fixture(),p=structuredClone(f.definition);change(p);assert.throws(()=>parseWorkPlan('```json\n'+JSON.stringify(p)+'\n```'),/current_delivery_/)}
})
test('plan reads never scan, repair state, create a world or rewrite source',()=>{
 const f=fixture('conflict'),before=fs.readFileSync(path.join(f.root,WORK_PLAN_STATUS)),original=fs.readdirSync;fs.readdirSync=()=>{throw Error('no scans')};try{const r=f.read();assert(r.currentDelivery);assert.equal(r.totals,null)}finally{fs.readdirSync=original}assert.deepEqual(fs.readFileSync(path.join(f.root,WORK_PLAN_STATUS)),before)
})
test('detailed UI renders all actions/outputs/criteria and marks linked states component-only',()=>{
 const f=fixture('conflict'),plan=f.read(),ui=uiHarness('src/app/local-backup/progress/current-delivery.tsx','CurrentDelivery',{props:{plan}})
 try{const text=ui.text();for(const step of f.definition.currentDelivery.steps){assert(text.includes(step.title));for(const action of step.actions)assert(text.includes(action));assert(text.includes(step.deliverable));assert(text.includes(step.doneWhen))}assert(text.includes('本轮世界基线尚未登记'));assert(text.includes('work_plan_authority_conflict'));assert(text.includes('不能替代本轮选定世界'));assert(!ui.nodes().some(n=>n.type==='progress'));assert(ui.nodes().filter(n=>n.type==='a').some(n=>n.props.href===plan.currentDelivery.diagram.href))}finally{ui.unmount()}
})
test('overview current delivery links to detailed plan; hash selects plan on direct entry and refresh',async()=>{
 const f=fixture(),workPlan=f.read(),projection=(await import('./local-backup-project-progress.test.mjs')).progressFixture().read().projection;projection.workPlan=workPlan
 const ui=uiHarness('src/app/local-backup/progress/project-progress.tsx','ProjectProgressPanel',{url:'http://localhost:3000/local-backup/work#current-delivery',fetch:async()=>response({projection})})
 try{await ui.tick();assert(ui.nodes().some(n=>n.props?.role==='tab'&&n.props.id==='progress-tab-plan'&&n.props['aria-selected']));assert(ui.text().includes(workPlan.currentDelivery.title));assert(ui.text().includes('四步骤详细内容'));ui.hash('#project-progress');assert(ui.text().includes(workPlan.currentDelivery.title))}finally{ui.unmount()}
})

test('repeated known current-delivery fragment still selects plan; other fragments do not become navigation',async()=>{const f=fixture(),projection=(await import('./local-backup-project-progress.test.mjs')).progressFixture().read().projection;projection.workPlan=f.read();for(const [fragment,expected] of [['#current-delivery#current-delivery',true],['#current-delivery#other',false]]){const ui=uiHarness('src/app/local-backup/progress/project-progress.tsx','ProjectProgressPanel',{url:'http://localhost:3000/local-backup/work'+fragment,fetch:async()=>response({projection})});try{await ui.tick();ui.render();assert.equal(ui.nodes().find(n=>n.props?.id==='progress-tab-plan').props['aria-selected'],expected)}finally{ui.unmount()}}})

function outerFixture(mode){
 const f=progressFixture(),markdown=fs.readFileSync(WORK_PLAN_GUIDE,'utf8');f.put(WORK_PLAN_GUIDE,markdown)
 if(mode!=='plan_conflict')f.snapshot.plan.sha256=hash(markdown)
 if(mode==='checklist_conflict')f.snapshot.checklist.sha256='0'.repeat(64)
 f.save()
 if(mode==='missing')fs.renameSync(path.join(f.root,PROGRESS_SNAPSHOT),path.join(f.root,PROGRESS_SNAPSHOT+'.retained'))
 const dataRoot=path.join(f.root,'private-data'),runtime=path.join(dataRoot,'hot/runtime');fs.mkdirSync(path.dirname(runtime),{recursive:true});fs.renameSync(f.runtimeRoot,runtime);fs.symlinkSync(runtime,f.runtimeRoot,process.platform==='win32'?'junction':'dir')
 const code=ts.transpileModule(fs.readFileSync('src/server/local-backup/project-progress-context.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,exports={};let producerCalls=0
 new Function('require','exports','process',code)(name=>{if(name==='server-only')return {};if(name==='node:path')return path;if(name.endsWith('/project-progress.mjs'))return {readProjectProgress};if(name.endsWith('/project-progress-work-plan.mjs'))return {readProjectWorkPlan};if(name.endsWith('/mvp-acceptance-contracts.mjs'))return {verifyFrozenMvpBindings};if(name.endsWith('/work-producers.mjs'))return {createWorkProducers:()=>{producerCalls++;throw Error('producer must not be called')}};if(name.endsWith('/project-progress-mvp.mjs')||name.endsWith('/project-progress-truth.mjs'))return {};throw Error(name)},exports,{cwd:()=>f.root,env:{AI_PET_WORLD_DATA_ROOT:dataRoot},platform:process.platform})
 return {...f,call:exports.projectProgress,producerCalls:()=>producerCalls}
}
for(const [mode,reason] of [['missing','progress_fixed_source_missing'],['plan_conflict','progress_plan_sha_conflict'],['checklist_conflict','progress_checklist_binding_conflict']])test('actual outer context preserves formal plan when '+mode,async()=>{
 const f=outerFixture(mode),before=fs.readFileSync(path.join(f.root,WORK_PLAN_GUIDE)),result=f.call();assert.equal(result.dataStatus,'partial');assert.equal(result.reasonCode,reason);assert.equal(result.projection.projectionKind,'formal_plan_only');assert.equal(result.projection.workPlan.currentDelivery.steps.length,4);assert.equal(result.projection.plan.items.length,134);assert.equal(result.projection.plan.modules.length,9);assert.equal(result.projection.workPlan.currentDelivery.worldBaseline.percentage,null);assert(!('mvp' in result.projection));assert.equal(f.producerCalls(),0);assert.deepEqual(fs.readFileSync(path.join(f.root,WORK_PLAN_GUIDE)),before)
 const ui=uiHarness('src/app/local-backup/progress/project-progress.tsx','ProjectProgressPanel',{url:'http://localhost:3000/local-backup/work#current-delivery',fetch:async()=>response(result)});try{await ui.tick();assert(ui.text().includes(reason));assert(ui.text().includes('固定世界身份'));assert(ui.text().includes('验证同一世界保存恢复'));assert(!ui.nodes().some(n=>n.type==='progress'))}finally{ui.unmount()}
})
test('invalid formal source cannot be substituted by a partial fallback',()=>{const f=outerFixture('missing');f.put(WORK_PLAN_GUIDE,'invalid formal guide');assert.throws(()=>f.call(),/progress_fixed_source_missing/)})


const BASELINE_SELECTION='.runtime/local-backup/project-progress/current-world-baseline.json'
test('malformed or forged selected proof is unverifiable without hiding the plan',()=>{
 for(const selection of ['invalid JSON',{passed:true,worldId:'forged'}, {schemaVersion:'natural-world-baseline-selection-v1',deliveryId:'WORLD-BASELINE-001',producerId:'natural-world-baseline-program-v1',identity:{worldId:'forged'},proofRef:{path:'../../secrets.json',sha256:'a'.repeat(64),bytes:1},selectedAtUtc:'2026-10-29T06:00:00.000Z'}]){
  const f=fixture('current');f.put(BASELINE_SELECTION,selection);const before=fs.readFileSync(path.join(f.root,BASELINE_SELECTION));const result=f.read(),baseline=result.currentDelivery.worldBaseline
  assert.equal(baseline.status,'unverifiable');assert.equal(baseline.worldId,null);assert.equal(baseline.percentage,null);assert.equal(result.currentDelivery.steps.length,4);assert.equal(result.totals.total,134);assert.deepEqual(fs.readFileSync(path.join(f.root,BASELINE_SELECTION)),before)
  const ui=uiHarness('src/app/local-backup/progress/current-delivery.tsx','CurrentDelivery',{props:{plan:result}});try{assert(ui.text().includes('本轮世界基线证据不可核验'));assert(ui.text().includes('固定世界身份'));assert(!ui.text().includes('forged'))}finally{ui.unmount()}
 }
})

test('baseline selection shares bounded byte and filesystem checks with the plan reader',()=>{
 const oversized=fixture('current');oversized.put(BASELINE_SELECTION,'x'.repeat(64*1024+1));assert.equal(oversized.read().currentDelivery.worldBaseline.status,'unverifiable')
 const linked=fixture('current');linked.put(BASELINE_SELECTION,'{}');const linkedFile=path.join(linked.root,BASELINE_SELECTION);fs.linkSync(linkedFile,linkedFile+'.other');assert.equal(linked.read().currentDelivery.worldBaseline.status,'unverifiable')
 const junction=fixture('current'),source=path.join(junction.root,'.runtime/local-backup/project-progress'),moved=path.join(junction.root,'private-progress');fs.renameSync(source,moved);fs.symlinkSync(moved,source,process.platform==='win32'?'junction':'dir');const result=junction.read();assert.equal(result.currentDelivery.worldBaseline.status,'unverifiable');assert.equal(result.currentDelivery.steps.length,4)
})

test('verified baseline UI keeps machine readback, actual contents and formal qualifications separate',()=>{
 const plan=fixture('conflict').read();plan.currentDelivery.worldBaseline={status:'baseline_verified',label:'本轮世界初始基线已绑定机器读回证据',reason:'UI私有数据夹具，不证明真实世界存在。',worldId:'mvp-natural-world-001',percentage:null,readAtUtc:'2026-10-29T06:30:00.000Z',identity:{ownerId:'mvp-natural-owner-001',playerId:'mvp-natural-player-001',worldId:'mvp-natural-world-001',worldSeed:'mvp-natural-world-001-seed-v1',worldProfileId:'test-only',regionId:'mvp-natural-region-001'},runId:'baseline-'+'a'.repeat(32),proofRef:{path:'private-test/result.json',sha256:'a'.repeat(64),bytes:1},counts:{terrainRegionCount:2,objectCount:3,walkableRegionCount:4,collisionRegionCount:5,conditionChannelCount:23},store:{tick:0,stateVersion:0,eventCursor:0},timing:{createdAtUtc:'2026-10-29T06:00:00.000Z',startedAtUtc:'2026-10-29T06:00:00.000Z',finishedAtUtc:'2026-10-29T06:00:01.000Z',elapsedMs:1000,readbackAtUtc:'2026-10-29T06:00:01.000Z'},readCoverage:{rawSourceBytesRehashed:false,excludedLargeSourceRefs:[{path:'private-test/large-source.tif',sha256:'b'.repeat(64),bytes:48000000}]},readVerification:'GET只核对绑定字节，不重新运行恢复。'}
 for(const compact of [false,true]){const ui=uiHarness('src/app/local-backup/progress/current-delivery.tsx','CurrentDelivery',{props:{plan,compact}});try{const text=ui.text();for(const expected of ['mvp-natural-world-001','条件 23 通道','地形区域 2','对象 3','模型绘图：未执行','正式画面：未发布','世界演化：未接入','2026-10-29T06:00:01.000Z','2026-10-29T06:30:00.000Z','不以部分基线计算完成比例','本次GET未重读大栅格原件：1 个'])assert(text.includes(expected),expected);assert(!ui.nodes().some(n=>n.type==='progress'));assert(text.includes('GET只核对绑定字节'));assert(text.includes(plan.currentDelivery.steps[0].title))}finally{ui.unmount()}}
})
