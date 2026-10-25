'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CatalogPage, DocumentMeta, DocumentBody, PageValues } from './document-types'
import { useCatalog } from './use-catalog'
import { catalogUrl, categoryName } from './catalog-navigation'
import { DocumentContent } from './document-content'
import styles from './documents.module.css'

function DocumentReader({id,revision,links,anchor}:{id:string;revision?:string;links:{documentId:string;relativePath:string}[];anchor?:string}){
 const {data,error}=useCatalog<{document:DocumentBody}>('/api/local-backup/documents/'+encodeURIComponent(id)+(revision?'?revision='+encodeURIComponent(revision):''))
 return error?<p role="alert" className={styles.error}>文档无法读取：{error}。受限项不提供正文；来源修订变化时请返回目录重新选择。</p>:!data?<p role="status">正在读取选定文档…</p>:<><header className={styles.readerHeader}><span className={styles.kicker}>只读原件 · {data.document.historical?'历史退役':'现行文档'}</span><h2>{data.document.title}</h2><p>{data.document.version??'版本未记录'} · {data.document.bytes} bytes</p><p>权威状态：{data.document.authorityStatus??'未知'}<br/>程序采用：{data.document.programAdoptionStatus??'未声明，不能推定已实现'}</p><p className={styles.digest}>正文 SHA-256：{data.document.sha256}</p></header><DocumentContent document={data.document} links={links} anchor={anchor}/></>
}
export function DocumentsBrowser({values}:{values:PageValues}){
 const router=useRouter(),[search,setSearch]=useState(values.q??'')
 const params=new URLSearchParams();for(const k of ['category','status','q','cursor'])if(values[k])params.set(k,values[k]!)
 const {data,error}=useCatalog<CatalogPage<DocumentMeta>>('/api/local-backup/documents?'+params)
 const navigate=(changes:PageValues)=>router.push(catalogUrl('/local-backup/documents',values,changes))
 return <div className={styles.library}>
  <div className={styles.banner}><div><span className={styles.kicker}>项目知识库</span><h2>找到依据，再查看原文</h2><p>文档效力与程序实现分别呈现。视觉字典完整打印版仅索引，历史资料保留退役标识。</p></div><strong>{data?.registeredCount??'—'}<small>份已登记文档</small></strong></div>
  <form className={styles.filters} onSubmit={e=>{e.preventDefault();navigate({q:search,cursor:undefined,id:undefined,revision:undefined})}}><label>搜索标题与路径<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={160}/></label><label>分类<select value={values.category??''} onChange={e=>navigate({category:e.target.value,cursor:undefined,id:undefined,revision:undefined})}><option value="">全部分类</option>{data?.categories?.map(c=><option key={c} value={c}>{categoryName(c)}</option>)}</select></label><label>效力<select value={values.status??''} onChange={e=>navigate({status:e.target.value,cursor:undefined,id:undefined,revision:undefined})}><option value="">全部效力</option><option value="current">现行文档</option><option value="historical">退役历史</option><option value="restricted">受限索引</option></select></label><button>搜索</button></form>
  {error&&<p role="alert" className={styles.error}>目录查询失败：{error}。<Link href="/local-backup/documents">重新读取目录</Link></p>}
  <div className={styles.layout}><section className={styles.catalog} aria-label="文档目录"><div className={styles.catalogHeading}><h3>相关文档</h3><span>{data?.knownRecordCount??'—'} 项</span></div>{!data&&!error&&<p role="status">读取目录中…</p>}{data?.records.map(doc=><Link key={doc.documentId} href={catalogUrl('/local-backup/documents',values,{id:doc.documentId,revision:doc.metadataRevision??undefined,anchor:undefined})} aria-current={values.id===doc.documentId?'true':undefined} className={styles.catalogItem}><span>{categoryName(doc.category)} · {doc.historical?'历史退役':doc.restricted?'仅索引':'现行'}</span><h3>{doc.title}</h3><p>{doc.version??'版本未记录'} · {doc.availability==='unavailable'?'来源不可用':doc.bytes+' bytes'}</p><small>{doc.relativePath}</small></Link>)}{data?.records.length===0&&<p>当前条件没有已登记文档。</p>}<nav className={styles.paging} aria-label="文档分页"><button disabled={!data?.previousCursor} onClick={()=>navigate({cursor:data?.previousCursor??undefined,id:undefined,revision:undefined})}>上一页</button><button disabled={!data?.nextCursor} onClick={()=>navigate({cursor:data?.nextCursor??undefined,id:undefined,revision:undefined})}>下一页</button></nav></section>
  <section className={styles.reader}>{values.id?<><Link className={styles.back} href={catalogUrl('/local-backup/documents',values,{id:undefined,revision:undefined,anchor:undefined})}>← 返回目录</Link><DocumentReader key={values.id+values.revision} id={values.id} revision={values.revision} links={data?.links??[]} anchor={values.anchor}/></>:<div className={styles.placeholder}><span>01 / 文档原件</span><h2>选择一份文档开始阅读</h2><p>支持章节定位、表格和原始流程文本。内容来自固定登记原件，页面不会修改项目文档。</p><p>字典机器导出定位：<code>data/world-visual-data-dictionary/latest.json</code>；本页不展开其内容。</p></div>}</section></div>
 </div>
}
