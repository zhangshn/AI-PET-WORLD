'use client'
import Link from 'next/link'
import { useCatalog } from '../documents/use-catalog'
import { DiagramDetail } from '../diagrams/diagram-detail'
import type { ArchitecturePage } from '../diagrams/diagram-types'
import { businessMapSection, selectBusinessMap } from './business-map-binding'
import styles from './business-map.module.css'

export function BusinessMapView(){
 const search=new URLSearchParams({documentId:'docs-architecture',type:'mermaid',q:businessMapSection,limit:'20'})
 const {data,error}=useCatalog<ArchitecturePage>('/api/local-backup/diagrams?'+search)
 const bound=data?selectBusinessMap(data.records,data.knownRecordCount,data.nextCursor):null
 return <><section className={styles.intro}><span>ONE BUSINESS MAP / 正式原图</span><h2>一张图看清业务与支撑关系</h2><p>用户与人格、类地球世界、本地视觉能力及编排运维，来自总体架构 2.1 的唯一正式图源。</p><p className={styles.notice}>图中节点是规范职责，不能视为已实现或已验收。真实进度与资格另查唯一计划及机器证据，未记录的实现状态保持未知。</p><div><Link href="/local-backup/diagrams">深入查看系统与子系统架构 ↗</Link><Link href="/local-backup/documents?id=docs-game-world-generation-current-execution-guide-20260710">查看唯一模块计划 ↗</Link></div></section>
 <section className={styles.map} aria-label="单张正式业务全景">{error?<p role="alert" className={styles.error}>业务全景来源不可用：{error}。没有回退到其他图。</p>:!data?<p role="status">核对总体架构正式图源…</p>:!bound?<p role="alert" className={styles.error}>business_map_binding_conflict：指定章节不存在或不是唯一 Mermaid，未拼造或回退主线图。</p>:<DiagramDetail key={bound.diagramId} id={bound.diagramId} expectedSection={businessMapSection}/>}</section><p className={styles.footer}>本页只读、不调度运行。五维性格为未来退役方向；紫微资料解释、人格映射、自主行为各守边界，本次不建设人格算法或八字后备链。</p></>
}
