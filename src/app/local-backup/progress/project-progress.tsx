'use client'
import {useEffect,useState,type KeyboardEvent} from 'react'
import {useProjectProgress} from './use-project-progress'
import {WorkPlanProgress} from './work-plan-progress'
import {MvpProgress} from './mvp-progress'
import {time} from '../local-backup-shared'
import {ProgressFlow} from './progress-flow'
import {ProgressPlan} from './progress-plan'
import {EvidenceLinks,ProgressExplanation} from './progress-explanation'
import styles from './progress.module.css'

const views=[{id:'plan',label:'总计划'},{id:'progress',label:'进度'},{id:'explanation',label:'情况说明'}] as const
type View=typeof views[number]['id']
const failures:Record<string,string>={progress_fixed_source_missing:'固定快照或证据文件缺失',progress_plan_sha_conflict:'指南修订已变化，与快照摘要不一致',progress_evidence_sha_conflict:'证据实际字节与快照摘要冲突',progress_unknown_producer:'快照生产者不在登记范围',progress_json_invalid:'快照或证据不是有效 JSON',progress_path_boundary:'文件真实路径越过受限边界',progress_snapshot_stale:'静态快照已超过新鲜度范围'}
export function ProjectProgressPanel(){
 const [view,setView]=useState<View>('progress'),[selected,setSelected]=useState('native-compute'),result=useProjectProgress(),data=result.data?.projection
 useEffect(()=>{const follow=()=>{if(window.location.hash==='#journal'||window.location.hash==='#project-progress')window.document?.getElementById('project-progress')?.scrollIntoView({block:'start'})};follow();window.addEventListener('hashchange',follow);return()=>window.removeEventListener('hashchange',follow)},[])
 function moveTab(event:KeyboardEvent<HTMLButtonElement>,index:number){
  const next=event.key==='ArrowRight'?(index+1)%views.length:event.key==='ArrowLeft'?(index+views.length-1)%views.length:event.key==='Home'?0:event.key==='End'?views.length-1:null
  if(next===null)return;event.preventDefault();setView(views[next].id);const tabs=event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');tabs?.[next]?.focus()
 }
 const stage=data?.stages.find(s=>s.id===selected)??data?.stages[0]
 return <section className={styles.panel} id="project-progress" aria-labelledby="project-progress-heading"><header className={styles.hero}><div><span className={styles.eyebrow}>全项目 · 计划与交付进度</span><h2 id="project-progress-heading">项目进度</h2><p>按建设模块查看具体任务、完成内容与剩余工作。</p></div><div className={styles.heroActions}><span className={styles.snapshotBadge}>固定证据 · 15秒只读刷新</span><button type="button" disabled={result.busy} aria-busy={result.busy} onClick={()=>{void result.refresh()}}>重新读取 <span aria-hidden="true">↻</span></button></div></header>
 <div className={styles.content}>{result.error&&<div role="alert" className={styles.error}><strong>连接错误 · 进度读取失败</strong><p>{failures[result.error]??'固定来源读取或身份校验失败'}。{data?'下方保留上次成功读取的结果，已陈旧，不能当作最新。':'没有可用证据时不显示通过或百分比。'}</p><code>{result.error}</code></div>}{!data&&!result.error&&<p role="status" className={styles.loading}>正在核对48项清单、计划修订与绑定证据…</p>}
 {data&&<><div className={styles.snapshotLine}><p>静态说明快照核验于 <time dateTime={data.verifiedAtUtc}>{time(data.verifiedAtUtc)}</time><span>北京时间 · 非实时说明</span></p><span>Codex 外部整理 · {data.evidence.length} 份固定记录 · {result.paused?'后台暂停':result.busy?'读取中':'前台每15秒刷新'}</span></div>{data.stale&&<p role="alert" className={styles.notice}>快照已陈旧：超过 {data.staleAfterHours} 小时。下列是历史核验结论，不能代表当前运行；重新读取不会自动更新说明快照。</p>}
 <div className={styles.responsibilities} aria-label="唯一计划中的三类职责"><span><b>模块 2</b> 模型视觉</span><span><b>模块 3</b> 本地确定流程</span><span><b>模块 7</b> 世界 Runtime 与存档</span></div>
 <nav role="tablist" aria-label="项目进度视图" className={styles.tabs}>{views.map((item,index)=><button type="button" key={item.id} role="tab" id={'progress-tab-'+item.id} aria-selected={view===item.id} aria-controls={'progress-view-'+item.id} tabIndex={view===item.id?0:-1} onClick={()=>setView(item.id)} onKeyDown={event=>moveTab(event,index)}>{item.label}</button>)}</nav>
 <div role="tabpanel" id={'progress-view-'+view} aria-labelledby={'progress-tab-'+view} tabIndex={0} className={styles.view}>
 {view==='plan'&&<ProgressPlan data={data}/>}
 {view==='progress'&&<><WorkPlanProgress plan={data.workPlan}/><details className={styles.naturalScope}><summary>产品功能验收 · 12个大类<span>点击查看各块已实现内容与验收缺口</span></summary><MvpProgress data={data} connectionError={!!result.error}/></details><details className={styles.naturalScope}><summary>自然世界先行切片 · 8环节（子范围）<span>展开流程与限定结果</span></summary><ProgressFlow stages={data.stages} counts={data.counts} selected={stage?.id??''} onSelect={setSelected}/>{stage&&<article id="progress-stage-detail" className={styles.stageDetail} aria-live="polite"><div><span className={styles.eyebrow}>当前选中环节</span><h3>{stage.title}</h3><span className={`${styles.status} ${styles[stage.status]}`}>{stage.statusLabel}</span></div><p>{stage.detail}</p><EvidenceLinks evidence={data.evidence.filter(e=>stage.evidenceIds.includes(e.id))}/>{!stage.evidenceComplete&&<p className={styles.notice}>该环节证据未完整绑定，状态保持未验证。</p>}</article>}
 <div className={styles.distinctions} aria-label="分别核对的结果边界"><h3>这些结果分别成立</h3><dl><div><dt>历史训练 · 095</dt><dd>{data.distinctions.historicalTraining?`已结束 ${data.distinctions.historicalTraining.optimizerSteps.generator} 对 G / D 更新`:'证据未绑定'}</dd><small>历史候选已拒绝；不代表原生完整训练通过</small></div><div><dt>原生梯度 · 130</dt><dd>{data.distinctions.nativeGradient?`${data.distinctions.nativeGradient.completed} / ${data.distinctions.nativeGradient.attempted} 项完成`:'证据未绑定'}</dd><small>这是单次梯度观察，非项目完成率</small></div><div><dt>正式画质 / 发布</dt><dd>{data.distinctions.formalQuality==='not_qualified'?'尚未取得资格':'未知'} · {data.distinctions.framePublication==='not_published'?'帧未发布':'未知'}</dd><small>已有原生出图与代理检查不替代语义审核</small></div><div><dt>/world 完整闭环</dt><dd>{data.distinctions.worldLoop==='not_accepted'?'尚未验收':'未知'}</dd><small>模型演化、历史参与与无会话推进待核验</small></div></dl></div></details></>}
 {view==='explanation'&&<ProgressExplanation data={data}/>}</div><footer className={styles.footer}><span>计划任务进度与产品验收分别核对</span><span>读取于 {time(data.readAtUtc)} · 只读</span></footer></>}
 </div></section>
}
