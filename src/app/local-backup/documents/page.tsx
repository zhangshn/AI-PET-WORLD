import type { Metadata } from 'next'
import { DocumentsBrowser } from './documents-browser'
import { pageValues } from './catalog-navigation'
export const metadata:Metadata={title:'相关文档 | AI-PET-WORLD'}
export default async function DocumentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const values=pageValues(await searchParams,['category','status','q','cursor','id','revision','anchor']);return <DocumentsBrowser key={JSON.stringify(values)} values={values}/>}
