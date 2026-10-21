'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { backupPages } from './local-backup-navigation'
import { query, reason, time, type Inventory } from './local-backup-shared'
import styles from './local-backup.module.css'

const legacyRoutes:Record<string,string>={inventory:'/local-backup/inventory',backups:'/local-backup/backups',work:'/local-backup/work',journal:'/local-backup/work#journal',git:'/local-backup/git'}
export function LocalBackupOverview(){
 const router=useRouter(),[inventory,setInventory]=useState<Inventory|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  const followLegacy=()=>{const route=legacyRoutes[window.location.hash.slice(1)];if(route)router.replace(route)}
  followLegacy();window.addEventListener('hashchange',followLegacy);return()=>window.removeEventListener('hashchange',followLegacy)
 },[router])
 useEffect(()=>{let active=true;query('/api/local-backup/summary').then(x=>{if(active){setInventory(x.inventory);setError('')}}).catch(e=>{if(active)setError(reason(e))});return()=>{active=false}},[retry])
 return <>
  <div className={styles.toolbar}><span>项目数据、备份与工作记录的统一入口。</span><button onClick={()=>setRetry(x=>x+1)}>刷新总览</button></div>
  {error&&<p role="alert" className={styles.error}>总览记录不可用：{error}</p>}
  <div className={styles.metrics}>
   <div className={styles.metric}><span>已登记来源根</span><strong>{inventory?inventory.roots.length:'—'}</strong><small>按已保存清点范围</small></div>
   <div className={styles.metric}><span>数据分类</span><strong>{inventory?inventory.categories.length:'—'}</strong><small>分类重叠，不可相加</small></div>
   <div className={styles.metric}><span>全项目总容量</span><strong>未知</strong><small>当前清点覆盖不完整</small></div>
  </div>
  <div className={styles.entryCards}>{backupPages.slice(1).map(page=><Link href={page.href} className={styles.entryCard} key={page.href}><div><h2>{page.label}</h2><p>{page.description}</p></div><span aria-hidden="true">↗</span></Link>)}</div>
  <section className={styles.section}><div className={styles.sectionTitle}><h2>当前覆盖与接入边界</h2><span className={styles.badge}>部分覆盖</span></div>
   <div className={styles.tableWrap}><table><thead><tr><th>范围</th><th>当前可用内容</th><th>仍需核验</th></tr></thead><tbody>
    <tr><td>数据资产</td><td>{inventory?'已保存来源、分类及根映射':'正在读取已存清点'}</td><td>全量数量、总容量与未清点范围</td></tr>
    <tr><td>备份任务</td><td>已存任务与清单查询</td><td>真实网络备份、秘密纳入与恢复资格</td></tr>
    <tr><td>工作记录</td><td>已接入来源的详细报告与证据查询</td><td>完整历史与长期来源覆盖</td></tr>
    <tr><td>Git版本提交</td><td>精确文件预览及分阶段结果</td><td>实际发布前须通过仓库配置与内容核验</td></tr>
   </tbody></table></div>
   <p className={styles.muted}>程序记录与Codex外部报告分别保留；执行结束、验证通过、独立验收和可恢复备份分别判断。</p>
   {inventory&&<p className={styles.muted}>资产观察时间：{time(inventory.observedAtUtc)}。页面读取已有记录，不重新扫描或启动任务。</p>}
  </section>
  <p className={styles.compatibility}>原单页入口已迁至对应页面：<Link href={legacyRoutes.inventory}>数据总览</Link><Link href={legacyRoutes.backups}>备份与查询</Link><Link href={legacyRoutes.work}>每日自动记录</Link><Link href={legacyRoutes.journal}>可选补充</Link><Link href={legacyRoutes.git}>Git代码提交</Link></p>
 </>
}
