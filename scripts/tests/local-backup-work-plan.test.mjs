import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {parseWorkPlan,readProjectWorkPlan,WORK_PLAN_GUIDE,WORK_PLAN_STATUS} from '../../src/server/local-backup/project-progress-work-plan.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'work-plan-139-')),put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof v==='string'?v:JSON.stringify(v))}
 const items=Array.from({length:9},(_,i)=>({id:`PLAN-0${i+1}-001`,moduleId:String(i+1),title:'具体交付'+i,deliverable:'可验证产物'+i,doneWhen:'产物和适用验证通过',dependsOn:[],requirementRefs:['formal-requirement']})),plan={schemaVersion:'whole-product-work-plan-v1',version:'work-plan-139-v1',items}
 const markdown=()=> '## 工作项\n```json\n'+JSON.stringify(plan)+'\n```';put(WORK_PLAN_GUIDE,markdown());put('scripts/tests/proof.json','{"passed":true}')
 const evidenceCatalog=[{id:'test',path:'scripts/tests/proof.json',kind:'test',sha256:hash('{"passed":true}')}]
 for(let i=0;i<9;i++){put('src/item'+i+'.mjs','actual'+i);evidenceCatalog.push({id:'source'+i,path:'src/item'+i+'.mjs',kind:'source',sha256:hash('actual'+i)})}
 const report={schemaVersion:'work-plan-status-v1',taskId:'WORK-PLAN-139',source:{category:'codex',reporterId:'codex-controller',threadId:'01a16ccd-a67b-7ae0-b614-a0415398ae0b'},planSha256:hash(markdown()),specificationSha256:'a'.repeat(64),verifiedAtUtc:'2026-10-28T12:00:00Z',evidenceCatalog,rows:items.map((i,n)=>({itemId:i.id,status:n<3?'completed':n<7?'not_completed':'unverified',completedParts:n<3?['具体交付已完成']:[],remainingParts:n<3?[]:['具体条件未满足'],reason:'逐项核验的明确结果',evidenceIds:['source'+n,'test'],completedAtUtc:null,verifiedAtUtc:'2026-10-28T12:00:00Z'})),percentage:100}
 const save=()=>put(WORK_PLAN_STATUS,report),read=()=>readProjectWorkPlan({projectRoot:root,runtimeRoot:path.join(root,'.runtime'),planSha256:report.planSha256,specificationSha256:report.specificationSha256,modules:items.map(i=>({id:i.moduleId,title:'模块'+i.moduleId}))})
 return {root,plan,report,put,save,read,markdown}
}
test('all9 modules use actual leaf counts; report percentage ignored and unknown retained separately',()=>{const f=fixture();f.save();const r=f.read();assert.equal(r.totals.total,9);assert.equal(r.totals.completed,3);assert.equal(r.totals.notCompleted,4);assert.equal(r.totals.unverified,2);assert.equal(r.totals.percentage,33.3);assert.equal(r.modules.length,9);assert.equal(r.readCoverage.write,false)})
test('missing status never masquerades as zero tasks or zero percent',()=>{const f=fixture();assert.equal(f.read().totals,null)})
test('source changes downgrade only affected completed leaf, no GET repair or scan',()=>{const f=fixture();f.save();f.put('src/item0.mjs','changed');const before=fs.readFileSync(path.join(f.root,WORK_PLAN_STATUS)),old=fs.readdirSync;fs.readdirSync=()=>{throw Error('scan forbidden')};try{const r=f.read();assert.equal(r.modules[0].items[0].status,'unverified');assert.equal(r.modules[1].items[0].status,'completed');assert.equal(r.totals.completed,2)}finally{fs.readdirSync=old}assert.deepEqual(fs.readFileSync(path.join(f.root,WORK_PLAN_STATUS)),before)})
test('a completed flag without actual source and verification cannot grant completion',()=>{const f=fixture();f.report.rows[0].evidenceIds=['source0'];f.save();assert.equal(f.read().modules[0].items[0].status,'unverified')})
test('duplicate items, missing module and dependency cycles are rejected',()=>{for(const change of [f=>f.plan.items.push(f.plan.items[0]),f=>f.plan.items.pop(),f=>{f.plan.items[0].dependsOn=[f.plan.items[1].id];f.plan.items[1].dependsOn=[f.plan.items[0].id]}]){const f=fixture();change(f);assert.throws(()=>parseWorkPlan(f.markdown()),/work_plan_/)}})
test('wrong producer, plan revision and duplicate states fail closed',()=>{for(const change of [f=>f.report.source.reporterId='caller',f=>f.report.planSha256='f'.repeat(64),f=>f.report.rows.push(f.report.rows[0])]){const f=fixture();change(f);f.save();assert.equal(f.read().status,'unverifiable')}})

test('only literal governance root AGENTS.md is registered; similarly named root documents stay refused',()=>{for(const name of ['AGENTS.md','AGENTS-copy.md']){const f=fixture();f.put(name,'governance');f.report.evidenceCatalog.find(e=>e.id==='source0').path=name;f.report.evidenceCatalog.find(e=>e.id==='source0').sha256=hash('governance');f.save();const r=f.read();assert.equal(r.modules[0].items[0].status,name==='AGENTS.md'?'completed':'unverified')}})
