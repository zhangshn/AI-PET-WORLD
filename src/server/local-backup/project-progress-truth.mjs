import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {need} from './contracts.mjs'
import {checkpointIds} from './mvp-acceptance-contracts.mjs'
export const TRUTH_REPORT='.runtime/ai-painter/controller-repair-reviews/mvp-truth-audit-138-20261028/controller-final-audit.json'
export const TRUTH_REPORT_V2='.runtime/ai-painter/controller-repair-reviews/mvp-truth-audit-138-20261028/controller-final-audit-v2.json'
export const TRUTH_REPORT_V5='.runtime/ai-painter/controller-repair-reviews/mvp-truth-audit-138-20261028/controller-final-audit-v5.json'
export const TRUTH_BINDING='.runtime/local-backup/project-progress/truth-binding.json'
const hash=b=>createHash('sha256').update(b).digest('hex'),same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
const classes=['accepted','implemented_pending_acceptance','confirmed_not_implemented','partial','insufficient_evidence','blocked']
const text=(v,max=3000)=>typeof v==='string'&&v.length>0&&v.length<=max&&!v.includes('\0')
const list=v=>typeof v==='string'?[v]:Array.isArray(v)&&v.length<=24&&v.every(s=>text(s))?v:[]
export function readProjectProgressTruth({projectRoot=process.cwd(),runtimeRoot,planSha256,specificationSha256,now=new Date().toISOString()}){
 const pending={status:'pending',message:'成果全量核查中',implementationTotals:null,rows:null,coverageComplete:false,sourceCategory:'codex',readAtUtc:now}
 let reads=0,bytes=0
 const cache=new Map(),root=fs.realpathSync(projectRoot),runtime=fs.realpathSync(path.join(root,'.runtime'))
 need(same(runtime,fs.realpathSync(runtimeRoot)),'truth_runtime_boundary',409)
 function read(logical,max=1024*1024){
  if(cache.has(logical))return cache.get(logical)
  need(typeof logical==='string'&&logical.length<=512&&!logical.startsWith('/')&&!logical.includes('\\')&&!/[:\0]/.test(logical)&&logical.split('/').every(s=>s&&s!=='.'&&s!=='..'),'truth_path_invalid',409)
  need(/^(?:src\/|scripts\/|ml\/ai-painter\/(?:src|scripts|tests)\/|docs\/|data\/|\.runtime\/ai-painter\/controller-repair-reviews\/|\.runtime\/local-backup\/project-progress\/)/.test(logical)&&!/(?:^|\/)(?:\.env[^/]*|[^/]*(?:credential|secret|cookie)[^/]*)$/i.test(logical),'truth_path_scope',409)
  const inRuntime=logical.startsWith('.runtime/');let file=inRuntime?runtime:root
  for(const part of (inRuntime?logical.slice(9):logical).split('/')){file=path.join(file,part);need(!fs.lstatSync(file).isSymbolicLink()&&same(fs.realpathSync(file),file),'truth_path_boundary',409)}
  const before=fs.lstatSync(file);need(before.isFile()&&before.nlink===1&&before.size<=max,'truth_file_limit',409)
  const b=fs.readFileSync(file),after=fs.lstatSync(file);need(b.length<=max&&before.ino===after.ino&&before.dev===after.dev&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'truth_source_changed',409)
  need(++reads<=192&&(bytes+=b.length)<=8*1024*1024,'truth_read_limit',409)
  const result={bytes:b,sha256:hash(b)};cache.set(logical,result);return result
 }
 try{
  let binding,bindingSha;try{const raw=read(TRUTH_BINDING,32*1024);bindingSha=raw.sha256;binding=JSON.parse(raw.bytes.toString('utf8'))}catch(error){if(error.code==='ENOENT')return pending;throw error}
  need(binding.schemaVersion==='mvp-truth-audit-binding-v1'&&[TRUTH_REPORT_V5].includes(binding.path)&&/^[a-f0-9]{64}$/.test(binding.sha256),'truth_binding_invalid',409)
  const reportPath=binding.path,reportRead=read(reportPath,256*1024);need(reportRead.sha256===binding.sha256,'truth_report_sha_conflict',409);const report=JSON.parse(reportRead.bytes.toString('utf8'))
  need(report.schemaVersion==='mvp-truth-audit-v1'&&report.source?.category==='codex'&&report.source?.reporterId==='codex-controller'&&report.source?.threadId==='01a16ccd-a67b-7ae0-b614-a0415398ae0b','truth_producer_invalid',409)
  need(report.checklistVersion==='mvp-acceptance-checklist-v1'&&report.planSha256===planSha256&&report.specificationSha256===specificationSha256,'truth_authority_conflict',409)
  need(Array.isArray(report.rows)&&report.rows.length===48&&new Set(report.rows.map(r=>r.checkpointId)).size===48&&report.rows.every(r=>checkpointIds.includes(r.checkpointId)),'truth_rows_invalid',409)
  const rows=report.rows.map(row=>{
   need(classes.includes(row.classification)&&['implemented','partial','confirmed_not_implemented','insufficient_evidence'].includes(row.implementationStatus)&&['accepted','failed','not_verified','insufficient_evidence'].includes(row.acceptanceStatus)&&text(row.scope)&&text(row.reason)&&Array.isArray(row.references)&&row.references.length<=8,'truth_row_shape',409)
   const checkedScope=list(row.checkedScope),unverifiedScope=list(row.unverifiedScope);let sourceState='matched'
   const references=row.references.map(ref=>{need(text(ref.logicalPath,512)&&/^[a-f0-9]{64}$/.test(ref.sha256)&&['source','test','acceptance'].includes(ref.kind),'truth_reference_shape',409);need(ref.originalEvidenceTime==null||typeof ref.originalEvidenceTime==='string'&&Number.isFinite(Date.parse(ref.originalEvidenceTime)),'truth_reference_time',409);need(ref.originalEvidenceTimeField==null||typeof ref.originalEvidenceTimeField==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(ref.originalEvidenceTimeField),'truth_reference_time_field',409);try{const actual=read(ref.logicalPath);const state=actual.sha256===ref.sha256?'matched':'changed';if(state!=='matched')sourceState='changed';return {...ref,currentSha256:actual.sha256,state}}catch(error){sourceState='unavailable';return {...ref,state:'unavailable',reasonCode:/^truth_[a-z_]+$/.test(error.message)?error.message:'truth_reference_unavailable'}}})
   let classification=row.classification
   if(sourceState!=='matched'||classification==='confirmed_not_implemented'&&(!checkedScope.length||!references.some(r=>['source','test'].includes(r.kind)))||classification==='accepted'&&!references.some(r=>r.kind==='acceptance'))classification='insufficient_evidence'
   return {...row,checkedScope,unverifiedScope,references,reportedClassification:row.classification,classification,currentSourceState:sourceState,machineAcceptance:'unknown',sourceCategory:'codex',readAtUtc:now}
  })
  // Recheck the two roots; a report publication never mixes old/new bindings.
  cache.delete(TRUTH_BINDING);cache.delete(reportPath)
  need(read(TRUTH_BINDING,32*1024).sha256===bindingSha&&read(reportPath,256*1024).sha256===reportRead.sha256,'truth_mixed_revision',409)
  const current=rows.every(r=>r.currentSourceState==='matched'),counts=Object.fromEntries(classes.map(c=>[c,rows.filter(r=>r.classification===c).length]))
  return {status:current?'external_audit_as_of':'unknown_or_stale',message:current?'外部成果核查已读回 · 覆盖仍不完整':'核查后来源已变化或不可读，相关结论待重新核验',implementationTotals:counts,rows,coverageComplete:false,source:report.source,sourceCategory:'codex',reportSha256:reportRead.sha256,reportPath,recordedAtUtc:report.recordedAtUtc,verifiedAtUtc:report.verifiedAtUtc,readAtUtc:now,coverage:{reviewedRows:48,complete:false,historyComplete:false,productionLive:false},readCoverage:{files:reads,bytes,scan:false,write:false}}
 }catch(error){return {...pending,status:'unverifiable',message:'外部成果核查暂不可核验，不能据空列表认定零实现',reasonCode:/^truth_[a-z_]+$/.test(error.message)?error.message:'truth_read_unavailable'}}
}
