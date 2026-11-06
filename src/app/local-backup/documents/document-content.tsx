'use client'
import {useEffect,type HTMLAttributes} from 'react'
import Link from 'next/link'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type {DocumentBody} from './document-types'
import {safeDocumentHref} from './document-links'
import {architectureDocumentId,architectureModules,architectureDiagramHref,documentSelection,fullDocumentHref} from '../project-module-details'
import styles from './documents.module.css'

type Position={position?:{start:{line:number}}}
export function DocumentContent({document,links,anchor}:{document:DocumentBody;links:{documentId:string;relativePath:string}[];anchor?:string}){
 let selection:ReturnType<typeof documentSelection>|undefined,failure=''
 try{selection=documentSelection(document,anchor)}catch(error){failure=error instanceof Error?error.message:'document_section_unavailable'}
 const targetId=selection?.target?.id
 useEffect(()=>{if(targetId)window.document?.getElementById(targetId)?.scrollIntoView({block:'start'})},[targetId,document.sha256,anchor])
 if(!selection)return <p role="alert" className={styles.error}>指定章节不可用：{failure}。<Link href={fullDocumentHref(document.documentId)}>返回完整文档</Link></p>
 const view=selection,heading=(level:number)=>function DocumentHeading(props:HTMLAttributes<HTMLHeadingElement>&{node?:Position}){const {node,children}=props,Tag=('h'+level) as 'h1';return <Tag id={'section-'+((node?.position?.start.line??1)+view.offset)}>{children}</Tag>}
 let modules:ReturnType<typeof architectureModules>=[]
 if(document.documentId===architectureDocumentId)try{modules=architectureModules(document.content)}catch{/* Full original remains readable when a module definition is unavailable. */}
 const transform=(url:string)=>{const safe=safeDocumentHref(url,document.relativePath,links,document.content);if(view.focused&&safe?.startsWith('#section-')&&!view.headings.some(h=>'#'+h.id===safe))return '/local-backup/documents?'+new URLSearchParams({id:document.documentId,anchor:safe.slice(1)});return safe??''}
 return <div className={styles.reading}>
 {modules.length>0&&<details className={styles.modulePicker}><summary>九模块章节目录</summary><nav aria-label="模块章节选择">{modules.map(m=><Link key={m.moduleId} href={m.href} aria-current={anchor==='module-'+m.moduleId?'page':undefined}>{m.title}</Link>)}</nav></details>}
 <nav className={styles.detailActions} aria-label="正文与实施记录导航">{view.focused&&<Link href={fullDocumentHref(document.documentId,view.target?.title)}>返回完整文档 ↗</Link>}<Link href="/local-backup/work#project-progress">查看计划与真实工作记录 ↗</Link><Link href="/local-backup">返回总览</Link></nav>
 {view.focused&&<p className={styles.focusNotice}>当前只显示本模块正式章节及其子组件 · 原文第 {view.offset+1}—{view.endLine} 行。定义与验收条件以原文为准，实施完成情况请查工作记录。</p>}
 <aside className={styles.toc} aria-label="文档章节"><h3>{view.focused?'本模块子标题':'本篇章节'}</h3>{view.headings.map(h=><a key={h.id} href={'#'+h.id} style={{paddingInlineStart:Math.max(0,h.depth-(view.focused?3:1))*12}}>{h.title}</a>)}</aside>
 <article className={styles.markdown} aria-label="文档正文" data-source-start-line={view.offset+1} data-source-end-line={view.endLine}><Markdown skipHtml remarkPlugins={[remarkGfm]} urlTransform={transform} components={{h1:heading(1),h2:heading(2),h3:heading(3),h4:heading(4),h5:heading(5),h6:heading(6),a:({href,children})=>href?<a href={href}>{children}</a>:<span>{children}</span>,img:({alt})=><span>〔图片未加载：{alt??'未提供说明'}〕</span>,pre:({node,children})=>{const line=(node?.position?.start.line??0)+view.offset,href=architectureDiagramHref(document,line);return href?<div className={styles.diagramSource}><Link href={href}>打开本节流程图 · 放大与全屏 ↗</Link><details><summary>查看正式图源 · 原文第 {line} 行</summary><pre>{children}</pre></details></div>:<pre>{children}</pre>}}}>{view.content}</Markdown></article></div>
}
