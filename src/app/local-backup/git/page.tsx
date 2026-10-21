import type { Metadata } from 'next'
import { LocalBackupGitPanel } from '../local-backup-git'

export const metadata:Metadata={title:'Git版本提交 | AI-PET-WORLD'}
export default function GitPage(){return <LocalBackupGitPanel/>}
