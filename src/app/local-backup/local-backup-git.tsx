'use client'

import { useRef, useState } from 'react'
import styles from './local-backup.module.css'

type Candidate={path:string;status:string;allowed:boolean;reasonCode:string|null}
type Repository={branch:string;head:string;remoteAlias:string;target:{host:string|null;repositoryPath:string}}
type Preview={previewId:string;operationId:string;preview:{revision:number;repository:Repository;selected:{path:string;sizeBytes:number;expectedOid:string|null}[];expectedChanges:{path:string;newOid:string|null;newMode:string}[]}}
type Phase={status:string;startedAtUtc?:string;finishedAtUtc?:string;elapsedMs?:number;commitSha?:string|null}
type Operation={operationId:string;status:string;failureCode:string|null;commit:Phase;push:Phase;preparation:{status:string};selectedFiles:string[]}
const statusNames:Record<string,string>={not_started:'未开始',executing:'执行中 / 结果待核对',failed:'失败',unknown:'未知',created_unverified:'本地commit已形成，未核验',verified:'本地commit已核验',succeeded:'成功',push_failed:'推送失败（本地commit保留）',push_unknown:'远端结果未知（禁止自动重推）',preflight:'预检中',committing:'正在提交',pushing:'正在推送',commit_verified:'本地提交已核验，准备推送',operation_unknown:'操作结果未知，请核对保留的本地状态'}
const time=(value?:string)=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date(value)):'未知'
const reasons:Record<string,string>={git_filters_unsupported:'当前仓库存在尚未核验的Git过滤器，暂不能发布；未更改用户配置。',git_staged_changes_unsupported:'已有暂存内容，当前版本不支持此状态；请保留并先处理原有暂存。',git_hooks_unsupported:'存在未核验的用户Git hook，暂不能发布；未覆盖或禁用用户hook。',git_signing_unsupported:'当前交互签名配置尚未支持，暂不能发布。',git_preview_stale:'文件、HEAD或暂存索引已变化，请重新查看变更并核验预览。',git_existing_lock_or_operation:'已有Git锁或其他操作，未终止或清理。',git_commit_tree_conflict:'实际提交内容与预览不一致，已禁止推送，保留真实本地状态。'}
export function LocalBackupGitPanel(){
 const [repository,setRepository]=useState<Repository|null>(null),[candidates,setCandidates]=useState<Candidate[]>([]),[cursor,setCursor]=useState<string|null>(null)
 const [selected,setSelected]=useState<string[]>([]),[preview,setPreview]=useState<Preview|null>(null),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[operation,setOperation]=useState<Operation|null>(null),[pendingId,setPendingId]=useState<string|null>(null)
 const [workRecording,setWorkRecording]=useState<{recorded:boolean;reasonCode?:string}|null>(null)
 const csrf=useRef<string|null>(null),idempotency=useRef<string|null>(null)
 async function read(url:string,options:RequestInit={}){
  const r=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(70000)}),json=await r.json()
  if(!r.ok)throw new Error(json.reasonCode??json.errorCode??'git_request_failed')
  return json
 }
 async function post(url:string,value:object){
  const session=await read('/api/ai-console/control/session');csrf.current=session.csrfToken
  if(typeof csrf.current!=='string')throw new Error('operator_session_unavailable')
  return read(url,{method:'POST',headers:{'Content-Type':'application/json','x-ai-console-csrf':csrf.current},body:JSON.stringify(value)})
 }
 async function discover(next:string|null=null){
  setBusy(true);setError('');setPreview(null);setConfirmed(false);setOperation(null);setPendingId(null);setWorkRecording(null);idempotency.current=null
  if(!next)setSelected([])
  try{const value=await post(`/api/local-backup/git/preview?limit=20${next?`&cursor=${encodeURIComponent(next)}`:''}`,{files:[]});setRepository(value.repository);setCandidates(current=>next?[...current,...value.records]:value.records);setCursor(value.nextCursor)}catch(e){setError(e instanceof Error?e.message:'git_preview_failed')}finally{setBusy(false)}
 }
 async function createPreview(){
  setBusy(true);setError('');setPreview(null);setConfirmed(false);setOperation(null);setPendingId(null);setWorkRecording(null);idempotency.current=null
  try{const value=await post('/api/local-backup/git/preview',{files:selected});setPreview(value);setRepository(value.preview.repository);setPendingId(value.operationId)}catch(e){setError(e instanceof Error?e.message:'git_preview_failed')}finally{setBusy(false)}
 }
 async function publish(){
  if(!preview||!confirmed)return
  setBusy(true);setError('');idempotency.current??=crypto.randomUUID()
  try{const value=await post('/api/local-backup/git/publish',{previewId:preview.previewId,expectedRevision:preview.preview.revision,idempotencyKey:idempotency.current,message});setOperation(value.operation);setWorkRecording(value.workRecording??null)}catch(e){setError(e instanceof Error?e.message:'git_publish_result_unknown')}finally{setBusy(false);setConfirmed(false)}
 }
 async function checkOperation(){
  if(!pendingId)return;setBusy(true);setError('')
  try{const value=await read(`/api/local-backup/git/operations/${pendingId}`);setOperation(value.operation)}catch(e){setError(e instanceof Error?e.message:'git_operation_query_failed')}finally{setBusy(false)}
 }
 return <section id="git" aria-labelledby="git-title" className={styles.section}>
  <div className={styles.sectionTitle}><h2 id="git-title">Git代码版本提交</h2><span className={styles.badge}>先核验，再发布</span></div>
  <p>先查看变更、选择精确文件并核对预览，再明确提交和推送。代码版本上传与网络盘全量备份分别记录。</p>
  <p>默认不选择文件；秘密、运行记录、原图、模型及未登记的数据不在代码发布范围内。失败不自动修复、回滚或重推。</p>
  <button disabled={busy} onClick={()=>discover()}>查看代码变更</button>
  {repository&&<p>仓库：{repository.target.host}/{repository.target.repositoryPath} · 分支：<strong>{repository.branch}</strong> · 远端：{repository.remoteAlias}<br/>基准HEAD：<code>{repository.head}</code></p>}
  {candidates.length>0&&<fieldset disabled={busy||operation!==null} style={{border:'1px solid var(--console-line)',margin:'16px 0',padding:14}}><legend>选择要提交的文件（最多32项）</legend>{candidates.map(c=><label key={c.path} style={{display:'flex',gap:10,alignItems:'flex-start',margin:'8px 0'}}><input type="checkbox" checked={selected.includes(c.path)} disabled={!c.allowed||(!selected.includes(c.path)&&selected.length>=32)} onChange={e=>{setSelected(current=>e.target.checked?[...current,c.path]:current.filter(x=>x!==c.path));setPreview(null);setConfirmed(false);setPendingId(null);idempotency.current=null}}/><span><code>{c.status} {c.path}</code>{!c.allowed&&<small> · 禁止发布：{c.reasonCode}</small>}</span></label>)}</fieldset>}
  {cursor&&<button disabled={busy} onClick={()=>discover(cursor)}>加载更多变更</button>}
  {candidates.length>0&&<p><button disabled={busy||selected.length===0||operation!==null} onClick={createPreview}>核验所选文件预览（{selected.length}）</button></p>}
  {preview&&<div style={{borderLeft:'3px solid var(--console-warning)',padding:16,background:'#fffaf0'}}><h3>精确提交预览</h3><p>目标：{preview.preview.repository.target.host}/{preview.preview.repository.target.repositoryPath} · {preview.preview.repository.branch}</p><ul>{preview.preview.selected.map(x=><li key={x.path}><code>{x.path}</code> · {x.sizeBytes.toLocaleString()}字节 · {x.expectedOid?'已核验Git属性转换后的内容':'删除'}</li>)}</ul>
    <label style={{display:'block'}}>提交说明<input style={{display:'block',width:'100%',boxSizing:'border-box'}} value={message} maxLength={2000} disabled={busy||operation!==null} onChange={e=>{setMessage(e.target.value);setConfirmed(false)}}/></label>
    <label style={{display:'flex',gap:10,margin:'14px 0'}}><input type="checkbox" checked={confirmed} disabled={busy||operation!==null} onChange={e=>setConfirmed(e.target.checked)}/>我已核对所选文件、仓库与现有分支，确认创建本地commit并推送这个commit。</label>
    <button disabled={busy||!confirmed||!message.trim()||operation!==null} onClick={publish}>提交并推送所选代码</button>
  </div>}
  {busy&&<p role="status">正在核验或执行，请等待；重复请求不会创建第二次提交。</p>}
  {error&&<p role="alert" style={{color:'var(--console-danger)'}}>Git操作未完成：{reasons[error]??error}。若已发起发布，请先核对已保存结果。</p>}
  {pendingId&&<p><button disabled={busy} onClick={checkOperation}>只读核对这次操作结果</button></p>}
  {workRecording&&<p>{workRecording.recorded?'本次程序结果已写入工作台账。':'Git结果已保存，工作台账入账尚未确认；不会因此重试提交或推送。'}</p>}
  {operation&&<div aria-live="polite"><h3>本次状态：{statusNames[operation.status]??operation.status}</h3><p>提交：{statusNames[operation.commit.status]??operation.commit.status} · 推送：{statusNames[operation.push.status]??operation.push.status}</p><p>本地commit：<code>{operation.commit.commitSha??'尚无已记录commit'}</code></p><p>提交开始 {time(operation.commit.startedAtUtc)} / 结束 {time(operation.commit.finishedAtUtc)} / 耗时 {operation.commit.elapsedMs??'未知'} ms</p><p>推送开始 {time(operation.push.startedAtUtc)} / 结束 {time(operation.push.finishedAtUtc)} / 耗时 {operation.push.elapsedMs??'未知'} ms</p>{operation.failureCode&&<p>原因：{operation.failureCode}。本地已形成的commit及暂存状态保持，不自动恢复或重推。</p>}<details><summary>操作身份与文件</summary><code>{operation.operationId}</code><ul>{operation.selectedFiles.map(file=><li key={file}>{file}</li>)}</ul></details></div>}
 </section>
}
