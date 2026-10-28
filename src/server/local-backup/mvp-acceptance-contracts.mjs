import {createHash} from 'node:crypto'
import {need} from './contracts.mjs'
import {PROGRESS_SOURCES} from './project-progress-catalog.mjs'
export const MVP_PRODUCER='mvp-acceptance-verifier-v1',MVP_SOURCE='mvp-acceptance-v1',MVP_SCOPE='whole-mvp-current',MVP_FACT_SCHEMA='mvp-acceptance-fact-v1'
export const MVP_INDEX='.runtime/local-backup/work-recording/mvp-acceptance/index.json'
export const MVP_LIMITS=Object.freeze({facts:512,bytes:4*1024*1024,report:256*1024,index:64*1024,batch:32,ms:8000,heads:8})
export const LEGACY_MVP=Object.freeze([
 {id:'facts098',checkpointId:'MVP-VIS-01:1',sha256:'b0972f92ea21a566907671d4e4f0712709f1a57da130eabacf703695b1c69338',outcome:'passed'},
 {id:'input102',checkpointId:'MVP-VIS-01:2',sha256:'9d4dc6cb2f818552a84f0507d69c7b4f1cca2021f3f26e94cd421b7d7bc85554',outcome:'passed'},
 {id:'persistence097',checkpointId:'MVP-VIS-06:1',sha256:'1e9d8348b12df1a659b1f613501241d11b63846a6e9658d94548669e4ee6bcf0',outcome:'passed'},
 {id:'closure095',checkpointId:'MVP-VIS-08:1',sha256:'5bc76d3e46377a456d5281af62391258fc2da960fcf3d23fd2a9b0f1f93ad5d3',outcome:'failed'},
].map(s=>Object.freeze({...s,path:PROGRESS_SOURCES[s.id].path})))
export const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value
export const factHash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(canonical(value))).digest('hex')
export const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
export const isDigest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export const checkpointIds=[...Array.from({length:8},(_,i)=>`MVP-VIS-0${i+1}`),...Array.from({length:4},(_,i)=>`WORLD-AUTO-00${i+1}`)].flatMap(g=>[1,2,3,4].map(n=>g+':'+n))
export function verifyFrozenMvpBindings(bindings){for(const seed of LEGACY_MVP){const b=bindings.find(b=>b.id===seed.id);if(b)need(b.path===seed.path&&b.sha256===seed.sha256,'mvp_frozen_source_sha_conflict',409)}return true}
export function factIdentity(f){const {factId,verifiedAtUtc,...stable}=f;void factId;void verifiedAtUtc;return factHash(stable)}
export function validateMvpFact(f){
 need(exact(f,['schemaVersion','factId','checklist','scopeId','checkpointId','decisionClass','origin','adapter','verifier','applicability','outcome','reasonCode','predecessor','evidence','verifiedAtUtc']),'mvp_fact_shape',409)
 need(f.schemaVersion===MVP_FACT_SCHEMA&&f.scopeId===MVP_SCOPE&&checkpointIds.includes(f.checkpointId),'mvp_fact_identity',409)
 need(exact(f.checklist,['version','sha256'])&&f.checklist.version==='mvp-acceptance-checklist-v1'&&isDigest(f.checklist.sha256),'mvp_fact_checklist',409)
 need(['legacy_external_component','production_machine_acceptance'].includes(f.decisionClass)&&['passed','failed','revoked','conflict','unknown'].includes(f.outcome),'mvp_fact_decision',409)
 need(exact(f.origin,['sourceCategory','verifierId','sourceKey','sourceEventId','revision','transactionId','path','sha256','originalEventAtUtc'])&&['codex','local_program'].includes(f.origin.sourceCategory)&&isDigest(f.origin.sha256)&&Number.isSafeInteger(f.origin.revision)&&f.origin.revision>=0,'mvp_fact_origin',409)
 for(const key of ['verifierId','sourceKey','sourceEventId','path'])need(typeof f.origin[key]==='string'&&f.origin[key].length>0&&f.origin[key].length<=512,'mvp_fact_origin_text',409)
 need(f.origin.sourceCategory===(f.decisionClass==='legacy_external_component'?'codex':'local_program'),'mvp_fact_origin_category',409)
 need(f.origin.transactionId===null||typeof f.origin.transactionId==='string'&&f.origin.transactionId.length<=160,'mvp_fact_origin_transaction',409)
 for(const part of ['adapter','verifier'])need(exact(f[part],['id','version','implementationSha256'])&&typeof f[part].id==='string'&&f[part].id.length<=100&&typeof f[part].version==='string'&&f[part].version.length<=100&&isDigest(f[part].implementationSha256),'mvp_fact_implementation',409)
 need(f.verifier.id===MVP_PRODUCER&&exact(f.applicability,['kind','dataId','modelId','capabilityId','worldId','tick']),'mvp_fact_scope',409)
 for(const [key,v]of Object.entries(f.applicability))need(v===null||typeof v==='string'&&v.length<=200||key==='tick'&&Number.isSafeInteger(v)&&v>=0,'mvp_fact_scope_value',409)
 need(f.predecessor===null||exact(f.predecessor,['factId','sha256'])&&isDigest(f.predecessor.factId)&&isDigest(f.predecessor.sha256),'mvp_fact_predecessor',409)
 need(exact(f.evidence,['logicalPath','sha256'])&&isDigest(f.evidence.sha256)&&f.evidence.sha256===f.origin.sha256&&typeof f.evidence.logicalPath==='string'&&f.evidence.logicalPath.length<=512,'mvp_fact_evidence',409)
 need(typeof f.reasonCode==='string'&&/^[a-z0-9_]{1,120}$/.test(f.reasonCode),'mvp_fact_reason',409)
 for(const t of [f.verifiedAtUtc,f.origin.originalEventAtUtc])need(t===null||typeof t==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|\+00:00)$/.test(t)&&Number.isFinite(Date.parse(t)),'mvp_fact_time',409)
 need(f.verifiedAtUtc!==null&&f.factId===factIdentity(f),'mvp_fact_digest',409)
 need(Buffer.byteLength(JSON.stringify(f))<=16*1024,'mvp_fact_limit',409)
 return f
}
