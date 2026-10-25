'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PageValues } from '../documents/document-types'
import { useCatalog } from '../documents/use-catalog'
import { catalogUrl } from '../documents/catalog-navigation'
import { DiagramDetail } from './diagram-detail'
import { DiagramCoverage } from './diagram-coverage'
import type { ArchitecturePage } from './diagram-types'
import library from '../documents/documents.module.css'
import styles from './diagrams.module.css'

export function DiagramsBrowser({values}:{values:PageValues}){
 const router=useRouter(),[search,setSearch]=useState(values.q??''),params=new URLSearchParams()
 for(const k of ['type','q','documentId','level','module','cursor'])if(values[k])params.set(k,values[k]!)
 const {data,error}=useCatalog<ArchitecturePage>('/api/local-backup/diagrams?'+params),navigate=(changes:PageValues)=>router.push(catalogUrl('/local-backup/diagrams',values,changes))
 const label=(kind:'levels'|'modules',id:string)=>data?.[kind].find(g=>g.id===id)?.label??id
 return <><div className={library.banner}><div><span className={library.kicker}>分层架构资料库</span><h2>业务、系统与每个子系统</h2><p>按层级和功能查阅已有图源。紫微资料分层、分析链与动态盘继承保留原文；图源存在不表示已实现。</p><Link href="/local-backup/business-map">打开单张业务全景图 ↗</Link></div><strong>{data?.knownRecordCount??'—'}<small>项匹配图源</small></strong></div>
 <nav className={styles.levels} aria-label="架构层级"><button aria-pressed={!values.level} onClick={()=>navigate({level:undefined,cursor:undefined,id:undefined})}>全部层级</button>{data?.levels.map(g=><button key={g.id} aria-pressed={values.level===g.id} onClick={()=>navigate({level:g.id,cursor:undefined,id:undefined})}>{g.label}<span>{g.count}</span></button>)}</nav>
 <form className={library.filters} onSubmit={e=>{e.preventDefault();navigate({q:search,cursor:undefined,id:undefined})}}><label>搜索图名、章节与来源<input value={search} maxLength={160} onChange={e=>setSearch(e.target.value)}/></label><label>功能子系统<select value={values.module??''} onChange={e=>navigate({module:e.target.value,cursor:undefined,id:undefined})}><option value="">全部功能</option>{data?.modules.map(g=><option key={g.id} value={g.id}>{g.label} · {g.count}</option>)}</select></label><label>图源格式<select value={values.type??''} onChange={e=>navigate({type:e.target.value,cursor:undefined,id:undefined})}><option value="">全部格式</option><option value="mermaid">Mermaid 架构图</option><option value="text">文本流程 / 结构树</option></select></label><button>检索</button></form>
 <DiagramCoverage coverage={data?.coverage}/>{error&&<p role="alert" className={styles.error}>目录查询失败：{error}。<Link href="/local-backup/diagrams">重新读取目录</Link></p>}
 <div className={library.layout}><section className={library.catalog} aria-label="分层设计图目录"><div className={library.catalogHeading}><h3>{values.module?label('modules',values.module):'已有设计图'}</h3><span>{data?.knownRecordCount??'—'} 项</span></div>{data?.records.map(d=><Link className={library.catalogItem} aria-current={values.id===d.diagramId?'true':undefined} href={catalogUrl('/local-backup/diagrams',values,{id:d.diagramId})} key={d.diagramId}><span>{label('levels',d.level)} / {label('modules',d.module)} · {d.sourceLanguage}</span><h3>{d.title}</h3><p>{d.documentVersion??'版本未记录'} · 程序采用 {d.programAdoptionStatus??'未知'}</p><small>{d.relativePath} · L{d.startLine}</small></Link>)}{!data&&!error&&<p role="status">读取分层目录…</p>}{data?.records.length===0&&<p>当前条件没有已有图源；请查阅来源覆盖和缺图说明。</p>}<nav className={library.paging} aria-label="设计图分页"><button disabled={!data?.previousCursor} onClick={()=>navigate({cursor:data?.previousCursor??undefined,id:undefined})}>上一页</button><button disabled={!data?.nextCursor} onClick={()=>navigate({cursor:data?.nextCursor??undefined,id:undefined})}>下一页</button></nav></section><section className={library.reader}>{values.id?<DiagramDetail key={values.id} id={values.id}/>:<div className={library.placeholder}><span>已有设计 / 单图查看</span><h2>选择一个业务或子系统</h2><p>在层级和功能中定位架构、流程或结构树。选定后可放大、平移、适配、还原及全屏查看；缺图不补造，实现未知不升级。</p><Link href="/local-backup/business-map">先看全业务关系 ↗</Link></div>}</section></div></>
}
