import Link from 'next/link'
import type { ArchitecturePage } from './diagram-types'
import styles from './diagrams.module.css'
export function DiagramCoverage({coverage}:{coverage:ArchitecturePage['coverage']|undefined}){
 if(!coverage)return null
 return <details className={styles.coverage}><summary>来源覆盖、缺图与未定义内容</summary><div className={styles.coverageGrid}><section><h3>已有图源</h3><p>仅已登记来源，不推定全部功能已实现。</p>{coverage.existingSources.map(s=><p key={s.relativePath}><code>{s.relativePath}</code> · {s.count} 项 · {s.version??'版本未记录'}</p>)}</section><section><h3>有文字定义，缺独立图</h3>{coverage.textDefinitionsWithoutDiagram.map(s=><p key={s.topic}><strong>{s.topic}</strong><br/>{s.section}<br/><Link href={'/local-backup/documents?id='+s.document.documentId}>查看定义原文 ↗</Link></p>)}</section><section><h3>尚缺设计定义</h3>{coverage.missingDesignDefinitions.map(s=><p key={s.topic}><strong>{s.topic}</strong><br/>{s.reason}<br/><Link href={'/local-backup/documents?id='+s.documentId}>查看边界说明 ↗</Link></p>)}<p>紫微资料与读盘解释、人格映射、自主行为是不同责任。控制台“五维字段”不属于性格退役对象。</p></section></div></details>
}
