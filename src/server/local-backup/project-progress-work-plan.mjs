import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {need} from './contracts.mjs'

export const WORK_PLAN_GUIDE='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'
export const WORK_PLAN_STATUS='.runtime/local-backup/project-progress/work-plan-status.json'
const sha=b=>createHash('sha256').update(b).digest('hex')
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=4000&&!v.includes('\0')
export function parseWorkPlan(markdown){
 const blocks=[...markdown.matchAll(/```json\s*\r?\n([\s\S]*?)\r?\n```/g)].filter(m=>m[1].includes('whole-product-work-plan-v1'))
 need(blocks.length===1,'work_plan_definition_missing',409)
 const plan=JSON.parse(blocks[0][1])
 need(plan.schemaVersion==='whole-product-work-plan-v1'&&text(plan.version)&&Array.isArray(plan.items)&&plan.items.length>=9&&plan.items.length<=256,'work_plan_shape',409)
 const ids=new Set()
 for(const item of plan.items){
  need(/^PLAN-0[1-9]-\d{3}$/.test(item.id)&&item.moduleId===String(Number(item.id.slice(5,7)))&&!ids.has(item.id),'work_plan_identity',409);ids.add(item.id)
  need(['title','deliverable','doneWhen'].every(k=>text(item[k]))&&Array.isArray(item.dependsOn)&&item.dependsOn.length<=24&&Array.isArray(item.requirementRefs)&&item.requirementRefs.length<=24&&item.requirementRefs.every(text),'work_plan_item_shape',409)
 }
 need(Array.from({length:9},(_,i)=>String(i+1)).every(id=>plan.items.some(item=>item.moduleId===id)),'work_plan_module_coverage',409)
 for(const item of plan.items)need(item.dependsOn.every(id=>ids.has(id)&&id!==item.id),'work_plan_dependency',409)
 const visiting=new Set(),visited=new Set(),byId=new Map(plan.items.map(i=>[i.id,i]))
 function visit(id){need(!visiting.has(id),'work_plan_dependency_cycle',409);if(visited.has(id))return;visiting.add(id);for(const dep of byId.get(id).dependsOn)visit(dep);visiting.delete(id);visited.add(id)}
 for(const id of ids)visit(id)
 return plan
}
export function summarizeWorkItems(items){
 const total=items.length,completed=items.filter(i=>i.status==='completed').length,notCompleted=items.filter(i=>i.status==='not_completed').length,unverified=total-completed-notCompleted
 return {total,completed,notCompleted,unverified,percentage:total?Math.round(completed/total*1000)/10:null,coverageComplete:unverified===0}
}
export function readProjectWorkPlan({projectRoot=process.cwd(),runtimeRoot,planSha256,specificationSha256,modules,now=new Date().toISOString()}){
 const pending={status:'not_connected',message:'详细工作项及核验报告尚未接入',totals:null,modules:[],readAtUtc:now}
 const began=Date.now()
 let files=0,totalBytes=0
 try{
  const root=fs.realpathSync(projectRoot),runtime=fs.realpathSync(path.join(root,'.runtime'));need(same(runtime,fs.realpathSync(runtimeRoot)),'work_plan_runtime_boundary',409)
  const cache=new Map()
  function read(logical,max=2*1024*1024){
   need(Date.now()-began<8000,'work_plan_time_limit',409)
   if(cache.has(logical))return cache.get(logical)
   need(typeof logical==='string'&&logical.length<=512&&!/[\\:\0]/.test(logical)&&logical.split('/').every(p=>p&&p!=='.'&&p!=='..'),'work_plan_path',409)
   need((logical==='AGENTS.md'||/^(?:src\/|scripts\/|docs\/|data\/|ml\/ai-painter\/(?:src|scripts|tests)\/|\.runtime\/(?:ai-painter\/controller-repair-reviews|local-backup\/project-progress)\/)/.test(logical))&&!/FULL_DICTIONARY_PRINT|(?:^|\/)(?:\.env[^/]*|[^/]*(?:secret|credential|cookie)[^/]*)$/i.test(logical),'work_plan_source_scope',409)
   const runtimeFile=logical.startsWith('.runtime/');let file=runtimeFile?runtime:root
   for(const part of (runtimeFile?logical.slice(9):logical).split('/')){file=path.join(file,part);need(!fs.lstatSync(file).isSymbolicLink()&&same(fs.realpathSync(file),file),'work_plan_path_boundary',409)}
   const before=fs.lstatSync(file);need(before.isFile()&&before.nlink===1&&before.size<=max,'work_plan_file_limit',409)
   const bytes=fs.readFileSync(file),after=fs.lstatSync(file);need(bytes.length<=max&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'work_plan_source_changed',409)
   need(++files<=512&&(totalBytes+=bytes.length)<=16*1024*1024,'work_plan_read_limit',409)
   const value={bytes,sha256:sha(bytes)};cache.set(logical,value);return value
  }
  const guide=read(WORK_PLAN_GUIDE,256*1024);need(guide.sha256===planSha256,'work_plan_guide_conflict',409)
  const plan=parseWorkPlan(guide.bytes.toString('utf8'))
  let raw;try{raw=read(WORK_PLAN_STATUS,1024*1024)}catch(error){if(error.code==='ENOENT')return {...pending,version:plan.version};throw error}
  const report=JSON.parse(raw.bytes.toString('utf8'))
  need(report.schemaVersion==='work-plan-status-v1'&&report.taskId==='WORK-PLAN-139'&&report.source?.category==='codex'&&report.source?.reporterId==='codex-controller'&&report.source?.threadId==='01a16ccd-a67b-7ae0-b614-a0415398ae0b','work_plan_reporter',409)
  need(report.planSha256===planSha256&&report.specificationSha256===specificationSha256,'work_plan_authority_conflict',409)
  need(Array.isArray(report.evidenceCatalog)&&report.evidenceCatalog.length<=480&&Array.isArray(report.rows)&&report.rows.length<=256,'work_plan_report_limit',409)
  const evidence=new Map()
  for(const ref of report.evidenceCatalog){
   need(text(ref.id)&&!evidence.has(ref.id)&&['source','test','acceptance'].includes(ref.kind)&&/^[a-f0-9]{64}$/.test(ref.sha256),'work_plan_evidence_shape',409)
   const logical=ref.path??ref.logicalPath;let state='matched'
   try{if(read(logical).sha256!==ref.sha256)state='changed'}catch{state='unavailable'}
   evidence.set(ref.id,{...ref,path:logical,state})
  }
  const rows=new Map()
  for(const row of report.rows){
   need(plan.items.some(i=>i.id===row.itemId)&&!rows.has(row.itemId)&&['completed','not_completed','unverified'].includes(row.status),'work_plan_row_identity',409)
   need(Array.isArray(row.completedParts)&&row.completedParts.length<=24&&row.completedParts.every(text)&&Array.isArray(row.remainingParts)&&row.remainingParts.length<=24&&row.remainingParts.every(text)&&Array.isArray(row.evidenceIds)&&row.evidenceIds.length<=16&&row.evidenceIds.every(id=>evidence.has(id))&&text(row.reason),'work_plan_row_shape',409)
   rows.set(row.itemId,row)
  }
  need(rows.size===plan.items.length,'work_plan_status_coverage',409)
  const items=plan.items.map(item=>{
   const row=rows.get(item.id),refs=(row?.evidenceIds??[]).map(id=>evidence.get(id));let status=row?.status??'unverified',reason=row?.reason??'缺少该交付工作项的核验记录'
   if(refs.some(r=>r.state!=='matched')){status='unverified';reason='核验后来源发生变化或不可读取；原结论：'+reason}
   if(status==='completed'&&(!row.completedParts.length||row.remainingParts.length||!refs.some(r=>r.kind==='source')||!refs.some(r=>['test','acceptance'].includes(r.kind)))){status='unverified';reason='完成条件缺少实际产物或适用验证证据；'+reason}
   return {...item,status,reportedStatus:row?.status??'unverified',reason,completedParts:row?.completedParts??[],remainingParts:row?.remainingParts??['需要取得该工作项的实际交付及验证证据'],completedAtUtc:row?.completedAtUtc??null,verifiedAtUtc:row?.verifiedAtUtc??report.verifiedAtUtc,evidence:refs}
  })
  cache.delete(WORK_PLAN_GUIDE);cache.delete(WORK_PLAN_STATUS)
  need(read(WORK_PLAN_GUIDE,256*1024).sha256===guide.sha256&&read(WORK_PLAN_STATUS,1024*1024).sha256===raw.sha256,'work_plan_mixed_revision',409)
  const totals=summarizeWorkItems(items)
  return {status:totals.unverified?'partial':'verified_as_of',message:'计划工作项按明确交付条件核验，一项一票汇总',version:plan.version,planSha256,reportSha256:raw.sha256,source:report.source,verifiedAtUtc:report.verifiedAtUtc,readAtUtc:now,totals,modules:modules.map(module=>{const own=items.filter(i=>i.moduleId===module.id);return {id:module.id,title:module.title,...summarizeWorkItems(own),items:own}}),method:'已核实完成工作项数 ÷ 当前完整计划工作项总数；不等权平均模块、不计重试次数，不代表工时或产品质量合格率',readCoverage:{files,bytes:totalBytes,scan:false,write:false}}
 }catch(error){return {...pending,status:'unverifiable',message:'工作计划或完成证据核验失败',reasonCode:/^work_plan_[a-z_]+$/.test(error.message)?error.message:'work_plan_read_unavailable'}}
}
