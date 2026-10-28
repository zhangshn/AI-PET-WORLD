import Link from 'next/link'
import type {ProgressProjection} from './progress-types'
import styles from './progress.module.css'

export function ProgressPlan({data}:{data:ProgressProjection}){
 return <div><div className={styles.viewIntro}><span className={styles.eyebrow}>唯一指南的只读投影</span><h3>总计划</h3><p>模块目标、现有声明和验收条件直接读取正式指南。以下不是新的排期或完成认定。</p></div>
 <div className={styles.planList}>{data.plan.modules.map(module=><details key={module.id} className={styles.planItem}><summary><span className={styles.moduleNumber}>{module.id.padStart(2,'0')}</span><strong>{module.title}</strong>{module.deferred&&<span className={styles.deferred}>后置衔接范围</span>}<span className={styles.expand}>展开</span></summary><div className={styles.planBody}><h4>具体交付任务</h4>{data.workPlan?.modules.find(m=>m.id===module.id)?.items.map(item=><details key={item.id}><summary>{item.title}</summary><p>交付物：{item.deliverable}</p><p>完成条件：{item.doneWhen}</p><p>依赖：{item.dependsOn.join('、')||'无额外前置任务'}</p></details>)}<h4>模块目标</h4><p>{module.goal}</p><h4>指南中的阶段声明 · 文档原文，非实时事实</h4><p>{module.declaredState}</p><h4>验收条件 / 依赖</h4><p>{module.acceptance}</p><p className={styles.caption}>关联先行链环节：{data.stages.filter(s=>s.moduleIds.includes(module.id)).map(s=>s.title).join('、')||'不属于当前自然世界先行链'}。状态以各环节绑定证据为准。</p></div></details>)}</div>
 <div className={styles.sourceBox}><strong>计划原件</strong><code>{data.plan.path}</code><span>实际字节 SHA-256</span><code>{data.plan.sha256}</code><Link href="/local-backup/documents">在相关文档中查阅原文 ↗</Link></div></div>
}
