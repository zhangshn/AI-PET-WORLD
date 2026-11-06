import type {FormalPlanProjection} from './progress-types'
import {ProgressPlan} from './progress-plan'
import styles from './progress.module.css'

export function FormalPlanFallback({data}:{data:FormalPlanProjection}){
 return <div><section role="alert" className={styles.notice}><strong>动态证据当前不可核验，正式计划仍可查阅</strong><p>{data.dynamicEvidence.message}</p><code>{data.dynamicEvidence.reasonCode}</code></section><ProgressPlan data={{plan:data.plan,workPlan:data.workPlan}}/></div>
}
