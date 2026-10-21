import type { ReactNode } from 'react'
import theme from '../ai-console/ai-console-theme.module.css'
import { LocalBackupShell } from './local-backup-shell'

export default function LocalBackupLayout({children}:{children:ReactNode}) {
  return <div className={theme.theme} lang="zh-CN"><LocalBackupShell>{children}</LocalBackupShell></div>
}
