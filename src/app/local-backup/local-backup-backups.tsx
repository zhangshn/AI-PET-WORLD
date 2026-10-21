'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './local-backup.module.css'
import { query, reason, time, type Run } from './local-backup-shared'
export function LocalBackupTasksPanel(){
 const [runs,setRuns]=useState<Run[]|null>(null),[runError,setRunError]=useState(''),[cursor,setCursor]=useState<string|null>(null),[runBusy,setRunBusy]=useState(false)
 const [selected,setSelected]=useState<Run|null>(null),[entries,setEntries]=useState<Record<string,unknown>[]|null>(null),[entryCursor,setEntryCursor]=useState<string|null>(null),[entryError,setEntryError]=useState(''),[retry,setRetry]=useState(0)
 const entryRequest=useRef({runId:null as string|null,generation:0,pending:false})
 useEffect(()=>()=>{entryRequest.current.generation++},[])
 useEffect(()=>{let active=true;query('/api/local-backup/runs?limit=20').then(x=>{if(active){setRuns(x.records);setCursor(x.nextCursor);setRunError('')}}).catch(e=>{if(active)setRunError(reason(e))});return()=>{active=false}},[retry])
  async function moreRuns() {
    if(!cursor||runBusy)return;setRunBusy(true)
    try{const x=await query(`/api/local-backup/runs?limit=20&cursor=${encodeURIComponent(cursor)}`);setRuns(current=>[...(current??[]),...x.records]);setCursor(x.nextCursor)}catch(e){setRunError(reason(e))}finally{setRunBusy(false)}
  }
  async function showRun(run:Run,next:string|null=null) {
    if(next&&(entryRequest.current.runId!==run.backup_id||entryRequest.current.pending))return
    const generation=++entryRequest.current.generation
    entryRequest.current.runId=run.backup_id;entryRequest.current.pending=true
    const isCurrent=()=>entryRequest.current.runId===run.backup_id&&entryRequest.current.generation===generation
    setSelected(run);setEntryError('');setEntryCursor(null)
    if(!next)setEntries(null)
    try{
      const x=await query(`/api/local-backup/runs/${encodeURIComponent(run.backup_id)}/entries?limit=20${next?`&cursor=${encodeURIComponent(next)}`:''}`)
      if(!isCurrent())return
      if(!Array.isArray(x.records)||x.records.some((entry:Record<string,unknown>)=>entry.backup_id!==run.backup_id))throw new Error('backup_entry_identity_conflict')
      setEntries(current=>isCurrent()?(next?[...(current??[]),...x.records]:x.records):current);setEntryCursor(x.nextCursor)
    }catch(e){if(isCurrent()){setEntryError(reason(e));setEntries(null)}}
    finally{if(isCurrent())entryRequest.current.pending=false}
  }

 return <><div className={styles.toolbar}><span>查询已保存的任务与清单。</span><button onClick={()=>{entryRequest.current.generation++;entryRequest.current.runId=null;entryRequest.current.pending=false;setSelected(null);setEntries(null);setEntryCursor(null);setRetry(x=>x+1)}}>刷新备份记录</button></div>
    <section id="backups" className={styles.section} aria-labelledby="backup-title"><div className={styles.sectionTitle}><h2 id="backup-title">备份执行与清单</h2><span className={styles.badge}>真实备份未接入</span></div>
      <p>当前未执行真实备份。秘密安全纳入、全量容量及跨文件一致性仍待核验，恢复能力未知。</p>
      <button disabled title="真实备份适配器尚未取得执行资格">手动备份 · 尚未接入</button>
      {runError?<p role="alert" className={styles.error}>备份查询失败：{runError}</p>:runs===null?<p role="status">读取中…</p>:runs.length===0?<div className={styles.emptyState}><h3>暂无备份执行记录</h3><p>记录库已连接。真实备份执行尚未接入，当前没有可查询的Run。</p></div>:<div className={styles.tableWrap}><table><thead><tr><th>任务与状态</th><th>开始时间</th><th>实际耗时</th><th>校验</th><th>恢复资格</th></tr></thead><tbody>{runs.map(r=><tr key={r.backup_id}><td><button onClick={()=>showRun(r)}>{r.backup_id} · {r.state}</button></td><td>{time(r.started_at_utc)}</td><td>{r.elapsed_ms===null?'未知':`${r.elapsed_ms} ms`}</td><td>{r.verification_status}</td><td>{r.restorability_status}</td></tr>)}</tbody></table></div>}
      {cursor&&<button disabled={runBusy} onClick={moreRuns}>加载更多备份</button>}
      {selected&&<div><h3>执行记录 {selected.backup_id}</h3><p>开始 {time(selected.started_at_utc)} / 结束 {time(selected.finished_at_utc)} / 耗时 {selected.elapsed_ms===null?'未知':`${selected.elapsed_ms} ms`} / 失败原因 {selected.failure_code??'无记录'}</p><p>覆盖 {selected.coverage} / 校验 {selected.verification_status} / 恢复 {selected.restorability_status}</p>{entryError?<p role="alert">{entryError}</p>:entries===null?<p role="status">正在读取所选任务清单…</p>:entries.length===0?<p className={styles.muted}>该任务没有已记录清单条目。</p>:<div className={styles.tableWrap}><table><thead><tr><th>来源根</th><th>相对路径</th><th>字节数</th><th>捕获状态</th></tr></thead><tbody>{entries.map((entry,index)=><tr key={`${entry.root_id}-${entry.relative_path}-${index}`}><td>{String(entry.root_id??'未记录')}</td><td><code>{String(entry.relative_path??'未记录')}</code></td><td>{typeof entry.byte_size==='number'?entry.byte_size.toLocaleString():'未知'}</td><td>{String(entry.capture_status??'未知')}</td></tr>)}</tbody></table></div>}{entries&&<details><summary>原始清单元数据</summary><pre>{JSON.stringify(entries,null,2)}</pre></details>}{entryCursor&&<button onClick={()=>showRun(selected,entryCursor)}>更多清单条目</button>}</div>}
    </section>
</>
}
