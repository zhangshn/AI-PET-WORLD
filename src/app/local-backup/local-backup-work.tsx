'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './local-backup.module.css'
import { DetailedWorkReport, type WorkReport } from './local-backup-work-report'
import { query, reason, time, today } from './local-backup-shared'
type Journal = {date:string;revision:number;completedText:string;planText:string;backupId:string|null;updatedAtUtc:string;sourceCategory:string}
type WorkSummary = {dataStatus:string;reasonCode:string;records:Record<string,unknown>[]|null;total:number|null;coverage?:{complete:boolean;registeredReporters?:{id:string;name:string;threadId:string;coverageStatus:string;knownReportCount:number|null}[]}}
function summaryReporter(row:Record<string,unknown>) { const reporter=row.reporter as {name?:string;id?:string}|undefined;return reporter?.name??reporter?.id??'窗口未记录' }
type WorkEvent = {eventId:string;moduleId:string;taskId:string;runId:string|null;producerId?:string;reporter?:{id:string;name:string;threadId:string|null};workReport?:WorkReport;sourceCategory:string;eventKind:string;executionResult:string;validationStatus:string;acceptanceStatus:string;originalEventAtUtc:string|null;originalStartedAtUtc:string|null;originalFinishedAtUtc:string|null;monotonicElapsedMs:number|null;title?:string;completedText?:string;nextStepsText?:string;attributedClaims?:{validationStatus:string;acceptanceStatus:string};planReferenceResolution?:string;evidenceReferences:{logicalPath:string;sha256:string}[];planReference:{authorityPath:string;documentVersion:string|null;documentSha256:string;moduleOrRequirementId:string}|null}
function groupWork(events:WorkEvent[]|null){
  const modules=new Map<string,Map<string,{reporter:WorkEvent['reporter'];sourceCategory:string;events:WorkEvent[]}>>()
  for(const event of events??[]){
    if(!modules.has(event.moduleId))modules.set(event.moduleId,new Map())
    const windows=modules.get(event.moduleId)!,id=`${event.sourceCategory}:${event.reporter?.id??event.producerId??'window_not_recorded'}:${event.reporter?.threadId??'thread_not_recorded'}`
    if(!windows.has(id))windows.set(id,{reporter:event.reporter,sourceCategory:event.sourceCategory,events:[]})
    windows.get(id)!.events.push(event)
  }
  return [...modules].map(([moduleId,windows])=>({moduleId,windows:[...windows].map(([id,value])=>({id,...value}))}))
}

