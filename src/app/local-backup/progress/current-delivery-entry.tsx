'use client'
import Link from 'next/link'
import {useProjectProgress} from './use-project-progress'
import {CurrentDelivery} from './current-delivery'
import styles from './current-delivery.module.css'

export function CurrentDeliveryEntry(){
 const result=useProjectProgress(),plan=result.data?.projection.workPlan
 if(plan?.currentDelivery)return <>{result.data&&'projectionKind' in result.data.projection&&<p role="alert" className={styles.unavailable}>动态证据当前不可核验：{result.data.reasonCode}；正式交付目标独立显示。</p>}<CurrentDelivery plan={plan} compact/></>
 return <section className={styles.delivery}><h3>当前交付计划</h3><p role={result.error?'alert':'status'}>{result.error?'正式计划当前不可核验：'+result.error:'正在读取正式当前交付内容…'}</p><Link href="/local-backup/work#current-delivery">查看当前交付详细计划 ↗</Link></section>
}
