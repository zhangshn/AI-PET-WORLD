import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildPalaceDensitySummary } from "../_lib/ziwei-palace-density"

export function PalaceDensityPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  selectedBranch: ZiweiPalaceDetailView["branch"]
  onSelect: (branch: ZiweiPalaceDetailView["branch"]) => void
}) {
  const summary = buildPalaceDensitySummary(props.palaces)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>宫位星曜密度</h2>
        <span className={styles.metaText}>{summary.totalStarCount} 颗</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.palaceDensitySummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>最高密度</span>
            <strong>{summary.maxStarCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>最低密度</span>
            <strong>{summary.minStarCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>平均密度</span>
            <strong>{summary.averageStarCount.toFixed(1)}</strong>
          </div>
        </div>

        <div className={styles.palaceDensityGrid}>
          {summary.rows.map((row) => (
            <article
              className={
                row.branch === props.selectedBranch
                  ? `${styles.palaceDensityCard} ${styles.palaceDensityCardSelected}`
                  : styles.palaceDensityCard
              }
              key={row.branch}
            >
              <button
                className={styles.palaceDensityHeader}
                type="button"
                onClick={() => props.onSelect(row.branch)}
              >
                <strong>
                  {row.sectorLabel} · {row.palaceStemLabel}
                  {row.branchLabel}
                </strong>
                <span>{row.starCount} 颗</span>
              </button>

              <div className={styles.badges}>
                {row.isLifePalace ? <span className={styles.badge}>命宫</span> : null}
                {row.isBodyPalace ? <span className={styles.badge}>身宫</span> : null}
                <span className={styles.badge}>{row.groupCount} 组</span>
                <span className={styles.badge}>{row.sourceRuleCount} 规则</span>
              </div>

              <div className={styles.palaceDensityBars}>
                <DensityBar label="核心星曜" value={row.coreStarCount} total={row.starCount} />
                <DensityBar label="周期流系" value={row.flowStarCount} total={row.starCount} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DensityBar(props: {
  label: string
  value: number
  total: number
}) {
  const percent = props.total > 0 ? (props.value / props.total) * 100 : 0

  return (
    <div className={styles.palaceDensityBar}>
      <div className={styles.palaceDensityBarHeader}>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
      </div>
      <div className={styles.palaceDensityTrack}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
