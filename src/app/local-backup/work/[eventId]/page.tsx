import type { Metadata } from 'next'
import { WorkDetail } from '../work-detail'
import { pageValues } from '../../documents/catalog-navigation'
export const metadata:Metadata={title:'工作记录详情 | AI-PET-WORLD'}
export default async function WorkDetailPage({params,searchParams}:{params:Promise<{eventId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {eventId}=await params,values=pageValues(await searchParams,['date','moduleId','reporterId','cursor','limit']);return <WorkDetail key={eventId} eventId={eventId} values={values}/>}
