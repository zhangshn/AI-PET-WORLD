import type {ProgressStage,ProgressProjection} from './progress-types'
import styles from './progress.module.css'

function StateMark({status}:{status:ProgressStage['status']}){
 return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.stateMark}><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".12"/>{status==='component_verified'?<path d="m7.5 12 3 3 6-6"/>:status==='blocked'?<><path d="M12 6v7"/><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none"/></>:<path d="M8 12h8"/>}</svg>
}
export function ProgressFlow({stages,counts,onSelect,selected}:{stages:ProgressStage[];counts:ProgressProjection['counts'];onSelect:(id:string)=>void;selected:string}){
 return <><div className={styles.counts} aria-label="当前先行切片的环节状态计数">{Object.entries(counts).map(([id,item])=><div key={id} className={styles[id]}><span className={styles.countDot}/><strong>{item.count}</strong><span>{item.label}<small>个环节 · 非总体完成率</small></span></div>)}</div>
 <div className={styles.flowHeading}><h3>自然世界先行链</h3><span>8 个核对环节 · 点击查看依据</span></div>
 <ol className={styles.flow} aria-label="自然世界阶段流程与状态">{stages.map((stage,index)=><li key={stage.id} className={styles[stage.status]}><button type="button" aria-pressed={stage.id===selected} aria-controls="progress-stage-detail" onClick={()=>onSelect(stage.id)}><span className={styles.flowTop}><span className={styles.sequence}>{String(index+1).padStart(2,'0')}</span><StateMark status={stage.status}/></span><strong>{stage.title}</strong><span className={styles.status}>{stage.statusLabel}</span><span className={styles.flowSummary}>{stage.summary}</span></button></li>)}</ol>
 <p className={styles.caption}>流程表示责任衔接；存档可独立核验。单个组件通过不代表前序、正式发布或世界闭环已通过。</p></>
}
