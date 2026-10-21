import type { Metadata } from 'next'
import { LocalBackupTasksPanel } from '../local-backup-backups'

export const metadata:Metadata={title:'备份任务 | AI-PET-WORLD'}
export default function BackupsPage(){return <LocalBackupTasksPanel/>}
