import type { PageValues } from './document-types'
export function catalogUrl(base:string,values:PageValues,changes:PageValues={}){const next={...values,...changes},search=new URLSearchParams();for(const [k,v]of Object.entries(next))if(v)search.set(k,v);return base+(search.size?'?'+search.toString():'')}
export function pageValues(raw:Record<string,string|string[]|undefined>,allowed:string[]):PageValues{return Object.fromEntries(allowed.map(k=>[k,typeof raw[k]==='string'?raw[k]:undefined]))}
export const categoryName=(value:string)=>({'navigation':'项目入口','project':'项目治理与架构','ai-console':'AI 控制台','game-world-generation':'世界生成与 Painter','ziwei':'人格与紫微','world-visual-data-dictionary':'视觉字典','ai-painter-progress':'退役历史资料'}[value]??value)
