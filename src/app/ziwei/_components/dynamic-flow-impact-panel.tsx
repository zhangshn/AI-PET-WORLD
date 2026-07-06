import type {
  BranchPalace,
  ZiweiDynamicFlowDetailView
} from "@/ai/destiny-core/ziwei-core/contracts"

import { buildDynamicFlowImpactSummary } from "../_lib/ziwei-dynamic-flow-impact"
import styles from "../_styles/ziwei-page.module.css"

export function DynamicFlowImpactPanel(props: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedBranch: BranchPalace
  onSelectBranch: (branch: BranchPalace) => void
}) {
  const summary = buildDynamicFlowImpactSummary({
    flows: props.flows,
    selectedBranch: props.selectedBranch
  })

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>流动盘叠加影响</h2>
        <span className={styles.metaText}>{summary.activeFlowCount}/{summary.totalFlowCount} 启用</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.dynamicFlowImpactSummary}>
          <DynamicFlowImpactFact label="同宫叠加" value={`${summary.samePalaceOverlayCount}`} />
          <DynamicFlowImpactFact label="四化落点" value={`${summary.transformationTargetCount}`} />
          <DynamicFlowImpactFact label="化忌压力" value={`${summary.jiPressureCount}`} />
          <DynamicFlowImpactFact label="当前宫牵动" value={`${summary.selectedBranchImpactCount}`} />
        </div>

        <div className={styles.dynamicFlowImpactSection}>
          <h3>同宫叠加</h3>
          {summary.palaceOverlays.length > 0 ? (
            <div className={styles.dynamicFlowImpactGrid}>
              {summary.palaceOverlays.map((overlay) => (
                <button
                  className={
                    overlay.isSelected
                      ? `${styles.dynamicFlowImpactCard} ${styles.dynamicFlowImpactCardSelected}`
                      : styles.dynamicFlowImpactCard
                  }
                  key={overlay.branch}
                  type="button"
                  onClick={() => props.onSelectBranch(overlay.branch)}
                >
                  <strong>
                    {overlay.branchLabel} · {overlay.sectorLabel}
                  </strong>
                  <span>{overlay.flowLabels.join("、")}</span>
                  <small>
                    {overlay.starCount} 星 · {overlay.transformationCount} 四化 ·{" "}
                    {overlay.sourceRuleCount} 规则
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.metaText}>暂无同宫叠加</p>
          )}
        </div>

        <div className={styles.dynamicFlowImpactSection}>
          <h3>四化落点叠加</h3>
          <div className={styles.dynamicFlowImpactGrid}>
            {summary.transformationOverlays.map((overlay) => (
              <button
                className={
                  overlay.isSelected
                    ? `${styles.dynamicFlowImpactCard} ${styles.dynamicFlowImpactCardSelected}`
                    : styles.dynamicFlowImpactCard
                }
                key={overlay.branch}
                type="button"
                onClick={() => props.onSelectBranch(overlay.branch)}
              >
                <strong>
                  {overlay.branchLabel} · {overlay.sectorLabel}
                </strong>
                <span>{overlay.transformationLabels.join("、")}</span>
                <small>{overlay.targetStarLabels.join("、")}</small>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.dynamicFlowImpactSection}>
          <h3>化忌压力</h3>
          {summary.jiPressures.length > 0 ? (
            <div className={styles.dynamicFlowImpactPressureList}>
              {summary.jiPressures.map((pressure) => (
                <button
                  className={
                    pressure.isSelected
                      ? `${styles.dynamicFlowImpactPressure} ${styles.dynamicFlowImpactCardSelected}`
                      : styles.dynamicFlowImpactPressure
                  }
                  key={`${pressure.flowLabel}-${pressure.branch}-${pressure.targetStarLabel}`}
                  type="button"
                  onClick={() => props.onSelectBranch(pressure.branch)}
                >
                  <strong>{pressure.transformationLabel}</strong>
                  <span>{pressure.targetStarLabel}</span>
                  <small>
                    {pressure.branchLabel} · {pressure.sectorLabel}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.metaText}>暂无化忌压力</p>
          )}
        </div>

        <div className={styles.dynamicFlowImpactSection}>
          <h3>当前宫位牵动</h3>
          {summary.selectedBranchImpacts.length > 0 ? (
            <div className={styles.dynamicFlowImpactCurrentList}>
              {summary.selectedBranchImpacts.map((impact, index) => (
                <div
                  className={styles.dynamicFlowImpactCurrentItem}
                  key={`${impact.flowType}-${impact.impactKind}-${index}`}
                >
                  <strong>{impact.sourceLabel}</strong>
                  <span>{impact.impactKind}</span>
                  <small>{impact.detail}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.metaText}>当前宫位暂无流动叠加</p>
          )}
        </div>
      </div>
    </section>
  )
}

function DynamicFlowImpactFact(props: {
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
