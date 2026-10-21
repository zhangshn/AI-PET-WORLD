export type CountMap = Record<string, number> | null
export type Inventory = {
  observedAtUtc:string;sourceReport:{logicalPath:string;sha256:string;observedAtUtc:string};totalFiles:null;totalBytes:null;coverageComplete:boolean
  roots:{sourceRootId:string;logicalRoot:string;physicalRoot:string;handling:string;coverage:string}[]
  categories:{id:string;title:string;counts:CountMap;bytes:CountMap;coverage:string;policy:string}[]
  coverage:{root:string;files:number;directories:number;completeWithinTraversalPolicy:boolean;remainingQueuedDirectories:number;exclusions:string[];byteTotal:null}[]
  networkObservation:{unc:string;freeBytes:number;observedAtUtc:string};gaps:string[]
}
export type Run = {backup_id:string;state:string;started_at_utc:string|null;finished_at_utc:string|null;elapsed_ms:number|null;coverage:string;verification_status:string;restorability_status:string;failure_code:string|null}
export const time=(value:string|null)=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date(value)):'未知'
export const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10)
export async function query(url:string,options:RequestInit={},acceptUnavailable=false) {
  const response=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(10000)}),json=await response.json()
  if(!response.ok&&!(acceptUnavailable&&response.status===503&&json.dataStatus==='not_connected'))throw new Error(json.reasonCode??json.errorCode??'query_failed')
  return json
}
export const reason=(error:unknown)=>error instanceof Error?error.message:'query_failed'
