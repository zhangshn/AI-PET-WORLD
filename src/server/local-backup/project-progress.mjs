import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {TextDecoder} from 'node:util'
import {need,ModuleError} from './contracts.mjs'
import {PROGRESS_PLAN,PROGRESS_SNAPSHOT,PROGRESS_SOURCES,PROGRESS_STAGES,PROGRESS_STATUS,sourceSemantics} from './project-progress-catalog.mjs'
import {MVP_SPEC,MVP_CHECKLIST_VERSION,readMvpChecklist,projectMvp} from './project-progress-mvp.mjs'

const hash=b=>createHash('sha256').update(b).digest('hex'),samePath=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
const caps={plan:256*1024,snapshot:128*1024,evidence:256*1024,total:4*1024*1024,files:24}
const text=(v,max=2000)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
const date=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
function fixedReader(projectRoot,runtimeRoot){
 const project=fs.realpathSync(projectRoot),runtime=fs.realpathSync(path.join(project,'.runtime'))
 need(samePath(runtime,fs.realpathSync(runtimeRoot)),'progress_runtime_mapping_conflict',409)
 let total=0,count=0
 function read(logical,max){
  need(++count<=caps.files,'progress_read_count_limit',409)
  const isRuntime=logical.startsWith('.runtime/'),base=isRuntime?runtime:project,parts=(isRuntime?logical.slice(9):logical).split('/')
  need(parts.every(p=>p&&p!=='.'&&p!=='..'&&!/[\\:\x00-\x1f]/.test(p)),'progress_path_invalid',409)
  let file=base
  for(const part of parts){file=path.join(file,part);const s=fs.lstatSync(file);need(!s.isSymbolicLink()&&samePath(fs.realpathSync(file),file),'progress_path_boundary',409)}
  const before=fs.lstatSync(file);need(before.isFile()&&before.nlink===1&&before.size<=max,'progress_file_limit_or_boundary',409)
  const fd=fs.openSync(file,'r');let bytes
  try{
   const opened=fs.fstatSync(fd);need(opened.ino===before.ino&&opened.dev===before.dev&&opened.size===before.size,'progress_source_changed',409)
   const buffer=Buffer.alloc(max+1);let used=0,n
   while(used<buffer.length&&(n=fs.readSync(fd,buffer,used,buffer.length-used,null))>0)used+=n
   need(used<=max,'progress_file_limit_or_boundary',409);bytes=buffer.subarray(0,used)
   const after=fs.fstatSync(fd),atPath=fs.lstatSync(file)
   need(after.size===before.size&&after.mtimeMs===before.mtimeMs&&after.ino===atPath.ino&&after.dev===atPath.dev&&!atPath.isSymbolicLink()&&samePath(fs.realpathSync(file),file),'progress_source_changed',409)
  }finally{fs.closeSync(fd)}
  total+=bytes.length;need(total<=caps.total,'progress_total_limit',409)
  let body;try{body=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new ModuleError('progress_encoding_invalid',409)}
  return {path:logical,sha256:hash(bytes),byteLength:bytes.length,body}
 }
 return {read,coverage:()=>({files:count,bytes:total,limits:caps,directoryScan:false,stateWrites:false})}
}
function json(r){try{return JSON.parse(r.body)}catch{throw new ModuleError('progress_json_invalid',409)}}
function parsePlan(body){
 const modules=[]
 for(const line of body.split(/\r?\n/))if(/^\|\s*\d+\s*\|/.test(line)){
  const parts=line.split('|').slice(1,-1).map(v=>v.trim().replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/`/g,''))
  need(parts.length===5&&parts.every(v=>text(v,12000)),'progress_plan_table_invalid',409)
  const [id,title,goal,declaredState,acceptance]=parts;modules.push({id,title,goal,declaredState,acceptance,deferred:['4','5','6'].includes(id)})
 }
 need(modules.length===9&&new Set(modules.map(m=>m.id)).size===9&&modules.every((m,i)=>m.id===String(i+1)),'progress_plan_modules_invalid',409)
 return modules
}
/** @param {{projectRoot?: string, runtimeRoot?: string, now?: number}} [options] */
export function readProjectProgress({projectRoot=process.cwd(),runtimeRoot,now=Date.now()}={}){
 need(typeof runtimeRoot==='string','progress_runtime_root_required',409)
 try{
  const reader=fixedReader(projectRoot,runtimeRoot),planRead=reader.read(PROGRESS_PLAN,caps.plan),snapRead=reader.read(PROGRESS_SNAPSHOT,caps.snapshot),s=json(snapRead)
  need(exact(s,['schemaVersion','recordedAtUtc','verifiedAtUtc','source','scopeId','plan','checklist','evidence','stages','notes']),'progress_snapshot_shape',409)
  need(s.schemaVersion==='local-backup-project-progress-snapshot-v2'&&s.scopeId==='natural-world-first','progress_snapshot_schema',409)
  need(exact(s.source,['category','reporterId','threadId'])&&s.source.category==='codex'&&s.source.reporterId==='codex-backup'&&s.source.threadId==='01a15f92-889e-7772-a395-e8b9e7fe4b5a','progress_unknown_producer',409)
  need(date(s.verifiedAtUtc)&&date(s.recordedAtUtc)&&Date.parse(s.verifiedAtUtc)<=Date.parse(s.recordedAtUtc)&&Date.parse(s.recordedAtUtc)<=now+60000,'progress_snapshot_time_invalid',409)
  need(exact(s.plan,['path','sha256'])&&s.plan.path===PROGRESS_PLAN&&digest(s.plan.sha256)&&s.plan.sha256===planRead.sha256,'progress_plan_sha_conflict',409)
  const specRead=reader.read(MVP_SPEC,caps.plan)
  need(exact(s.checklist,['version','path','sha256','changeReason'])&&s.checklist.version===MVP_CHECKLIST_VERSION&&s.checklist.path===MVP_SPEC&&s.checklist.sha256===specRead.sha256&&text(s.checklist.changeReason,500),'progress_checklist_binding_conflict',409)
  const checklist=readMvpChecklist(specRead.body)
  const modules=parsePlan(planRead.body),evidence=[],values=new Map()
  need(Array.isArray(s.evidence)&&s.evidence.length<=16,'progress_evidence_limit',409)
  for(const b of s.evidence){
   const registered=PROGRESS_SOURCES[b.id]
   need(exact(b,['id','path','sha256'])&&registered&&b.path===registered.path&&digest(b.sha256)&&!values.has(b.id),'progress_evidence_identity_invalid',409)
   const read=reader.read(registered.path,caps.evidence);need(read.sha256===b.sha256,'progress_evidence_sha_conflict',409)
   const v=json(read);need(sourceSemantics(b.id,v),'progress_evidence_semantic_conflict',409);values.set(b.id,v)
   evidence.push({id:b.id,title:registered.title,path:b.path,sha256:b.sha256,byteLength:read.byteLength,href:registered.eventId?'/local-backup/work/'+registered.eventId:undefined})
  }
  need(Array.isArray(s.stages)&&s.stages.length===PROGRESS_STAGES.length,'progress_stages_invalid',409)
  const stages=PROGRESS_STAGES.map((registered,index)=>{
   const v=s.stages[index]
   need(exact(v,['id','status','summary','detail','evidenceIds'])&&v.id===registered.id&&Object.hasOwn(PROGRESS_STATUS,v.status)&&text(v.summary,300)&&text(v.detail,1600),'progress_stage_invalid',409)
   need(Array.isArray(v.evidenceIds)&&new Set(v.evidenceIds).size===v.evidenceIds.length&&v.evidenceIds.every(id=>registered.evidence.includes(id)&&values.has(id)),'progress_stage_evidence_invalid',409)
   const complete=registered.evidence.every(id=>v.evidenceIds.includes(id)),expected=complete?registered.status:'not_verified'
   need(v.status===expected,'progress_unbound_or_conflicting_state',409)
   return {id:registered.id,title:registered.title,moduleIds:registered.moduleIds,status:expected,statusLabel:PROGRESS_STATUS[expected],summary:v.summary,detail:v.detail,evidenceIds:v.evidenceIds,evidenceComplete:complete}
  })
  need(Array.isArray(s.notes)&&s.notes.length<=8,'progress_notes_limit',409)
  for(const note of s.notes)need(exact(note,['title','body','evidenceIds'])&&text(note.title,100)&&text(note.body,1600)&&Array.isArray(note.evidenceIds)&&note.evidenceIds.length<=9&&note.evidenceIds.every(id=>values.has(id)),'progress_note_invalid',409)
  // Recheck the two revision roots after their bounded children, never mix revisions.
  need(reader.read(PROGRESS_PLAN,caps.plan).sha256===planRead.sha256&&reader.read(PROGRESS_SNAPSHOT,caps.snapshot).sha256===snapRead.sha256&&reader.read(MVP_SPEC,caps.plan).sha256===specRead.sha256,'progress_mixed_revision',409)
  const gradient=values.get('gradient130'),training=values.get('training095'),probe=values.get('probe104'),stale=now-Date.parse(s.verifiedAtUtc)>24*3600000
  return {dataStatus:stale?'unknown_or_stale':'connected',reasonCode:stale?'progress_snapshot_stale':'bound_static_progress_snapshot',projection:{schemaVersion:'local-backup-project-progress-v1',source:s.source,recordedAtUtc:s.recordedAtUtc,verifiedAtUtc:s.verifiedAtUtc,readAtUtc:new Date(now).toISOString(),live:false,stale,staleAfterHours:24,scopeId:s.scopeId,plan:{path:PROGRESS_PLAN,sha256:planRead.sha256,modules},snapshot:{path:PROGRESS_SNAPSHOT,sha256:snapRead.sha256},revision:hash(planRead.sha256+snapRead.sha256+specRead.sha256),mvp:projectMvp(checklist,values,s.checklist,new Date(now).toISOString()),stages,counts:Object.fromEntries(Object.entries(PROGRESS_STATUS).map(([id,label])=>[id,{label,count:stages.filter(s=>s.status===id).length}])),notes:s.notes,evidence,distinctions:{historicalTraining:training?{runId:training.runId,optimizerSteps:training.actualFinalOptimizerSteps,completed:training.executionState==='completed',qualified:training.formalTrainingQualified}:null,nativeGradient:gradient?{completed:gradient.actualCalls.gGradientCompletions,attempted:gradient.actualCalls.gGradientAttempts,wallSeconds:gradient.wallSeconds,gate:gradient.completeGradientGate}:null,formalQuality:probe?.modelQualified===false?'not_qualified':'unknown',framePublication:probe?.framePublished===false?'not_published':'unknown',worldLoop:probe?.mvpAccepted===false?'not_accepted':'unknown'},coverage:reader.coverage()}}
 }catch(error){if(error instanceof ModuleError)throw error;if(error?.code==='ENOENT')throw new ModuleError('progress_fixed_source_missing',503);throw new ModuleError('progress_source_unavailable',503)}
}
