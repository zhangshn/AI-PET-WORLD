import type { Metadata } from 'next'
import { DiagramsBrowser } from './diagrams-browser'
import { pageValues } from '../documents/catalog-navigation'
export const metadata:Metadata={title:'设计图总览 | AI-PET-WORLD'}
export default async function DiagramsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const values=pageValues(await searchParams,['type','q','documentId','level','module','cursor','id']);return <DiagramsBrowser key={JSON.stringify(values)} values={values}/>}
