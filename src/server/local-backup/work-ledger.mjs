import { fields, need, hash, identity, pageQuery, dateKey } from './contracts.mjs'

const keys = ['eventId','producerSequence','moduleId','taskId','runId','eventKind','executionResult','validationStatus','acceptanceStatus','evidenceReferences','originalStartedAtUtc','originalFinishedAtUtc','monotonicElapsedMs','originalEventAtUtc','planReference']
const optional = ['title','completedText','nextStepsText','attributedClaims','reasonCode','sourceReference','reporter','workReport']
const kinds = ['execution_finished','validation_finished','acceptance_finished','blocked','interrupted','progress_report']
const validations = ['passed','failed','unknown'], acceptances = ['accepted','rejected','unknown']
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value
const digest = value => hash(JSON.stringify(canonical(value)))
export function validateWorkReport(report) {
  fields(report,['title','objective','reason','actions','changes','checks','results','issues','nextSteps','planComparison'])
  const text=(v,max)=>need(typeof v==='string'&&v.trim().length>0&&v.length<=max&&!v.includes('\0'),'work_report_text_limit')
  for(const [k,max]of [['title',200],['objective',2000],['reason',2000],['planComparison',4000]])text(report[k],max)
  for(const key of ['actions','results','issues','nextSteps']){need(Array.isArray(report[key])&&report[key].length<=64,'work_report_list_limit');for(const value of report[key])text(value,2000)}
  need(Array.isArray(report.changes)&&report.changes.length<=64,'work_report_changes_limit')
  for(const change of report.changes){fields(change,['path','description']);text(change.path,512);text(change.description,2000)}
  need(Array.isArray(report.checks)&&report.checks.length<=64,'work_report_checks_limit')
  for(const check of report.checks){fields(check,['command','status','description']);if(check.command!==null)text(check.command,2048);need(['passed','failed','not_run','not_verified'].includes(check.status),'work_report_check_status');text(check.description,2000)}
  need(Buffer.byteLength(JSON.stringify(report))<=60*1024,'work_report_byte_limit')
  return report
}
export function workTimestamp(value) {
  need(typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value)), 'invalid_timestamp')
  dateKey(value.slice(0,10)); return value
}
const dateOf = value => value===null ? null : new Date(Date.parse(workTimestamp(value))+28800000).toISOString().slice(0,10)
function originalOf(event) { const {receivedAtUtc,...original}=event; void receivedAtUtc; return original }
function verifyRow(row) {
  const event=JSON.parse(row.payload_json),original=originalOf(event)
  need((original.eventSchemaVersion==='local_work_event_v2'?digest(original):hash(original))===row.sha,'work_event_integrity_conflict',409)
  return event
}
// Producers are object capabilities held by fixed server factories, never HTTP data.
export function createWorkLedger(store, producers = [], options = {}) {
  const registrations = new Set(producers)
  function prepare(producer,input,produced=false) {
    need(registrations.has(producer),'producer_not_registered',403)
    need(Buffer.byteLength(JSON.stringify(input))<=65536,'work_event_byte_limit')
    const required=produced?keys.filter(k=>k!=='producerSequence'):keys
    need(input && typeof input==='object' && !Array.isArray(input) && required.every(k=>Object.hasOwn(input,k)) && Object.keys(input).every(k=>required.includes(k)||optional.includes(k)),'invalid_fields')
    for(const k of ['eventId','moduleId','taskId'])identity(input[k])
    if(input.runId!==null)identity(input.runId)
    if(!produced)need(Number.isSafeInteger(input.producerSequence)&&input.producerSequence>0,'invalid_producer_sequence')
    need(kinds.includes(input.eventKind),'invalid_event_kind')
    need(['succeeded','failed','rejected','blocked','interrupted','unknown'].includes(input.executionResult),'invalid_execution_result')
    need(validations.includes(input.validationStatus),'invalid_validation_status')
    need(acceptances.includes(input.acceptanceStatus),'invalid_acceptance_status')
    need(['human','local_program','codex'].includes(producer.sourceCategory),'producer_registration_invalid',409)
    if(input.validationStatus!=='unknown'||input.acceptanceStatus!=='unknown')need(producer.sourceCategory==='local_program','claim_is_not_machine_validation',403)
    if(input.acceptanceStatus!=='unknown')need(producer.canAccept===true&&input.eventKind==='acceptance_finished','acceptance_producer_required',403)
    for(const k of ['originalStartedAtUtc','originalFinishedAtUtc','originalEventAtUtc'])if(input[k]!==null)workTimestamp(input[k])
    need(input.monotonicElapsedMs===null||(Number.isFinite(input.monotonicElapsedMs)&&input.monotonicElapsedMs>=0),'invalid_elapsed')
    if(input.originalStartedAtUtc&&input.originalFinishedAtUtc)need(Date.parse(input.originalFinishedAtUtc)>=Date.parse(input.originalStartedAtUtc),'invalid_time_order')
    need(Array.isArray(input.evidenceReferences)&&input.evidenceReferences.length<=20,'invalid_evidence')
    for(const e of input.evidenceReferences) {
      fields(e,['logicalPath','sha256'])
      need(typeof e.logicalPath==='string'&&e.logicalPath.length<=512&&!e.logicalPath.includes('\\')&&!e.logicalPath.split('/').some(x=>x==='..'||x==='.'||x==='')&&!/[:\0]/.test(e.logicalPath)&&!e.logicalPath.startsWith('/'),'invalid_evidence_path')
      need(/^[0-9a-f]{64}$/.test(e.sha256),'invalid_evidence_hash')
      need(producer.verifyEvidence?.(e)===true,'evidence_unverified',409)
    }
    if(input.validationStatus!=='unknown'||input.acceptanceStatus!=='unknown')need(input.evidenceReferences.length>0,'result_evidence_required',409)
    let planResolved=null
    if(input.planReference!==null) {
      fields(input.planReference,['authorityPath','documentVersion','documentSha256','moduleOrRequirementId'])
      planResolved=producer.verifyPlan?.(input.planReference)===true
      need(planResolved||producer.allowUnresolvedPlan===true,'plan_reference_unresolved',409)
    }
    for(const [k,max]of [['title',200],['completedText',4000],['nextStepsText',4000],['reasonCode',160]])if(Object.hasOwn(input,k))need(input[k]===null||(typeof input[k]==='string'&&input[k].length<=max&&!input[k].includes('\0')),'work_text_limit')
    if(input.attributedClaims!==undefined&&input.attributedClaims!==null) {
      fields(input.attributedClaims,['validationStatus','acceptanceStatus'])
      need(producer.sourceCategory!=='local_program'&&validations.includes(input.attributedClaims.validationStatus)&&acceptances.includes(input.attributedClaims.acceptanceStatus),'invalid_attributed_claim')
    }
    if(input.sourceReference!==undefined&&input.sourceReference!==null) {
      fields(input.sourceReference,['kind','originId','revision'])
      identity(input.sourceReference.kind);identity(input.sourceReference.originId)
      need(input.sourceReference.revision===null||(Number.isSafeInteger(input.sourceReference.revision)&&input.sourceReference.revision>=0),'invalid_source_revision')
    }
    if(input.reporter!==undefined){fields(input.reporter,['id','name','threadId']);identity(input.reporter.id);need(typeof input.reporter.name==='string'&&input.reporter.name.length>0&&input.reporter.name.length<=200,'work_reporter_invalid');need(input.reporter.threadId===null||/^[a-f0-9-]{36}$/.test(input.reporter.threadId),'work_reporter_invalid');need(!producer.reporter||digest(input.reporter)===digest(producer.reporter),'work_reporter_context_conflict',403)}
    if(input.workReport!==undefined)validateWorkReport(input.workReport)
    if(produced&&producer.reporter)need(input.reporter&&input.workReport,'work_detailed_report_required')
    return planResolved
  }
  function eventFor(producer,input,sequence,produced,planResolved) {
    const event=Object.fromEntries(keys.map(k=>[k,k==='producerSequence'?sequence:input[k]]))
    for(const k of optional)if(Object.hasOwn(input,k))event[k]=input[k]
    Object.assign(event,{producerId:producer.id,sourceCategory:producer.sourceCategory,workDateAsiaShanghai:dateOf(input.originalEventAtUtc)})
    if(produced)Object.assign(event,{eventSchemaVersion:'local_work_event_v2',planReferenceResolution:input.planReference===null?'not_provided':planResolved?'resolved':'unresolved'})
    return event
  }
  function insert(db,producer,input,sequence,produced,planResolved) {
    const event=eventFor(producer,input,sequence,produced,planResolved)
    const previous=db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=? OR (producer_id=? AND producer_sequence=?)').all(input.eventId,producer.id,sequence)
    if(previous.length) {
      need(previous.length===1,'event_idempotency_conflict',409)
      const stored=verifyRow(previous[0])
      // Resolution describes the authority bytes at first receipt. A later plan
      // revision must not rewrite that historical observation on replay.
      if(produced)event.planReferenceResolution=stored.planReferenceResolution
      need(digest(originalOf(stored))===digest(event),'event_idempotency_conflict',409)
      return {replayed:true,event:stored}
    }
    const stored={...event,receivedAtUtc:new Date().toISOString()}
    db.prepare('INSERT INTO work_events VALUES (?,?,?,?,?,?,?,?,?)').run(input.eventId,producer.id,sequence,input.moduleId,input.taskId,input.originalEventAtUtc===null?null:new Date(Date.parse(input.originalEventAtUtc)).toISOString(),event.workDateAsiaShanghai,JSON.stringify(stored),produced?digest(event):hash(event))
    db.exec('UPDATE module_meta SET revision=revision+1 WHERE id=1')
    return {replayed:false,event:stored}
  }
  function append(producer,input) {
    const resolved=prepare(producer,input)
    return store.write(db=>insert(db,producer,input,input.producerSequence,false,resolved))
  }
  function appendProduced(producer,input) {
    const resolved=prepare(producer,input,true)
    return store.write(db=>{
      const existing=db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=?').get(input.eventId)
      const sequence=existing?verifyRow(existing).producerSequence:db.prepare('SELECT COALESCE(MAX(producer_sequence),0)+1 AS n FROM work_events WHERE producer_id=?').get(producer.id).n
      return insert(db,producer,input,sequence,true,resolved)
    })
  }
  function find(eventId) { identity(eventId);return store.read(db=>{const row=db.prepare('SELECT payload_json,sha FROM work_events WHERE event_id=?').get(eventId);return row?verifyRow(row):null}) }
  function query(search,summary=false) {
    const date=search.get('date');if(date!==null)dateKey(date)
    const moduleFilter=search.get('moduleId');if(moduleFilter!==null)identity(moduleFilter)
    const reporterFilter=search.get('reporterId');if(reporterFilter!==null)identity(reporterFilter)
    return store.read((db,meta)=>{
      const page=pageQuery(search,['date','moduleId','reporterId'],meta.revision,`${summary?'summary':'events'}:${date}:${moduleFilter}:${reporterFilter}`)
      const coverage=options.readCoverage?.({date})??{complete:false,producerCount:producers.length}
      if(!producers.length)return {dataStatus:'not_connected',reasonCode:'trusted_work_producers_not_connected',records:null,total:null,nextCursor:null,revision:meta.revision,coverage}
      const args=[date,date,moduleFilter,moduleFilter],where='WHERE (? IS NULL OR work_date=?) AND (? IS NULL OR module_id=?)'
      const total=db.prepare(`SELECT COUNT(*) AS n FROM work_events ${where}`).get(...args).n
      need(total<=10000,'work_query_limit',409)
      const events=db.prepare(`SELECT payload_json,sha FROM work_events ${where} ORDER BY event_at_utc,event_id`).all(...args).map(verifyRow).filter(e=>reporterFilter===null||e.reporter?.id===reporterFilter)
      const records=summary?aggregateWorkEvents(events):events
      return {dataStatus:'partial',reasonCode:'work_source_coverage_partial',records:records.slice(page.offset,page.offset+page.limit),total:null,knownRecordCount:records.length,nextCursor:page.offset+page.limit<records.length?page.next(page.offset+page.limit):null,revision:meta.revision,coverage}
    })
  }
  return {append,appendProduced,find,events:search=>query(search),summary:search=>query(search,true)}
}
export function aggregateWorkEvents(events) {
  const groups=new Map()
  for(const event of events) {
    const key=JSON.stringify([event.moduleId,event.workDateAsiaShanghai,event.reporter?.id??null])
    if(!groups.has(key))groups.set(key,{moduleId:event.moduleId,date:event.workDateAsiaShanghai,...(event.reporter?{reporter:event.reporter}:{}),executionEnded:new Set(),validationPassed:new Set(),acceptanceCompleted:new Set(),failed:new Set(),rejected:new Set(),blocked:new Set(),interrupted:new Set(),unknown:new Set(),attributedClaims:new Set(),codexClaimedValidationPassed:new Set(),codexClaimedAcceptanceAccepted:new Set(),progressReports:new Set()})
    const g=groups.get(key),id=JSON.stringify([event.taskId,event.runId])
    if(event.eventKind==='progress_report'){g.progressReports.add(event.eventId);continue}
    if(event.sourceCategory!=='local_program') {g.attributedClaims.add(id);if(event.sourceCategory==='codex'&&event.attributedClaims?.validationStatus==='passed')g.codexClaimedValidationPassed.add(id);if(event.sourceCategory==='codex'&&event.attributedClaims?.acceptanceStatus==='accepted')g.codexClaimedAcceptanceAccepted.add(id);continue}
    if(event.eventKind==='execution_finished')g.executionEnded.add(id)
    if(event.eventKind==='validation_finished'&&event.validationStatus==='passed')g.validationPassed.add(id)
    if(event.eventKind==='acceptance_finished'&&event.acceptanceStatus==='accepted')g.acceptanceCompleted.add(id)
    if(['failed','rejected','blocked','interrupted','unknown'].includes(event.executionResult))g[event.executionResult].add(id)
    if(event.validationStatus==='failed')g.failed.add(id)
    if(event.acceptanceStatus==='rejected')g.rejected.add(id)
  }
  return [...groups.values()].map(g=>Object.fromEntries(Object.entries(g).map(([k,v])=>[k,v instanceof Set?v.size:v])))
}
