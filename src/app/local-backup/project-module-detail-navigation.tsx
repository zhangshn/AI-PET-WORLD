'use client'
import Link from 'next/link'
import {useCatalog} from './documents/use-catalog'
import type {DocumentBody} from './documents/document-types'
import {architectureDocumentId,architectureModules} from './project-module-details'
import styles from './project-module-detail-navigation.module.css'
export function ProjectModuleDetailNavigation(){
 const {data,error}=useCatalog<{document:DocumentBody}>('/api/local-backup/documents/'+architectureDocumentId)
 let modules:ReturnType<typeof architectureModules>=[],failure=error
 if(data)try{modules=architectureModules(data.document.content)}catch{failure='module_section_missing_or_ambiguous'}
 return <section className={styles.navigation} aria-label="九模块详细执行合同"><h2>全部九模块 · 详细内容</h2><p>逐模块阅读业务职责、子组件、输入输出、处理步骤、异常恢复与验收依据。</p>{failure?<p role="alert">正式模块章节不可用：{failure}</p>:!data?<p role="status">正在读取正式模块目录…</p>:<nav>{modules.map(module=><Link key={module.moduleId} href={module.href}><span>{module.moduleId.padStart(2,'0')}</span>{module.title.replace(/^10\.\d\s+/,'')}<small>阅读详细章节 ↗</small></Link>)}</nav>}<p>正文和流程图来自总体架构原件；实施进度请查总计划与工作记录。</p></section>
}
