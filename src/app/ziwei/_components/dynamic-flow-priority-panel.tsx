import type {
  BranchPalace,
  ZiweiDynamicFlowDetailView
} from "@/ai/destiny-core/ziwei-core/contracts"

import { buildDynamicFlowPrioritySummary } from "../_lib/ziwei-dynamic-flow-priority"
import styles from "../_styles/ziwei-page.module.css"

export function DynamicFlowPriorityPanel(props: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedBranch: BranchPalace
  onSelectBranch: (branch: BranchPalace) => void
}) {
  const summary = buildDynamicFlowPrioritySummary({
    flows: props.flows,
    selectedBranch: props.selectedBranch
  })

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>流动盘重点宫位</h2>
        <span className={styles.metaText}>{summary.rows.length} 宫</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.dynamicFlowPrioritySummary}>
          <DynamicFlowPriorityFact label="最高分" value={`${summary.maxScore}`} />
          <DynamicFlowPriorityFact label="压力宫" value={`${summary.pressureRowCount}`} />
          <DynamicFlowPriorityFact label="四化宫" value={`${summary.transformationRowCount}`} />
          <DynamicFlowPriorityFact
            label="当前宫"
            value={summary.selectedRow ? `${summary.selectedRow.score}` : "0"}
          />
        </div>

        <div className={styles.dynamicFlowPriorityTopGrid}>
          {summary.topRows.map((row, index) => (
            <button
              className={
                row.isSelected
                  ? `${styles.dynamicFlowPriorityTopCard} ${styles.dynamicFlowPriorityCardSelected}`
                  : styles.dynamicFlowPriorityTopCard
              }
              key={row.branch}
              type="button"
              onClick={() => props.onSelectBranch(row.branch)}
            >
              <span>#{index + 1}</span>
              <strong>
                {row.branchLabel} · {row.sectorLabel}
              </strong>
              <em>{row.score}</em>
              <small>{row.reasons[0] ?? "暂无重点"}</small>
            </button>
          ))}
        </div>

        <div className={styles.dynamicFlowPriorityList}>
          {summary.rows.map((row) => (
            <article
              className={
                row.isSelected
                  ? `${styles.dynamicFlowPriorityRow} ${styles.dynamicFlowPriorityCardSelected}`
                  : styles.dynamicFlowPriorityRow
              }
              key={row.branch}
            >
              <button
                className={styles.dynamicFlowPriorityHeader}
                type="button"
                onClick={() => props.onSelectBranch(row.branch)}
              >
                <strong>
                  {row.branchLabel} · {row.sectorLabel}
                </strong>
                <span>{row.score} 分</span>
              </button>

              <div className={styles.dynamicFlowPriorityMetrics}>
                <DynamicFlowPriorityFact label="流命" value={`${row.landingFlowLabels.length}`} />
                <DynamicFlowPriorityFact label="四化" value={`${row.transformationLabels.length}`} />
                <DynamicFlowPriorityFact label="化忌" value={`${row.jiPressureLabels.length}`} />
                <DynamicFlowPriorityFact label="牵动" value={`${row.relationFlowLabels.length}`} />
              </div>

              <ul className={styles.dynamicFlowPriorityReasonList}>
                {row.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DynamicFlowPriorityFact(props: {
  label: string
  value: string
}) {
  return (
    <div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}
