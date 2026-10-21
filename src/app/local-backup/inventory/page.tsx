import type { Metadata } from 'next'
import { LocalBackupInventoryPanel } from '../local-backup-inventory'

export const metadata:Metadata={title:'数据资产 | AI-PET-WORLD'}
export default function InventoryPage(){return <LocalBackupInventoryPanel/>}
