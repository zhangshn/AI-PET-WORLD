import test from 'node:test'
import assert from 'node:assert/strict'
import { uiHarness, response } from './helpers/local-backup-ui.mjs'
const event=(title,sourceCategory='local_program')=>({eventId:title,moduleId:'module-9',taskId:'private-task',runId:null,sourceCategory,reporter:sourceCategory==='codex'?{id:'codex-fixture',name:'备份窗口夹具',threadId:'private-thread'}:{id:'program-fixture',name:'程序生产者夹具',threadId:null},eventKind:'execution_finished',executionResult:'succeeded',validationStatus:'unknown',acceptanceStatus:'unknown',originalEventAtUtc:'2026-10-21T18:00:00Z',originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,title,completedText:'真实来源字段的私有夹具',nextStepsText:'后续建议不是授权',evidenceReferences:[],planReference:null})

function harness(events){
 return uiHarness('src/app/local-backup/local-backup-work.tsx','LocalBackupWorkPanel',{fetch:async url=>{
  if(url.includes('/journal'))return response({record:null})
  if(url.includes('/work-records'))return response(await events(new URL('http://localhost'+url)))
  if(url.includes('/work-summary'))return response({dataStatus:'partial',records:[{moduleId:'module-9',reporter:{id:'codex-fixture',name:'汇总窗口夹具'},executionEnded:1,validationPassed:0,acceptanceCompleted:0,failed:0,rejected:0,blocked:0,interrupted:0,attributedClaims:1,progressReports:3}],coverage:{complete:false,registeredReporters:[{id:'missing-window',name:'尚未提交的窗口夹具',threadId:'unknown-fixture',coverageStatus:'no_report_recorded',knownReportCount:null}]}})
  throw Error('unexpected unrelated API '+url)
 }})
}
test('automatic work is primary, manual journal is optional/collapsed, source and unknown measurements stay separate',async()=>{
 const ui=harness(async()=>({records:[event('program-event'),event('codex-event','codex')],nextCursor:null}));await ui.tick()
 assert(ui.text().includes('工作记录'));assert(!ui.text().includes('真实来源字段的私有夹具'));assert(ui.text().includes('本地程序'));assert(ui.text().includes('Codex · 外部执行'));assert(!ui.text().includes('实测耗时'))
 assert(ui.text().includes('备份窗口夹具'));assert(ui.text().includes('程序生产者夹具'));assert(ui.text().includes('尚未记录报告，工作量未知'));assert(!ui.text().includes('部分来源已接入'))
 assert(ui.text().includes('程序执行结束'));assert(ui.text().includes('程序验证通过'));assert(ui.text().includes('独立验收完成'))
 const optional=ui.nodes().find(n=>n.type==='details'&&n.props?.id==='journal');assert(optional);assert.notEqual(optional.props.open,true)
 assert(!ui.text().includes('后续建议不是授权'));const detail=uiHarness('src/app/local-backup/work/work-detail.tsx','WorkDetail',{props:{eventId:'detail',values:{date:'2026-10-22'}},fetch:async()=>response({record:event('full-detail')})});await detail.tick();assert(detail.text().includes('后续建议不是授权'));assert(detail.text().includes('计划引用尚未解析'));assert(detail.text().includes('实测耗时'));assert(detail.text().includes('未知'))
})
test('a late previous-date event response cannot replace the chosen new date',async()=>{
 let oldDate,finishOld
 const ui=harness(url=>{const date=url.searchParams.get('date');oldDate??=date;if(date===oldDate)return new Promise(resolve=>{finishOld=resolve});return{records:[event('new-date-record')],nextCursor:null}})
 await ui.tick();const dateInput=ui.nodes().find(n=>n.type==='input'&&n.props.type==='date'),newDate=dateInput.props.value==='2026-10-23'?'2026-10-24':'2026-10-23'
 dateInput.props.onChange({target:{value:newDate}});ui.render();await ui.tick();assert(ui.text().includes('new-date-record'))
 finishOld({records:[event('old-date-record')],nextCursor:null});await ui.tick();assert(ui.text().includes('new-date-record'));assert(!ui.text().includes('old-date-record'))
})
test('an old pagination response is discarded when the work date changes',async()=>{
 let originalDate,finishPage
 const ui=harness(url=>{const date=url.searchParams.get('date');originalDate??=date;if(url.searchParams.has('cursor'))return new Promise(resolve=>{finishPage=resolve});return{records:[event(date===originalDate?'first-old-day':'first-new-day')],nextCursor:date===originalDate?'fixture-cursor':null}})
 await ui.tick();const more=ui.button('下一页');more.props.onClick();ui.render();await ui.tick()
 const input=ui.nodes().find(n=>n.type==='input'&&n.props.type==='date');input.props.onChange({target:{value:input.props.value==='2026-10-23'?'2026-10-24':'2026-10-23'}});ui.render();await ui.tick()
 finishPage({records:[event('stale-old-page')],nextCursor:null});await ui.tick();ui.render();assert(ui.text().includes('first-new-day'));assert(!ui.text().includes('stale-old-page'));assert(!ui.text().includes('first-old-day'))
})
