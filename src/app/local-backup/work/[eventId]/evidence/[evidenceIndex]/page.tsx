import type { Metadata } from 'next'
import { WorkEvidence } from '../../../work-evidence'
import { pageValues } from '../../../../documents/catalog-navigation'
export const metadata:Metadata={title:'图文证据 | AI-PET-WORLD'}
export default async function EvidencePage({params,searchParams}:{params:Promise<{eventId:string;evidenceIndex:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const p=await params,values=pageValues(await searchParams,['date','moduleId','reporterId','cursor','limit']);return <WorkEvidence eventId={p.eventId} evidenceIndex={p.evidenceIndex} values={values}/>}
