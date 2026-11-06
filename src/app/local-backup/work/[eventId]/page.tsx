import type { Metadata } from 'next'
import Link from 'next/link'
import mapStyles from '../natural-map/review.module.css'
import { WorkDetail } from '../work-detail'
import { pageValues } from '../../documents/catalog-navigation'
export const metadata:Metadata={title:'工作记录详情 | AI-PET-WORLD'}
export default async function WorkDetailPage({params,searchParams}:{params:Promise<{eventId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {eventId}=await params,values=pageValues(await searchParams,['date','moduleId','reporterId','cursor','limit'])
 return <>{eventId==='codex-818bb0ccda8514712999e4e290d502c1712a7e19184d0ade574f46e02476b9af'&&<Link className={mapStyles.entry} href="/local-backup/work/natural-map">在当期自然地图候选上查看位置与对象 ↗</Link>}<WorkDetail key={eventId} eventId={eventId} values={values}/></>}
