import type { Metadata } from 'next'
import { LocalBackupWorkPanel } from '../local-backup-work'

export const metadata:Metadata={title:'工作记录 | AI-PET-WORLD'}
export default async function WorkPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const values=await searchParams
 const one=(key:string)=>typeof values[key]==='string'?values[key] as string:undefined
 return <LocalBackupWorkPanel key={JSON.stringify([one('date'),one('moduleId'),one('reporterId'),one('cursor'),one('limit')])} date={one('date')} moduleId={one('moduleId')} reporterId={one('reporterId')} cursor={one('cursor')} limit={one('limit')}/>
}