export function LocalBackupWorkPanel({date=today(),moduleId='',reporterId=''}:{date?:string;moduleId?:string;reporterId?:string}={}) {
 const router=useRouter(),filter=new URLSearchParams({date})
 if(moduleId)filter.set('moduleId',moduleId)
 if(reporterId)filter.set('reporterId',reporterId)
 const filterKey=filter.toString()
 const [journal,setJournal]=useState<Journal|null>(null),[completed,setCompleted]=useState(''),[plan,setPlan]=useState(''),[journalError,setJournalError]=useState(''),[journalReady,setJournalReady]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState('')
 const [work,setWork]=useState<WorkSummary|null>(null),[workError,setWorkError]=useState(''),[workEvents,setWorkEvents]=useState<WorkEvent[]|null>(null),[workEventsError,setWorkEventsError]=useState(''),[workCursor,setWorkCursor]=useState<string|null>(null),[workBusy,setWorkBusy]=useState(false),[retry,setRetry]=useState(0)
 const workRequest=useRef({key:filterKey,generation:0,paging:false}),journalRequest=useRef({date,generation:0})
 useEffect(()=>{
  let active=true
  const generation=++workRequest.current.generation;workRequest.current.key=filterKey;workRequest.current.paging=false
  const current=()=>active&&workRequest.current.generation===generation&&workRequest.current.key===filterKey
  query('/api/local-backup/work-summary?'+filterKey,{},true).then(x=>{if(current())setWork(x)}).catch(e=>{if(current())setWorkError(reason(e))})
  query('/api/local-backup/work-events?'+filterKey+'&limit=20',{},true).then(x=>{if(current()){setWorkEvents(x.records);setWorkCursor(x.nextCursor)}}).catch(e=>{if(current())setWorkEventsError(reason(e))})
  return()=>{active=false}
 },[filterKey,retry])
 useEffect(()=>{
  let active=true;const generation=++journalRequest.current.generation;journalRequest.current.date=date
  const current=()=>active&&journalRequest.current.generation===generation&&journalRequest.current.date===date
  query('/api/local-backup/journal?date='+encodeURIComponent(date)).then(x=>{if(current()){setJournal(x.record);setCompleted(x.record?.completedText??'');setPlan(x.record?.planText??'');setJournalReady(true)}}).catch(e=>{if(current())setJournalError(reason(e))})
  return()=>{active=false}
 },[date,retry])
 function clearWork(){workRequest.current.generation++;workRequest.current.paging=false;setWork(null);setWorkEvents(null);setWorkCursor(null);setWorkError('');setWorkEventsError('');setWorkBusy(false)}
 function clearJournal(){journalRequest.current.generation++;setJournalReady(false);setJournalError('');setSaved('');setJournal(null);setCompleted('');setPlan('')}
 function navigate(nextDate:string,nextModule:string,nextReporter:string){
  clearWork()
  if(nextDate!==date)clearJournal()
  const params=new URLSearchParams({date:nextDate});if(nextModule)params.set('moduleId',nextModule);if(nextReporter)params.set('reporterId',nextReporter)
  router.push('/local-backup/work?'+params.toString(),{scroll:false})
 }
 async function moreWork(){
  if(!workCursor||workBusy||workRequest.current.paging||workRequest.current.key!==filterKey)return
  const generation=workRequest.current.generation,expectedKey=filterKey,cursor=workCursor
  const current=()=>workRequest.current.generation===generation&&workRequest.current.key===expectedKey
  workRequest.current.paging=true;setWorkBusy(true);setWorkEventsError('')
  try{const x=await query('/api/local-backup/work-events?'+expectedKey+'&limit=20&cursor='+encodeURIComponent(cursor),{},true);if(current()){setWorkEvents(rows=>current()?[...(rows??[]),...(x.records??[])]:rows);setWorkCursor(x.nextCursor)}}catch(e){if(current())setWorkEventsError(reason(e))}finally{if(current()){workRequest.current.paging=false;setWorkBusy(false)}}
 }
 async function save(){
  const generation=journalRequest.current.generation,expectedDate=date
  const current=()=>journalRequest.current.generation===generation&&journalRequest.current.date===expectedDate
  setBusy(true);setJournalError('');setSaved('')
  try{const session=await query('/api/ai-console/control/session'),csrf=session.session?.csrfToken??session.csrfToken;if(typeof csrf!=='string')throw new Error('operator_session_unavailable')
   const x=await query('/api/local-backup/journal',{method:'PUT',headers:{'Content-Type':'application/json','x-ai-console-csrf':csrf},body:JSON.stringify({date:expectedDate,completedText:completed,planText:plan,backupId:journal?.backupId??null,expectedRevision:journal?.revision??0})})
   if(current()){setJournal(x.record);setSaved('已保存 · 修订 '+x.record.revision+' · '+time(x.record.updatedAtUtc))}
  }catch(e){if(current())setJournalError(reason(e))}finally{setBusy(false)}
 }
 const moduleOptions=[...new Set(['ai-painter','ai-console','local-backup',moduleId,...(work?.records??[]).map(row=>String(row.moduleId??''))])].filter(Boolean)
 const knownReporters=[...(work?.coverage?.registeredReporters??[]),...(workEvents??[]).flatMap(event=>event.reporter?[event.reporter]:[])]
 const reporterOptions=[...new Map(knownReporters.map(reporter=>[reporter.id,reporter])).values()]
 if(reporterId&&!reporterOptions.some(reporter=>reporter.id===reporterId))reporterOptions.push({id:reporterId,name:reporterId,threadId:null})
 return <><div className={styles.toolbar}><span>来源、原始时间与验证状态分别保留。</span><button disabled={busy} onClick={()=>{clearWork();clearJournal();setRetry(x=>x+1)}}>刷新工作记录</button></div>
    <section id="work" className={styles.section} aria-labelledby="work-title"><div className={styles.sectionTitle}><h2 id="work-title">每日自动工作记录</h2><span className={styles.badge}>{work?.dataStatus==='not_connected'?'生产者未接入':work?.dataStatus==='partial'?'覆盖不完整':work?.dataStatus==='connected'?'已接入':'等待查询'}</span></div>
      <p>由程序和Codex分别提交真实记录，您无需每天填报。按功能模块对照已有正式计划，执行结束、验证通过和验收完成分别统计。</p>
      <div className={styles.filters}>
<label>工作日期（北京时间）<input type="date" value={date} disabled={busy} onChange={e=>{if(e.target.value)navigate(e.target.value,moduleId,reporterId)}}/></label>
<label>功能模块<select value={moduleId} disabled={busy} onChange={e=>navigate(date,e.target.value,reporterId)}><option value="">全部功能</option>{moduleOptions.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
<label>执行窗口 / 生产者<select value={reporterId} disabled={busy} onChange={e=>navigate(date,moduleId,e.target.value)}><option value="">全部窗口与生产者</option>{reporterOptions.map(reporter=><option key={reporter.id} value={reporter.id}>{reporter.name}</option>)}</select></label>
</div>
      <p>仅显示已接入来源的已记录范围；尚未覆盖的模块和历史保持未知，Codex记录不代表本地AI自主研发。</p>
      {workError?<p role="alert" className={styles.error}>{workError}</p>:work?.dataStatus==='not_connected'?<p className={styles.notice}>自动工作事件尚未接入，未生成任务完成统计。不回填聊天或旧历史。</p>:work?<>
        <div className={styles.tableWrap}><table><thead><tr><th>功能模块</th><th>窗口 / 生产者</th><th>程序执行结束</th><th>程序验证通过</th><th>独立验收完成</th><th>失败 / 拒绝</th><th>受阻 / 中断</th><th>外部结果陈述</th><th>进展报告</th></tr></thead><tbody>{work.records?.map((row,index)=><tr key={`${row.moduleId}-${index}`}><td>{String(row.moduleId??'未知')}</td><td>{summaryReporter(row)}</td>{['executionEnded','validationPassed','acceptanceCompleted'].map(key=><td key={key}>{typeof row[key]==='number'?String(row[key]):'未知'}</td>)}<td>{String(row.failed??'未知')} / {String(row.rejected??'未知')}</td><td>{String(row.blocked??'未知')} / {String(row.interrupted??'未知')}</td><td>{String(row.attributedClaims??'未知')}</td><td>{String(row.progressReports??'未知')}</td></tr>)}</tbody></table></div>
        {work.records?.length===0&&<p>当前已接入范围在该日期没有已记录事件；这不是全项目“今日完成0项”。</p>}
        {work.coverage?.registeredReporters&&<aside><h4>逐窗口报告覆盖（未提交不等于没工作）</h4><ul>{work.coverage.registeredReporters.map(reporter=><li key={reporter.id}>{reporter.name}：{reporter.coverageStatus==="reported_partial"?`已记录${reporter.knownReportCount??"未知"}项，仅部分覆盖`:reporter.coverageStatus==="no_report_recorded"?"该日尚未记录报告，工作量未知":"记录状态未知"}</li>)}</ul></aside>}
        <details><summary>来源覆盖与缺口</summary><pre>{JSON.stringify(work.coverage??{complete:false},null,2)}</pre></details>
      </>:<p role="status">读取中…</p>}
      {workEvents&&<p>当前已加载 {workEvents.length} 条记录，按功能和执行窗口归类；分页与来源覆盖仍以真实缺口为准。</p>}
      {groupWork(workEvents).map(group=><div key={group.moduleId}><h3>功能：{group.moduleId}</h3>{group.windows.map(reporterGroup=><section key={reporterGroup.id} className={styles.reportWindow} aria-label="执行窗口"><h4>执行窗口 / 生产者：{reporterGroup.reporter?.name??"旧记录未保存窗口名称"}</h4>{reporterGroup.reporter?<p>窗口标识：<code>{reporterGroup.reporter.id}</code> / 聊天：<code>{reporterGroup.reporter.threadId??"未提供"}</code></p>:<p>该分组保留原来源，窗口身份未记录。</p>}{reporterGroup.events.map(event=><article key={event.eventId} className={styles.reportArticle}><h3>{event.title??`${event.moduleId} / ${event.eventKind}`}</h3><p><strong>{event.sourceCategory==='codex'?'Codex · 外部执行':event.sourceCategory==='local_program'?'本地程序':event.sourceCategory==='human'?'人工陈述':event.sourceCategory}</strong> · {event.moduleId} · {time(event.originalEventAtUtc)}</p>{event.completedText&&<p>{event.completedText}</p>}{event.nextStepsText&&<p>下一步建议：{event.nextStepsText}（不自动改变正式范围）</p>}{event.workReport?<DetailedWorkReport report={event.workReport}/>:<p>旧记录没有详细报告，保留原字段与证据，不补造历史。</p>}<p>执行结果：{event.executionResult} / 验证：{event.validationStatus} / 验收：{event.acceptanceStatus}</p>{event.sourceCategory==='codex'&&event.attributedClaims&&<p>Codex自报验证：{event.attributedClaims.validationStatus} / 自报验收：{event.attributedClaims.acceptanceStatus}（外部来源，不能替代独立机器验收）</p>}<details><summary>任务、时间与证据</summary><p>任务：{event.taskId} / Run：{event.runId??'未提供'}</p><p>原始开始：{time(event.originalStartedAtUtc)} / 结束：{time(event.originalFinishedAtUtc)} / 实测耗时：{event.monotonicElapsedMs??'未知'} ms</p>{event.planReference?<p>计划引用（{event.planReferenceResolution??'解析状态未记录'}）：<code>{event.planReference.authorityPath}</code> / {event.planReference.moduleOrRequirementId} / 版本 {event.planReference.documentVersion??'未设置，使用实际摘要'} / <code>{event.planReference.documentSha256}</code></p>:<p>计划引用尚未解析。</p>}<ul>{event.evidenceReferences.map(e=><li key={e.logicalPath}><code>{e.logicalPath}</code> · <code>{e.sha256}</code></li>)}</ul></details></article>)}</section>)}</div>)}
      {workEventsError&&<p role="alert" className={styles.error}>事件查询失败：{workEventsError}</p>}
      {workCursor&&<button disabled={workBusy} onClick={moreWork}>加载更多自动记录</button>}
    </section>
    <details id="journal" className={styles.section}><summary>可选人工补充（无需每日填写）</summary><div aria-labelledby="journal-title"><h2 id="journal-title">可选备注</h2>
      <p>这一区域仅保存可选备注与下一步建议，不代替程序自动记录，也不更改机器结果或正式项目范围。当前日期：{date}。</p>
      {journalReady&&<p className={styles.muted}>{journal?`已存修订 ${journal.revision} · ${time(journal.updatedAtUtc)} · 来源：人工`:'该日期尚无人工记录。'}</p>}
      <div className={styles.editor}><label>完成事项备注<textarea maxLength={16000} value={completed} disabled={!journalReady||busy} onChange={e=>{setCompleted(e.target.value);setSaved('')}} rows={6}/><span>{completed.length} / 16000</span></label><label>下一步建议<textarea maxLength={16000} value={plan} disabled={!journalReady||busy} onChange={e=>{setPlan(e.target.value);setSaved('')}} rows={6}/><span>{plan.length} / 16000</span></label></div>
      <p>关联备份：{journal?.backupId??'无（当前没有可关联的实际备份）'}</p>
      <button onClick={save} disabled={!journalReady||busy}>{busy?'保存中…':'保存人工记录'}</button>
      <p aria-live="polite">{saved}</p>{journalError&&<p className={styles.error} role="alert">记录未保存 / 读取失败：{journalError}。发生修订冲突时请保留编辑内容，另页核对最新修订后再保存。</p>}
    </div></details>
 </>
}
