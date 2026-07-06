import type { ZiweiDynamicFlowDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { StarGroupList } from "./star-group-list"

export function DynamicFlowMatrixPanel(props: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedType: ZiweiDynamicFlowDetailView["type"]
  onSelectFlow: (flow: ZiweiDynamicFlowDetailView) => void
  onSelectBranch: (branch: ZiweiDynamicFlowDetailView["palace"]) => void
}) {
  const activeFlowCount = props.flows.filter((flow) => flow.isActive).length
  const transformationCount = props.flows.reduce((total, flow) => {
    return total + flow.transformations.length
  }, 0)
  const starCount = props.flows.reduce((total, flow) => {
    return total + flow.starCount
  }, 0)
  const sourceRuleCount = props.flows.reduce((total, flow) => {
    return total + flow.sourceRuleCount
  }, 0)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>流动盘总览矩阵</h2>
        <span className={styles.metaText}>{props.flows.length} 流</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.dynamicFlowMatrixSummary}>
          <DynamicFlowMatrixFact label="启用流" value={`${activeFlowCount}/${props.flows.length}`} />
          <DynamicFlowMatrixFact label="四化点" value={`${transformationCount}`} />
          <DynamicFlowMatrixFact label="星曜数" value={`${starCount}`} />
          <DynamicFlowMatrixFact label="规则数" value={`${sourceRuleCount}`} />
        </div>

        <div className={styles.dynamicFlowMatrixGrid}>
          {props.flows.map((flow) => (
            <article
              className={
                flow.type === props.selectedType
                  ? `${styles.dynamicFlowMatrixCard} ${styles.dynamicFlowMatrixCardSelected}`
                  : styles.dynamicFlowMatrixCard
              }
              key={flow.type}
            >
              <button
                className={styles.dynamicFlowMatrixHeader}
                type="button"
                onClick={() => props.onSelectFlow(flow)}
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

              <div className={styles.dynamicFlowMatrixFacts}>
                <div>
                  <span>流干</span>
                  <strong>{flow.stemLabel}</strong>
                </div>
                <div>
                  <span>来源</span>
                  <strong>{flow.stemSourceLabel}</strong>
                </div>
                <div>
                  <span>权重</span>
                  <strong>{flow.influence.toFixed(2)}</strong>
                </div>
                <div>
                  <span>星曜</span>
                  <strong>{flow.starCount}</strong>
                </div>
                <div>
                  <span>流星</span>
                  <strong>{flow.flowingStarCount}</strong>
                </div>
                <div>
                  <span>年系</span>
                  <strong>{flow.annualCycleStarCount}</strong>
                </div>
              </div>

              {flow.inactiveReason ? (
                <p className={styles.dynamicFlowMatrixWarning}>{flow.inactiveReason}</p>
              ) : null}

              <div className={styles.dynamicFlowMatrixSection}>
                <h3>四化落点</h3>
                <div className={styles.dynamicFlowMatrixTransformationList}>
                  {flow.transformations.map((item) => (
                    <button
                      className={styles.dynamicFlowMatrixTransformation}
                      key={`${flow.type}-${item.transformationStarId}`}
                      type="button"
                      onClick={() => props.onSelectBranch(item.branch)}
                    >
                      <strong>{item.displayLabel}</strong>
                      <span>{item.sourceLabel}</span>
                      <small>{item.branchLabel}{item.sectorLabel}</small>
                    </button>
                  ))}
                </div>
              </div>

              {flow.flowingStars.length > 0 ? (
                <div className={styles.dynamicFlowMatrixSection}>
                  <h3>流星落点</h3>
                  <div className={styles.dynamicFlowMatrixRelationList}>
                    {flow.flowingStars.map((star) => (
                      <button
                        className={styles.dynamicFlowMatrixRelation}
                        key={`${flow.type}-${star.starId}`}
                        type="button"
                        onClick={() => props.onSelectBranch(star.branch)}
                      >
                        <strong>{star.displayLabel}</strong>
                        <span>{star.branchLabel}{star.sectorLabel}</span>
                        <small>{star.placementRuleId}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {flow.annualCycleStars.length > 0 ? (
                <div className={styles.dynamicFlowMatrixSection}>
                  <h3>流年十二神</h3>
                  <div className={styles.dynamicFlowMatrixRelationList}>
                    {flow.annualCycleStars.map((star) => (
                      <button
                        className={styles.dynamicFlowMatrixRelation}
                        key={`${flow.type}-${star.starId}`}
                        type="button"
                        onClick={() => props.onSelectBranch(star.branch)}
                      >
                        <strong>{star.displayLabel}</strong>
                        <span>{star.branchLabel}{star.sectorLabel}</span>
                        <small>{star.cycleLabel}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {flow.palaceDetail ? (
                <>
                  <div className={styles.dynamicFlowMatrixSection}>
                    <h3>牵动宫位</h3>
                    <div className={styles.dynamicFlowMatrixRelationList}>
                      {flow.palaceDetail.relations.map((relation) => (
                        <button
                          className={styles.dynamicFlowMatrixRelation}
                          key={`${flow.type}-${relation.kind}-${relation.branch}`}
                          type="button"
                          onClick={() => props.onSelectBranch(relation.branch)}
                        >
                          <strong>{relation.kindLabel}</strong>
                          <span>{relation.branchLabel}{relation.sectorLabel}</span>
                          <small>{relation.note}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.dynamicFlowMatrixSection}>
                    <h3>星曜摘要</h3>
                    <StarGroupList
                      groups={flow.palaceDetail.starGroups}
                      compact
                      compactGroupLimit={8}
                      compactStarLimit={5}
                      dense
                      mixedOrientation
                      emptyText="本流暂无星曜"
                    />
                  </div>
                </>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DynamicFlowMatrixFact(props: {
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
