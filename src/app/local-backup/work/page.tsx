import type { Metadata } from 'next'
import Link from 'next/link'
import mapStyles from './natural-map/review.module.css'
import { LocalBackupWorkPanel } from '../local-backup-work'
import { ProjectProgressPanel } from '../progress/project-progress'

export const metadata:Metadata={title:'工作记录与项目进度 | AI-PET-WORLD'}
export default async function WorkPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const values=await searchParams
 const one=(key:string)=>typeof values[key]==='string'?values[key] as string:undefined
 return <><Link className={mapStyles.entry} href="/local-backup/work/natural-map">打开当期自然地图候选 · 点选查看地形、通行与对象 ↗</Link><ProjectProgressPanel/><LocalBackupWorkPanel key={JSON.stringify([one('date'),one('moduleId'),one('reporterId'),one('cursor'),one('limit')])} date={one('date')} moduleId={one('moduleId')} reporterId={one('reporterId')} cursor={one('cursor')} limit={one('limit')}/></>
}
