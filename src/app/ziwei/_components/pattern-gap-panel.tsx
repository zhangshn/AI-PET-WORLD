import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { buildZiweiPatternMatches } from "../_lib/ziwei-pattern-catalog"
import type { PatternFilterValue } from "../_lib/ziwei-pattern-filter"
import {
  buildZiweiPatternGaps,
  summarizeZiweiPatternGaps,
  type ZiweiPatternGapView
} from "../_lib/ziwei-pattern-gaps"

export function PatternGapPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  onSelectPatternFilter?: (filter: PatternFilterValue) => void
}) {
  const gaps = buildZiweiPatternGaps(buildZiweiPatternMatches(props.palaces))
  const summary = summarizeZiweiPatternGaps(gaps)
  const groups = groupGapsByCategory(gaps)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>格局缺口校准</h2>
        <span className={styles.metaText}>{summary.totalCount} 条缺口</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.patternGapSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>缺口总数</span>
            <strong>{summary.totalCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>未成格</span>
            <strong>{summary.missCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>待校准</span>
            <strong>{summary.pendingCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>缺失星曜</span>
            <strong>{summary.missingStarCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>来源规则</span>
            <strong>{summary.sourceRuleCount}</strong>
          </div>
        </div>

        <div className={styles.patternGapGroupStack}>
          {groups.map((group) => (
            <section className={styles.patternGapGroup} key={group.label}>
              <div className={styles.patternGapGroupHeader}>
                <button
                  className={styles.inlineTextButton}
                  onClick={() => {
                    props.onSelectPatternFilter?.(`category:${group.category}`)
                  }}
                  type="button"
                >
                  {group.label}
                </button>
                <span>{group.gaps.length} 条</span>
              </div>
              <div className={styles.patternGapList}>
                {group.gaps.map((gap) => (
                  <PatternGapCard gap={gap} key={gap.patternId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function PatternGapCard(props: {
  gap: ZiweiPatternGapView
}) {
  return (
    <article className={styles.patternGapCard}>
      <div className={styles.patternGapCardHeader}>
        <strong>{props.gap.label}</strong>
        <span>{props.gap.statusLabel}</span>
      </div>
      <dl className={styles.patternGapFacts}>
        <div>
          <dt>条件</dt>
          <dd>{props.gap.conditionText}</dd>
        </div>
        <div>
          <dt>缺星</dt>
          <dd>
            {props.gap.missingStarLabels.length > 0
              ? props.gap.missingStarLabels.join(" / ")
              : "无全盘缺星，需复核宫位、同宫、夹拱或三方四正条件"}
          </dd>
        </div>
        <div>
          <dt>证据</dt>
          <dd>{props.gap.evidenceLines.join(" / ")}</dd>
        </div>
        <div>
          <dt>宫位</dt>
          <dd>
            {props.gap.matchedPalaceLabels.length > 0
              ? props.gap.matchedPalaceLabels.join(" / ")
              : "未形成可定位宫位"}
          </dd>
        </div>
        <div>
          <dt>复核</dt>
          <dd>{props.gap.reviewLines.join(" / ")}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>
            {props.gap.sourceRuleIds.length > 0
              ? props.gap.sourceRuleIds.join(" / ")
              : "待补来源或当前无命中来源"}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function groupGapsByCategory(gaps: ZiweiPatternGapView[]): {
  category: ZiweiPatternGapView["category"]
  label: string
  gaps: ZiweiPatternGapView[]
}[] {
  const groups = new Map<ZiweiPatternGapView["category"], ZiweiPatternGapView[]>()

  gaps.forEach((gap) => {
    groups.set(gap.category, [...(groups.get(gap.category) ?? []), gap])
  })

  return Array.from(groups, ([category, groupGaps]) => {
    return {
      category,
      label: groupGaps[0]?.categoryLabel ?? category,
      gaps: groupGaps
    }
  })
}
