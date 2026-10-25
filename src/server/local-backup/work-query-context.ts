import 'server-only'
import { ledger } from './service'
import { workRecordPage, workRecordDetail } from './work-query.mjs'
export const workRecords=()=>({list:(search:URLSearchParams)=>workRecordPage(ledger(),search),detail:(id:string)=>workRecordDetail(ledger(),id)})
