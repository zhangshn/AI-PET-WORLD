import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {performance} from 'node:perf_hooks'
import {need} from './contracts.mjs'
import {MVP_SPEC,MVP_CHECKLIST_VERSION,readMvpChecklist,componentProof} from './project-progress-mvp.mjs'
import {sourceSemantics} from './project-progress-catalog.mjs'
import {LEGACY_MVP,MVP_LIMITS,MVP_FACT_SCHEMA,MVP_PRODUCER,MVP_SCOPE,factHash,factIdentity,validateMvpFact,exact} from './mvp-acceptance-contracts.mjs'
export const MVP_VERIFIER_VERSION='mvp-acceptance-136-v1'
export function createMvpAcceptanceVerifier({read,projectRoot,now=()=>new Date().toISOString()}){
 const implementationFiles=['mvp-acceptance-contracts.mjs','mvp-acceptance-verifier.mjs','mvp-acceptance-reducer.mjs','mvp-acceptance-consumer.mjs','project-progress-mvp.mjs','project-progress-catalog.mjs','contracts.mjs']
 const implementationManifest=implementationFiles.map(file=>{const b=fs.readFileSync(fileURLToPath(new URL(file,import.meta.url)));need(b.length<=128*1024,'mvp_implementation_limit',409);return {file,sha256:factHash(b.toString('utf8'))}}),implementationSha256=factHash(implementationManifest)
 // The context supplies an ordinary, bounded Markdown reader separately because
 // the work evidence reader deliberately parses only JSON.
 let pass=null
 function account(bytes){if(pass){need(performance.now()-pass.started<MVP_LIMITS.ms&&++pass.files<=24&&(pass.bytes+=bytes)<=MVP_LIMITS.bytes,'mvp_read_budget',409)}}
 function boundedRead(logical,expected,max){const key=logical+':'+expected;if(pass?.records.has(key))return pass.records.get(key);const r=read(logical,expected,max);account(r.bytes.length);pass?.records.set(key,r);return r}
 function currentChecklist(){if(pass?.checklist)return pass.checklist;let file=fs.realpathSync(projectRoot);for(const part of MVP_SPEC.split('/')){file=path.join(file,part);need(!fs.lstatSync(file).isSymbolicLink()&&fs.realpathSync(file).toLowerCase()===file.toLowerCase(),'mvp_checklist_boundary',409)}const s=fs.lstatSync(file);need(s.isFile()&&s.nlink===1&&s.size<=128*1024,'mvp_checklist_boundary',409);const bytes=fs.readFileSync(file);need(bytes.length===s.size&&fs.lstatSync(file).mtimeMs===s.mtimeMs,'mvp_checklist_changed',409);account(bytes.length);readMvpChecklist(bytes.toString('utf8'));const result={version:MVP_CHECKLIST_VERSION,sha256:factHash(bytes.toString('utf8'))};if(pass)pass.checklist=result;return result}
 function withReadPass(fn){if(pass)return fn();pass={started:performance.now(),bytes:0,files:0,records:new Map(),checklist:null};let expected;try{const value=fn();need(performance.now()-pass.started<MVP_LIMITS.ms,'mvp_read_budget',409);return value}finally{expected=pass.checklist?.sha256;pass=null;if(expected)need(currentChecklist().sha256===expected,'mvp_mixed_revision',409)}}
 function sourceValid(seed,value){return sourceSemantics(seed.id,value)&&(seed.id==='closure095'||componentProof(seed.id,value))}
 function registeredSeed(seed){const registered=LEGACY_MVP.find(s=>s.id===seed?.id);need(registered&&exact(seed,['id','checkpointId','sha256','outcome','path'])&&factHash(seed)===factHash(registered),'mvp_source_adapter_unregistered',409);return registered}
 function build(seed,r,evidence){
  seed=registeredSeed(seed)
  need(r.sha256===seed.sha256&&r.bytes&&factHash(r.bytes.toString('utf8'))===seed.sha256&&factHash(JSON.parse(r.bytes.toString('utf8')))===factHash(r.value)&&sourceValid(seed,r.value),'mvp_legacy_evidence_conflict',409)
  const value=r.value,original=value.checkedAtUtc??value.recordedAtUtc??null
  const f={schemaVersion:MVP_FACT_SCHEMA,factId:'',checklist:currentChecklist(),scopeId:MVP_SCOPE,checkpointId:seed.checkpointId,decisionClass:'legacy_external_component',origin:{sourceCategory:'codex',verifierId:'codex-controller',sourceKey:seed.path,sourceEventId:seed.id+'-'+seed.sha256,revision:0,transactionId:null,path:seed.path,sha256:seed.sha256,originalEventAtUtc:original},adapter:{id:'legacy-component-'+seed.id,version:'frozen-legacy-components-v1',implementationSha256},verifier:{id:MVP_PRODUCER,version:MVP_VERIFIER_VERSION,implementationSha256},applicability:{kind:'component',dataId:value.taskId??seed.id,modelId:null,capabilityId:null,worldId:seed.id==='facts098'?value.independentReadback?.identity?.worldId??null:null,tick:null},outcome:seed.outcome,reasonCode:seed.outcome==='passed'?'frozen_external_component_verified':'historical_candidate_rejected',predecessor:null,evidence,verifiedAtUtc:now()}
  f.factId=factIdentity(f);return validateMvpFact(f)
 }
 function verifyStored(f,{admission=false}={}){
  validateMvpFact(f)
  need(Date.parse(f.verifiedAtUtc)<=Date.parse(now())+60000,'mvp_fact_future_time',409)
  need(f.decisionClass==='legacy_external_component','mvp_production_protocol_not_registered',409)
  const seed=LEGACY_MVP.find(s=>s.checkpointId===f.checkpointId&&s.path===f.origin.path&&s.sha256===f.origin.sha256)
  need(seed&&f.outcome===seed.outcome&&f.origin.sourceCategory==='codex'&&f.origin.verifierId==='codex-controller'&&f.origin.revision===0&&f.origin.transactionId===null&&f.predecessor===null,'mvp_legacy_scope_conflict',409)
  need(f.evidence.logicalPath==='.runtime/local-backup/work-recording/evidence/program/'+seed.sha256+'.json','mvp_legacy_snapshot_path',409)
  const record=boundedRead(f.evidence.logicalPath,seed.sha256,MVP_LIMITS.report),expected=build(seed,record,f.evidence)
  need(f.checklist.sha256===expected.checklist.sha256&&f.adapter.id===expected.adapter.id&&f.adapter.version===expected.adapter.version&&f.verifier.version===MVP_VERIFIER_VERSION&&factHash(f.applicability)===factHash(expected.applicability)&&f.reasonCode===expected.reasonCode&&factHash(f.origin)===factHash(expected.origin),'mvp_legacy_fact_conflict',409)
  if(admission)need(f.verifier.implementationSha256===implementationSha256&&f.adapter.implementationSha256===implementationSha256,'mvp_implementation_conflict',409)
  return true
 }
 return {implementationSha256,implementationManifest,currentChecklist,build,verifyStored,withReadPass,readSeed:seed=>{seed=registeredSeed(seed);return boundedRead(seed.path,seed.sha256,MVP_LIMITS.report)},productionAdapters:[],verifyProduction(){throw Error('mvp_production_protocol_not_registered')}}
}
