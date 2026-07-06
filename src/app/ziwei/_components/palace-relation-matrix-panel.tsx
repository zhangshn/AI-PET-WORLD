import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildRelationMatrixRows } from "../_lib/ziwei-relation-matrix"

export function PalaceRelationMatrixPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  selectedBranch: ZiweiPalaceDetailView["branch"]
  onSelect: (branch: ZiweiPalaceDetailView["branch"]) => void
}) {
  const rows = buildRelationMatrixRows(props.palaces)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>三方四正关系矩阵</h2>
        <span className={styles.metaText}>{rows.length} 宫</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.relationMatrixGrid}>
          {rows.map((row) => (
            <article
              className={
                row.branch === props.selectedBranch
                  ? `${styles.relationMatrixCard} ${styles.relationMatrixCardSelected}`
                  : styles.relationMatrixCard
              }
              key={row.branch}
            >
              <button
                className={styles.relationMatrixHeader}
                type="button"
                onClick={() => props.onSelect(row.branch)}
              >
                <strong>
                  {row.branchLabel} · {row.sectorLabel}
                </strong>
                <span>
                  {row.relatedStarCount} 星 · {row.relatedSourceRuleCount} 规则
                </span>
              </button>

              <div className={styles.relationMatrixTargets}>
                {row.targets.map((target, index) => (
                  <button
                    className={styles.relationMatrixTarget}
                    key={`${row.branch}-${target.kind}-${target.branch}-${index}`}
                    type="button"
                    onClick={() => props.onSelect(target.branch)}
                  >
                    <span>
                      {target.kindLabel} · {target.branchLabel}
                    </span>
                    <strong>{target.sectorLabel}</strong>
                    <small>{target.note}</small>
                    <em>
                      {target.starCount} 星 / {target.sourceRuleCount} 规则
                    </em>
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
