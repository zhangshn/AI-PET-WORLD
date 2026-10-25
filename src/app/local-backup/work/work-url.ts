export type WorkValues={date?:string;moduleId?:string;reporterId?:string;cursor?:string;limit?:string}
export function workSearch(values:WorkValues){const p=new URLSearchParams();for(const k of ['date','moduleId','reporterId','cursor','limit'] as const)if(values[k])p.set(k,values[k]!);return p.toString()}
export const workListUrl=(values:WorkValues)=>'/local-backup/work?'+workSearch(values)
export const workDetailUrl=(id:string,values:WorkValues)=>'/local-backup/work/'+encodeURIComponent(id)+'?'+workSearch(values)
export const sourceName=(source:string)=>source==='codex'?'Codex · 外部执行':source==='local_program'?'本地程序':source==='human'?'人工陈述':source
