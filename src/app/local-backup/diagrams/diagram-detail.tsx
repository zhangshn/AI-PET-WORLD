'use client'
import Link from 'next/link'
import { useCatalog } from '../documents/use-catalog'
import { headingSlug } from '../documents/document-links'
import { DiagramViewer } from './diagram-viewer'
import type { ArchitectureBody } from './diagram-types'
import styles from './diagrams.module.css'
export function DiagramDetail({id,expectedSection}:{id:string;expectedSection?:string}){
 const {data,error}=useCatalog<{diagram:ArchitectureBody}>('/api/local-backup/diagrams/'+encodeURIComponent(id)),diagram=data?.diagram
 if(error)return <p role="alert" className={styles.error}>图源不可用：{error}。来源变化后请重新选择。</p>
 if(!diagram)return <p role="status">读取精确图源…</p>
 if(expectedSection&&(diagram.documentId!=='docs-architecture'||diagram.section!==expectedSection||diagram.type!=='mermaid'))return <p role="alert" className={styles.error}>业务全景正式来源绑定冲突，未回退到其他图。</p>
 return <><header className={styles.header}><span className={styles.kicker}>现有图源 · {diagram.sourceFormat}</span><h2>{diagram.title}</h2><p>{diagram.documentVersion??'版本未记录，使用实际源文档摘要'} · 规范职责不等于实现完成。</p><p>权威：{diagram.authorityStatus??'未知'}<br/>程序采用：{diagram.programAdoptionStatus??'未声明，保持未知'}</p><Link href={'/local-backup/documents?'+new URLSearchParams({id:diagram.documentId,anchor:headingSlug(diagram.section)})}>查看来源章节 ↗</Link><p className={styles.digest}>{diagram.relativePath} · 第 {diagram.startLine}–{diagram.endLine} 行<br/>SHA-256：{diagram.sourceDocumentSha256}</p></header><DiagramViewer key={id} diagram={diagram}/></>
}
