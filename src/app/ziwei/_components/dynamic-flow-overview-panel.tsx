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
                  <span>流干来源</span>
                  <strong>
                    {flow.stemLabel} · {flow.stemSourceLabel}
                  </strong>
                </div>
                <div>
                  <span>星曜数量</span>
                  <strong>{flow.starCount}</strong>
                </div>
                <div>
                  <span>流星落点</span>
                  <strong>{flow.flowingStarCount}</strong>
                </div>
                <div>
                  <span>流年十二神</span>
                  <strong>{flow.annualCycleStarCount}</strong>
                </div>
                <div>
                  <span>规则来源</span>
                  <strong>{flow.sourceRuleCount}</strong>
                </div>
              </div>

              {flow.inactiveReason ? (
                <p className={styles.metaText}>{flow.inactiveReason}</p>
              ) : null}

              <div className={styles.dynamicTransformationList}>
                {flow.transformations.map((item) => (
                  <div
                    className={styles.dynamicTransformationItem}
                    key={`${flow.type}-${item.transformationStarId}`}
                  >
                    <strong>{item.displayLabel}</strong>
                    <span>
                      {item.targetStarLabel} · {item.branchLabel}
                      {item.sectorLabel}
                    </span>
                    <small>{item.placementRuleId}</small>
                  </div>
                ))}
              </div>

              {flow.flowingStars.length > 0 ? (
                <div className={styles.dynamicTransformationList}>
                  {flow.flowingStars.map((star) => (
                    <div
                      className={styles.dynamicTransformationItem}
                      key={`${flow.type}-${star.starId}`}
                    >
                      <strong>{star.displayLabel}</strong>
                      <span>
                        {star.branchLabel}
                        {star.sectorLabel}
                      </span>
                      <small>{star.placementRuleId}</small>
                    </div>
                  ))}
                </div>
              ) : null}

              {flow.annualCycleStars.length > 0 ? (
                <div className={styles.dynamicTransformationList}>
                  {flow.annualCycleStars.map((star) => (
                    <div
                      className={styles.dynamicTransformationItem}
                      key={`${flow.type}-${star.starId}`}
                    >
                      <strong>{star.displayLabel}</strong>
                      <span>
                        {star.branchLabel}
                        {star.sectorLabel}
                      </span>
                      <small>{star.cycleLabel}</small>
                    </div>
                  ))}
                </div>
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
