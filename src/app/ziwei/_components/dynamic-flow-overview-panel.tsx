import type {
  ZiweiDynamicFlowDetailView,
  ZiweiDynamicTabView
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { StarGroupList } from "./star-group-list"

export function DynamicFlowOverviewPanel(props: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedType: ZiweiDynamicTabView["type"]
  onSelect: (flow: ZiweiDynamicFlowDetailView) => void
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>动态流完整明细</h2>
        <span className={styles.metaText}>{props.flows.length} 流</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.dynamicFlowOverviewGrid}>
          {props.flows.map((flow) => (
            <article
              className={
                flow.type === props.selectedType
                  ? `${styles.dynamicFlowCard} ${styles.dynamicFlowCardSelected}`
                  : styles.dynamicFlowCard
              }
              key={flow.type}
            >
              <button
                className={styles.dynamicFlowCardHeader}
                type="button"
                onClick={() => props.onSelect(flow)}
              >
                <span>
                  <strong>{flow.label}</strong>
                  <small>
                    {flow.branchLabel} · {flow.sectorLabel}
                  </small>
                </span>
                <em className={flow.isActive ? styles.flowStatusActive : styles.flowStatusInactive}>
                  {flow.isActive ? "启用" : "未启用"}
                </em>
              </button>

              <div className={styles.dynamicFlowFacts}>
                <div>
                  <span>影响权重</span>
                  <strong>{flow.influence.toFixed(2)}</strong>
                </div>
                <div>
                  <span>星曜数量</span>
                  <strong>{flow.starCount}</strong>
                </div>
                <div>
                  <span>规则来源</span>
                  <strong>{flow.sourceRuleCount}</strong>
                </div>
              </div>

              {flow.inactiveReason ? (
                <p className={styles.metaText}>{flow.inactiveReason}</p>
              ) : null}

              {flow.palaceDetail ? (
                <StarGroupList
                  groups={flow.palaceDetail.starGroups}
                  compact
                  emptyText="本流暂无星曜"
                />
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
