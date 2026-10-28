import Link from 'next/link'
import type {ProgressProjection,ProgressEvidence} from './progress-types'
import styles from './progress.module.css'

export function EvidenceLinks({evidence}:{evidence:ProgressEvidence[]}){
 return <ul className={styles.evidenceLinks}>{evidence.map(item=><li key={item.id}><span>{item.title}</span>{item.href&&<Link href={item.href}>已登记工作详情 ↗</Link>}<details><summary>核验来源与摘要</summary><code>{item.path}</code><code>SHA-256 {item.sha256}</code></details></li>)}</ul>
}
export function ProgressExplanation({data}:{data:ProgressProjection}){
 return <div><div className={styles.viewIntro}><span className={styles.eyebrow}>CODEX · 外部综合说明</span><h3>情况说明</h3><p>基于本次绑定文件整理，不是本地 AI 自主诊断，不改变正式计划、裁决或执行权限。</p></div><div className={styles.notes}>{data.notes.map(note=><article key={note.title}><h4>{note.title}</h4><p>{note.body}</p><EvidenceLinks evidence={data.evidence.filter(e=>note.evidenceIds.includes(e.id))}/></article>)}</div><p className={styles.caption}>完整执行流水保留在下方工作记录和独立详情中；刷新只重读固定记录。</p></div>
}
