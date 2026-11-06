import Link from 'next/link'
import type {WorkPlanProjection} from './progress-types'
import styles from './current-delivery.module.css'
import {CommittedWeatherDays} from './current-delivery-weather'
import {WorldEvolutionVisual} from './world-evolution-visual'
import {RelatedWorkRecords} from '../work/related-work-records'
import {CurrentNativeTraining} from './current-native-training'

const componentLabels={completed:'组件交付已核验',not_completed:'组件条件未满足',unverified:'组件证据待核验'}
export function CurrentDelivery({plan,compact=false}:{plan?:WorkPlanProjection;compact?:boolean}){
 const delivery=plan?.currentDelivery;if(!delivery)return null
 const head=delivery.worldBaseline.currentHead
 const excludedSources=delivery.worldBaseline.readCoverage?.excludedLargeSourceRefs
 const progress=new Map((plan?.modules??[]).flatMap(module=>module.items).map(item=>[item.id,item]))
 return <section className={styles.delivery} id={compact?undefined:'current-delivery'} aria-label="当前世界交付详细计划"><header className={styles.header}><span>当前交付 · 世界基线</span><h3>{delivery.title}</h3><p>{delivery.objective}</p></header><div className={styles.binding} style={{overflowWrap:'anywhere'}}><strong>{delivery.worldBaseline.label}</strong><p>{delivery.worldBaseline.reason}</p><span>本轮worldId：{delivery.worldBaseline.worldId??(delivery.worldBaseline.status==='not_registered'?'尚未登记':'不可核验')} · 本轮完成比例：不以部分基线计算完成比例</span>
 {delivery.worldBaseline.reasonCode&&<p>核验原因：{delivery.worldBaseline.reasonCode}</p>}
 {delivery.worldBaseline.identity&&<><p>区域：{delivery.worldBaseline.identity.regionId} · 世界种子：{delivery.worldBaseline.identity.worldSeed}</p><p>身份范围：本地MVP交付命名空间；不代表公共玩家账号已获访问资格。</p></>}
 {delivery.worldBaseline.counts&&<p>实际内容：地形区域 {delivery.worldBaseline.counts.terrainRegionCount}；对象 {delivery.worldBaseline.counts.objectCount}；可走区域 {delivery.worldBaseline.counts.walkableRegionCount}；碰撞区域 {delivery.worldBaseline.counts.collisionRegionCount}；条件 {delivery.worldBaseline.counts.conditionChannelCount} 通道。</p>}
 {delivery.worldBaseline.store&&<p>初创存档与独立读回：tick {delivery.worldBaseline.store.tick} · 状态版本 {delivery.worldBaseline.store.stateVersion} · 事件游标 {delivery.worldBaseline.store.eventCursor}；存档身份与摘要一致。</p>}
 {delivery.worldBaseline.timing&&<p>机器独立读回时间：{delivery.worldBaseline.timing.readbackAtUtc}（UTC）。本次平台读取：{delivery.worldBaseline.readAtUtc}（UTC）。</p>}
 {delivery.worldBaseline.status==='baseline_verified'&&!head&&<p>初创时模型绘图：未执行；正式画面：未发布；正式世界演化：未接入。</p>}
 {delivery.worldBaseline.readVerification&&<p>{delivery.worldBaseline.readVerification}</p>}
 {delivery.worldBaseline.readCoverage?.rawSourceBytesRehashed===false&&<p>本次GET未重读大栅格原件：{delivery.worldBaseline.readCoverage.excludedLargeSourceRefs?.length??'数量未提供'} 个；来源原件变化须由新的完整机器核验发现，本页不能据此断言大栅格当前字节未变化。</p>}
 {excludedSources&&excludedSources.length>0&&<details><summary>查看本次未重读的大栅格引用</summary><ul>{excludedSources.map(ref=><li key={ref.path}><p>{ref.path}</p><p>原记录字节数：{ref.bytes} · 原记录SHA-256：{ref.sha256}</p></li>)}</ul></details>}
 {head&&<CommittedWeatherDays head={head}/>}
 {delivery.worldBaseline.proofRef&&<details><summary>查看本轮机器证据绑定</summary><p>运行：{delivery.worldBaseline.runId}</p><p>{delivery.worldBaseline.proofRef.path}</p><p>SHA-256：{delivery.worldBaseline.proofRef.sha256}</p><p>平台读取：{delivery.worldBaseline.readAtUtc}</p>{head&&<><h5>当前服务器存档（{head.tick>1?'滚动天气演化后':head.kind==='evolution'?'首次天气演化后':'天气初始化后'}）</h5><p>世界步数 {head.tick} · 状态版本 {head.stateVersion} · 事件游标 {head.eventCursor}</p><p>逻辑时间：{head.logicalEndUtc}</p><p>当前存档 SHA-256：{head.fileSha256}</p><p>{head.kind==='evolution'?'演化':'维护'}事件 SHA-256：{head.eventSha256}</p><p>事务业务键：{head.businessKey}</p><p>提交回执 SHA-256：{head.receiptSha256}</p><p>事务日志 SHA-256：{head.journalSha256}</p></>}</details>}</div>
 <CurrentNativeTraining data={delivery.nativeTraining}/>
 {!compact&&<RelatedWorkRecords/>}
 <WorldEvolutionVisual data={delivery.worldEvolution} compact={compact}/>
 {compact?<><ol className={styles.outline}>{delivery.steps.map(step=><li key={step.id}>{step.title}</li>)}</ol><nav className={styles.links}><Link href="/local-backup/work#current-delivery">查看四步骤详细计划 ↗</Link><Link href={delivery.diagram.href}>查看同一世界关系图 ↗</Link></nav></>:<>
 <div className={styles.scope}><section><h4>本次要完成</h4><ul>{delivery.scope.map((s,i)=><li key={i}>{s}</li>)}</ul></section><section><h4>本次不包含</h4><ul>{delivery.nonGoals.map((s,i)=><li key={i}>{s}</li>)}</ul></section></div>
 <h4 className={styles.stepsHeading}>四步骤详细内容</h4><ol className={styles.steps}>{delivery.steps.map((step,index)=><li key={step.id}><details open={index===0}><summary><span>{String(index+1).padStart(2,'0')}</span><h4>{step.title}</h4><small>展开动作、产物与完成条件</small></summary><div className={styles.stepBody}><h5>具体动作</h5><ol>{step.actions.map((action,i)=><li key={i}>{action}</li>)}</ol><div className={styles.results}><section><h5>应交付的内容</h5><p>{step.deliverable}</p></section><section><h5>完成条件</h5><p>{step.doneWhen}</p></section></div><details className={styles.components}><summary>关联原计划工作项 · 仅表示已有组件情况</summary><p>下列状态不能替代本轮选定世界的逐步验收。</p>{plan?.reasonCode&&<p className={styles.unavailable}>组件进度当前不可核验：{plan.reasonCode}。正式步骤仍可查阅。</p>}<ul>{step.planItems.map(item=>{const state=progress.get(item.id);return <li key={item.id}><strong>{item.title}</strong><span>{state?componentLabels[state.status]:'组件状态未接入'}</span><p>原交付条件：{item.doneWhen}</p>{state&&<><p>已核验内容：{state.completedParts.join('；')||'暂无足够证据'}</p><p>剩余条件：{state.remainingParts.join('；')||'本组件条件已满足，本轮同一世界仍须独立验证'}</p><p>核验：{state.verifiedAtUtc??'原记录未提供'}</p></>}<code>{item.id}</code></li>})}</ul></details></div></details></li>)}</ol>
 <section className={styles.next}><h4>完成基线后的后继关系</h4><ol>{delivery.next.map((item,i)=><li key={i}>{item}</li>)}</ol><p>基线、持续世界运行和完整MVP分别验收，图中节点不表示已经实现。</p></section>
 <section className={styles.references}><h4>相关文档与业务关系图</h4><div>{delivery.documents.map(document=><Link key={document.path} href={document.href}><strong>{document.label}</strong><span>原文条款：{document.section}</span></Link>)}</div><Link className={styles.diagramLink} href={delivery.diagram.href}>打开正式关系图：{delivery.diagram.section} ↗</Link><p>文档和图均打开已登记原件，详情页显示实际版本与SHA；不另存业务图或文档副本。</p></section><nav className={styles.links}><Link href="/local-backup">返回数据管理总览</Link><Link href="/local-backup/work#project-progress">查看完整计划与组件进度</Link></nav><details className={styles.source}><summary>当前计划原件与读取时点</summary><p>{delivery.planSource.path}</p><p>版本 {delivery.planSource.version} · 读取 {delivery.planSource.readAtUtc}</p><code>SHA-256 {delivery.planSource.sha256}</code></details>
 </>}
 </section>
}
