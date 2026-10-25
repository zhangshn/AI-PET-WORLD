import { need, identity, pageQuery } from './contracts.mjs'

const summaryFields=['eventId','title','moduleId','taskId','runId','producerId','reporter','sourceCategory','eventKind','executionResult','validationStatus','acceptanceStatus','originalEventAtUtc','originalStartedAtUtc','originalFinishedAtUtc','monotonicElapsedMs','attributedClaims']
export function workRecordPage(ledger,search) {
  need(search.toString().length<=4096,'work_query_limit')
  const result=ledger.events(search),date=search.get('date'),moduleId=search.get('moduleId'),reporter=search.get('reporterId')
  const page=pageQuery(search,['date','moduleId','reporterId'],result.revision,`events:${date}:${moduleId}:${reporter}`)
  return {...result,records:result.records?.map(event=>({...Object.fromEntries(summaryFields.filter(k=>Object.hasOwn(event,k)).map(k=>[k,event[k]])),hasWorkReport:!!event.workReport}))??null,previousCursor:page.offset>0?page.next(Math.max(0,page.offset-page.limit)):null}
}
export function workRecordDetail(ledger,id){identity(id);const record=ledger.find(id);need(record,'work_event_not_found',404);return{dataStatus:'connected',reasonCode:'exact_recorded_work_event',record}}
