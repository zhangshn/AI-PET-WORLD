import type { ZiweiDynamicFlowDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { StarGroupList } from "./star-group-list"

export function DynamicFlowFocusPanel(props: {
  flow?: ZiweiDynamicFlowDetailView
  onSelectBranch: (branch: ZiweiDynamicFlowDetailView["palace"]) => void
}) {
  if (!props.flow) {
    return (
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>当前流动盘</h2>
        </div>
        <div className={styles.panelBody}>
          <p className={styles.metaText}>暂无动态流数据</p>
        </div>
      </section>
    )
  }

  const flow = props.flow

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>当前流动盘</h2>
        <span className={flow.isActive ? styles.flowStatusActive : styles.flowStatusInactive}>
          {flow.isActive ? "启用" : "未启用"}
        </span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.dynamicFlowFocusHero}>
          <button
            className={styles.dynamicFlowFocusPalaceButton}
            type="button"
            onClick={() => props.onSelectBranch(flow.palace)}
          >
            <span>{flow.label}</span>
            <strong>
              {flow.branchLabel} · {flow.sectorLabel}
            </strong>
          </button>
          <div className={styles.dynamicFlowFocusFacts}>
            <DynamicFlowFocusFact label="流干" value={`${flow.stemLabel} · ${flow.stemSourceLabel}`} />
            <DynamicFlowFocusFact label="权重" value={flow.influence.toFixed(2)} />
            <DynamicFlowFocusFact label="星曜" value={`${flow.starCount} 颗`} />
            <DynamicFlowFocusFact label="流星" value={`${flow.flowingStarCount} 颗`} />
            <DynamicFlowFocusFact label="年系" value={`${flow.annualCycleStarCount} 颗`} />
            <DynamicFlowFocusFact label="规则" value={`${flow.sourceRuleCount} 条`} />
          </div>
        </div>

        {flow.flowingStars.length > 0 ? (
          <div className={styles.dynamicFlowFocusSection}>
            <h3>流星落点</h3>
            <div className={styles.dynamicFlowFocusRelationGrid}>
              {flow.flowingStars.map((star) => (
                <button
                  className={styles.dynamicFlowFocusRelation}
                  key={`${flow.type}-${star.starId}`}
                  type="button"
                  onClick={() => props.onSelectBranch(star.branch)}
                >
                  <strong>{star.displayLabel}</strong>
                  <span>
                    {star.branchLabel} · {star.sectorLabel}
                  </span>
                  <small>{star.placementRuleId}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {flow.annualCycleStars.length > 0 ? (
          <div className={styles.dynamicFlowFocusSection}>
            <h3>流年十二神</h3>
            <div className={styles.dynamicFlowFocusRelationGrid}>
              {flow.annualCycleStars.map((star) => (
                <button
                  className={styles.dynamicFlowFocusRelation}
                  key={`${flow.type}-${star.starId}`}
                  type="button"
                  onClick={() => props.onSelectBranch(star.branch)}
                >
                  <strong>{star.displayLabel}</strong>
                  <span>
                    {star.branchLabel} · {star.sectorLabel}
                  </span>
                  <small>{star.cycleLabel}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {flow.inactiveReason ? (
          <p className={styles.dynamicFlowFocusWarning}>{flow.inactiveReason}</p>
        ) : null}

        <div className={styles.dynamicFlowFocusSection}>
          <h3>流干四化</h3>
          <div className={styles.dynamicFlowFocusTransformationGrid}>
            {flow.transformations.map((item) => (
              <button
                className={styles.dynamicFlowFocusTransformation}
                key={`${flow.type}-${item.transformationStarId}`}
                type="button"
                onClick={() => props.onSelectBranch(item.branch)}
              >
                <strong>{item.displayLabel}</strong>
                <span>{item.sourceLabel}</span>
                <small>
                  {item.branchLabel} · {item.sectorLabel}
                </small>
              </button>
            ))}
          </div>
        </div>

        {flow.palaceDetail ? (
          <>
            <div className={styles.dynamicFlowFocusSection}>
              <h3>牵动宫位</h3>
              <div className={styles.dynamicFlowFocusRelationGrid}>
                {flow.palaceDetail.relations.map((relation) => (
                  <button
                    className={styles.dynamicFlowFocusRelation}
                    key={`${flow.type}-${relation.kind}-${relation.branch}`}
                    type="button"
                    onClick={() => props.onSelectBranch(relation.branch)}
                  >
                    <strong>{relation.kindLabel}</strong>
                    <span>
                      {relation.branchLabel} · {relation.sectorLabel}
                    </span>
                    <small>{relation.note}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.dynamicFlowFocusSection}>
              <h3>本流星曜</h3>
              <StarGroupList
                groups={flow.palaceDetail.starGroups}
                compact
                compactGroupLimit={12}
                compactStarLimit={8}
                dense
                mixedOrientation
                emptyText="本流暂无星曜"
              />
            </div>

            <div className={styles.dynamicFlowFocusSection}>
              <h3>盘面提示</h3>
              <ul className={styles.dynamicFlowFocusLineList}>
                {flow.palaceDetail.detailLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}

function DynamicFlowFocusFact(props: {
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
