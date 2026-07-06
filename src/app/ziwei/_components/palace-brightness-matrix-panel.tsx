import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import {
  type StarCatalogBrightnessFilter
} from "../_lib/ziwei-star-brightness-summary"
import { buildPalaceBrightnessMatrix } from "../_lib/ziwei-palace-brightness-matrix"
import styles from "../_styles/ziwei-page.module.css"

export function PalaceBrightnessMatrixPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  selectedBranch: ZiweiPalaceDetailView["branch"]
  selectedBrightness: StarCatalogBrightnessFilter
  onSelectBranch: (branch: ZiweiPalaceDetailView["branch"]) => void
  onSelectBrightness: (brightness: StarCatalogBrightnessFilter) => void
  onOpenCatalog: () => void
}) {
  const matrix = buildPalaceBrightnessMatrix(props.palaces)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>庙旺落陷分布矩阵</h2>
        <span className={styles.metaText}>{matrix.rows.length} 宫</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.palaceBrightnessSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>有表星曜</span>
            <strong>{matrix.mappedStarCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>不论星曜</span>
            <strong>{matrix.noFixedTableCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>最高宫数</span>
            <strong>{matrix.maxPalaceStarCount}</strong>
          </div>
        </div>

        <div className={styles.palaceBrightnessTotals}>
          {matrix.levelTotals.map((total) => (
            <button
              className={
                total.level === props.selectedBrightness
                  ? `${styles.brightnessTotalButton} ${styles.brightnessTotalButtonSelected}`
                  : styles.brightnessTotalButton
              }
              key={total.level}
              type="button"
              onClick={() => {
                props.onSelectBrightness(total.level)
                props.onOpenCatalog()
              }}
            >
              <span>{total.label}</span>
              <strong>{total.count}</strong>
            </button>
          ))}
        </div>

        <div className={styles.palaceBrightnessMatrixGrid}>
          {matrix.rows.map((row) => (
            <article
              className={
                row.branch === props.selectedBranch
                  ? `${styles.palaceBrightnessMatrixCard} ${styles.palaceBrightnessMatrixCardSelected}`
                  : styles.palaceBrightnessMatrixCard
              }
              key={row.branch}
            >
              <button
                className={styles.palaceBrightnessMatrixHeader}
                type="button"
                onClick={() => props.onSelectBranch(row.branch)}
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
                <span className={styles.badge}>{row.mappedStarCount} 有表</span>
                <span className={styles.badge}>{row.noFixedTableCount} 不论</span>
              </div>

              <div className={styles.palaceBrightnessLevelGrid}>
                {row.counts.map((count) => (
                  <button
                    className={
                      count.level === props.selectedBrightness
                        ? `${styles.palaceBrightnessLevelButton} ${styles.palaceBrightnessLevelButtonSelected}`
                        : styles.palaceBrightnessLevelButton
                    }
                    disabled={count.count === 0}
                    key={`${row.branch}-${count.level}`}
                    type="button"
                    onClick={() => {
                      props.onSelectBranch(row.branch)
                      props.onSelectBrightness(count.level)
                      props.onOpenCatalog()
                    }}
                  >
                    <span>{count.label}</span>
                    <strong>{count.count}</strong>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
