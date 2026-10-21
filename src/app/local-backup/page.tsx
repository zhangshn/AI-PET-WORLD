import type { Metadata } from 'next'
import { LocalBackupOverview } from './local-backup-overview'

export const metadata: Metadata = { title: '数据管理总览 | AI-PET-WORLD' }
export default function LocalBackupPage() {
  return <LocalBackupOverview />
}
