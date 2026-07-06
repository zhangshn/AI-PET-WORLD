import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildZiweiPatternMatches } from "../_lib/ziwei-pattern-catalog"
import {
  buildZiweiPatternPalaceSummary,
  type ZiweiPatternPalaceSummaryRow
} from "../_lib/ziwei-pattern-palace-summary"

export function PatternPalaceSummaryPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  selectedBranch: ZiweiPalaceDetailView["branch"]
  onSelectBranch: (branch: ZiweiPalaceDetailView["branch"]) => void
  onOpenPatternOverview?: () => void
}) {
  const matches = buildZiweiPatternMatches(props.palaces)
  const summary = buildZiweiPatternPalaceSummary({
    palaces: props.palaces,
    matches
  })

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>格局宫位聚合</h2>
        <button
          className={styles.secondaryButton}
          onClick={props.onOpenPatternOverview}
          type="button"
        >
          查看格局字典
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.patternPalaceSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>涉及宫位</span>
            <strong>{summary.coveredPalaceCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>命中格局</span>
            <strong>{summary.totalHitCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>煞忌破格</span>
            <strong>{summary.totalBrokenCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>凶格命中</span>
            <strong>{summary.totalAdverseHitCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>未成缺口</span>
            <strong>{summary.totalGapCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>未定位缺口</span>
            <strong>{summary.unplacedGapCount}</strong>
          </div>
        </div>

        <div className={styles.patternPalaceGrid}>
          {summary.rows.map((row) => (
            <PatternPalaceCard
              key={row.branch}
              row={row}
              selected={row.branch === props.selectedBranch}
              onSelect={() => props.onSelectBranch(row.branch)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function PatternPalaceCard(props: {
  row: ZiweiPatternPalaceSummaryRow
  selected: boolean
  onSelect: () => void
}) {
  const visibleEntries = props.row.entries.slice(0, 4)
  const overflowCount = Math.max(props.row.entries.length - visibleEntries.length, 0)

  return (
    <article
      className={
        props.selected
          ? `${styles.patternPalaceCard} ${styles.patternPalaceCardSelected}`
          : styles.patternPalaceCard
      }
    >
      <button
        className={styles.patternPalaceHeader}
        onClick={props.onSelect}
        type="button"
      >
        <strong>
          {props.row.sectorLabel} {props.row.palaceStemLabel}
          {props.row.branchLabel}
        </strong>
        <span>{props.row.entries.length} 格</span>
      </button>

      <div className={styles.badges}>
        {props.row.isLifePalace ? <span className={styles.badge}>命宫</span> : null}
        {props.row.isBodyPalace ? <span className={styles.badge}>身宫</span> : null}
        <span className={styles.badge}>命中 {props.row.hitCount}</span>
        <span className={styles.badge}>破格 {props.row.brokenCount}</span>
        <span className={styles.badge}>缺口 {props.row.gapCount}</span>
      </div>

      {props.row.entries.length > 0 ? (
        <div className={styles.patternPalaceEntryList}>
          {visibleEntries.map((entry) => (
            <div className={styles.patternPalaceEntry} key={entry.patternId}>
              <strong>{entry.label}</strong>
              <span>
                {entry.categoryLabel} / {entry.statusLabel} / {entry.strengthLabel}
              </span>
            </div>
          ))}
          {overflowCount > 0 ? (
            <span className={styles.patternPalaceOverflow}>
              另有 {overflowCount} 条格局关联
            </span>
          ) : null}
        </div>
      ) : (
        <p className={styles.patternPalaceEmpty}>当前未形成可定位格局关联</p>
      )}
    </article>
  )
}
