'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { backupPages } from './local-backup-navigation'
import styles from './local-backup.module.css'

export function LocalBackupShell({children}:{children:ReactNode}) {
  const pathname=usePathname(),current=backupPages.find(page=>page.href===pathname||(page.href==='/local-backup/work'&&pathname.startsWith(page.href+'/')))??backupPages[0]
  return <div className={styles.page}>
    <a className={styles.skipLink} href="#page-content">跳到页面内容</a>
    <aside className={styles.sidebar}>
      <Link href="/local-backup" className={styles.brand}><span className={styles.brandMark}>AP</span><span>AI-PET-WORLD<small>项目数据管理</small></span></Link>
      <p className={styles.navCaption}>工作空间</p>
      <nav className={styles.nav} aria-label="数据管理主导航">{backupPages.map(page=><Link key={page.href} href={page.href} aria-current={current.href===page.href?'page':undefined} className={current.href===page.href?styles.activeNav:undefined}><span>{page.index}</span>{page.label}</Link>)}</nav>
      <div className={styles.sidebarFooter}><span className={styles.workspaceLabel}>本地项目</span><p>数据、执行与证据<br/>保持各自的真实状态</p><Link href="/ai-console">返回AI控制台 ↗</Link></div>
    </aside>
    <div className={styles.workspace}>
      <div className={styles.topbar}><nav aria-label="面包屑"><Link href="/ai-console">AI控制台</Link><span>/</span><Link href="/local-backup">数据管理</Link>{pathname!=='/local-backup'&&<><span>/</span><span aria-current="page">{current.short}</span></>}</nav><span className={styles.workspaceLabel}>LOCAL WORKSPACE</span></div>
      <main id="page-content" className={styles.content}>
        <header className={styles.header}><div><span className={styles.eyebrow}>数据管理 / {current.index}</span><h1>{current.label}</h1><p>{current.description}</p></div><span className={styles.timezone}>北京时间 · UTC+8</span></header>
        {children}
      </main>
    </div>
  </div>
}
