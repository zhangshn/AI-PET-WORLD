'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCatalog } from './documents/use-catalog'
import { ManualJournal } from './work/manual-journal'
import { WorkCoverage, type Summary } from './work/work-coverage'
import type { WorkPage } from './work/work-types'
import { workSearch, workListUrl, workDetailUrl, sourceName, type WorkValues } from './work/work-url'
import { time, today } from './local-backup-shared'
import styles from './work/work.module.css'

export function LocalBackupWorkPanel({date=today(),moduleId='',reporterId='',cursor='',limit='20'}:WorkValues={}){
 const router=useRouter(),values={date,moduleId,reporterId,cursor,limit},search=workSearch(values),filters=workSearch({date,moduleId,reporterId})
 const [refresh,setRefresh]=useState(0),{data:page,error}=useCatalog<WorkPage>('/api/local-backup/work-records?'+search,refresh),summary=useCatalog<Summary>('/api/local-backup/work-summary?'+filters,refresh)
 const scope=useRef(search)
 useEffect(()=>{scope.current=search;return()=>{scope.current=''}},[search])
 const reporters=page?.coverage?.registeredReporters??[],navigate=(changes:WorkValues)=>{if(scope.current===search)router.push(workListUrl({...values,...changes}),{scroll:false})}
 return <><div className={styles.toolbar}><p>按日期、功能与窗口定位记录，打开独立详情查看完整报告。</p><button onClick={()=>setRefresh(x=>x+1)}>刷新工作记录</button></div><WorkCoverage summary={summary.data}/>{summary.error&&<p role="alert" className={styles.error}>汇总查询失败：{summary.error}</p>}
 <section className={styles.section} id="work"><div className={styles.sectionHeading}><div><span className={styles.kicker}>已记录范围</span><h2>工作记录</h2></div><span>{page?.knownRecordCount??'—'} 条已知记录</span></div><div className={styles.filters}><label>工作日期（北京时间）<input type="date" value={date} onChange={e=>{if(e.target.value)navigate({date:e.target.value,cursor:''})}}/></label><label>功能模块<select value={moduleId} onChange={e=>navigate({moduleId:e.target.value,cursor:''})}><option value="">全部功能</option>{['ai-painter','capability-migration','ai-console','local-backup'].map(id=><option key={id} value={id}>{id}</option>)}</select></label><label>执行窗口 / 生产者<select value={reporterId} onChange={e=>navigate({reporterId:e.target.value,cursor:''})}><option value="">全部窗口与生产者</option>{reporters.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}{reporterId&&!reporters.some(r=>r.id===reporterId)&&<option value={reporterId}>{reporterId}</option>}</select></label></div>
 {error&&<p role="alert" className={styles.error}>事件查询失败：{error}。修订变化时请<Link href={workListUrl({date,moduleId,reporterId})}>返回第一页</Link>。</p>}{!page&&!error&&<p role="status">读取工作摘要中…</p>}
 <div className={styles.list} key={search+refresh}>{page?.records?.map(event=><article className={styles.row} key={event.eventId}><div className={styles.rowMain}><div className={styles.rowMeta}><span>{sourceName(event.sourceCategory)}</span><span>{event.moduleId}</span><time>{time(event.originalEventAtUtc)}</time></div><h3><Link href={workDetailUrl(event.eventId,values)}>{event.title??`${event.moduleId} / ${event.eventKind}`}</Link></h3><p>{event.reporter?.name??event.producerId??'窗口身份未记录'} · 任务 {event.taskId}</p><p>关联 Run：<code>{event.runId??'未提供，关联范围未知'}</code></p><div className={styles.states}><span>执行 {event.executionResult}</span><span>验证 {event.validationStatus}</span><span>验收 {event.acceptanceStatus}</span>{event.sourceCategory==='codex'&&<span>外部陈述单列于详情</span>}</div></div><Link className={styles.detailLink} href={workDetailUrl(event.eventId,values)}>查看详情 <span aria-hidden="true">↗</span><small>{event.hasWorkReport?'完整报告':'原始事件'}</small></Link></article>)}{page?.records?.length===0&&<div className={styles.empty}>当前条件没有已记录事件。这不是全项目“今日完成 0 项”。</div>}</div>
 <nav className={styles.paging} aria-label="工作记录分页"><span>每页 {limit} 条 · 翻页替换当前页</span><div><button disabled={!page?.previousCursor} onClick={()=>navigate({cursor:page?.previousCursor??''})}>上一页</button><button disabled={!page?.nextCursor} onClick={()=>navigate({cursor:page?.nextCursor??''})}>下一页</button></div></nav></section><ManualJournal key={date+refresh} date={date}/></>
}
