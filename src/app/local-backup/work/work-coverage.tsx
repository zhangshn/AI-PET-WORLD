import styles from './work.module.css'
type Coverage={complete?:boolean;registeredReporters?:{id:string;name:string;coverageStatus:string;knownReportCount:number|null}[]}
export type Summary={dataStatus:string;records:Record<string,unknown>[]|null;coverage?:Coverage}
export function WorkCoverage({summary}:{summary:Summary|null}){
 const rows=summary?.records??[],sum=(key:string)=>rows.reduce((n,row)=>n+(typeof row[key]==='number'?row[key] as number:0),0)
 return <><div className={styles.metrics}>{[['程序执行结束','executionEnded'],['程序验证通过','validationPassed'],['独立验收完成','acceptanceCompleted']].map(([name,key])=><div key={key}><span>{name}</span><strong>{summary&&summary.dataStatus!=='not_connected'?sum(key):'未知'}</strong><small>查询已返回分组 · 分别统计</small></div>)}</div><p className={styles.note}>仅已接入来源及已返回汇总分组，缺失不代表没有工作；Codex自报不计作本地AI自主研发或机器验收。</p><details className={styles.coverage}><summary>来源覆盖与未提交窗口</summary>{summary?.coverage?.registeredReporters?.map(r=><p key={r.id}>{r.name}：{r.coverageStatus==='reported_partial'?`已记录${r.knownReportCount??'未知'}项，仅部分覆盖`:r.coverageStatus==='no_report_recorded'?'尚未记录报告，工作量未知':'记录状态未知'}</p>)}{!summary&&<p>覆盖信息尚未取得，保持未知。</p>}</details></>
}
