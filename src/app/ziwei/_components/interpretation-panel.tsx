import type { ReactNode } from "react"
import type {
  BranchPalace,
  ZiweiChartInterpretation,
  ZiweiInterpretationItem
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

export function InterpretationPanel(props: {
  interpretation: ZiweiChartInterpretation
  selectedBranch: BranchPalace
}) {
  const palaceInterpretation = props.interpretation.palaceInterpretations.find(
    (palace) => {
      return palace.branch === props.selectedBranch
    }
  )
  const palaceItems = palaceInterpretation?.items ?? []
  const sourceRuleIds = collectSourceRuleIds(palaceItems)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>解释层</h2>
        <p className={styles.metaText}>
          {props.interpretation.debug.totalItems} 条
        </p>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.interpretationList}>
          <InterpretationSection
            meta={`${props.interpretation.debug.generatedBy} · ${props.interpretation.chartHighlights.length} 条`}
            title="整盘摘要"
          >
            {props.interpretation.chartHighlights.map((item) => (
              <InterpretationItemCard item={item} key={item.itemId} />
            ))}
          </InterpretationSection>

          {palaceInterpretation ? (
            <InterpretationSection
              meta={`${palaceItems.length} 条`}
              title={`${palaceInterpretation.sectorLabel} · ${palaceInterpretation.branchLabel}`}
            >
              {palaceItems.map((item) => (
                <InterpretationItemCard item={item} key={item.itemId} />
              ))}
            </InterpretationSection>
          ) : null}

          <InterpretationSection
            meta={`${sourceRuleIds.length} 条`}
            title="规则来源追踪"
          >
            {sourceRuleIds.length > 0 ? (
              <div className={styles.ruleCodeList}>
                {sourceRuleIds.map((ruleId) => (
                  <code className={styles.ruleCode} key={ruleId}>
                    {ruleId}
                  </code>
                ))}
              </div>
            ) : (
              <p className={styles.metaText}>
                当前宫位暂无规则来源；整盘摘要类条目通常不绑定安星规则。
              </p>
            )}
          </InterpretationSection>
        </div>
      </div>
    </section>
  )
}

function InterpretationSection(props: {
  title: string
  meta: string
  children: ReactNode
}) {
  return (
    <section className={styles.interpretationSection}>
      <div className={styles.interpretationSectionHeader}>
        <h3 className={styles.detailSectionTitle}>{props.title}</h3>
        <span className={styles.metaText}>{props.meta}</span>
      </div>
      <div className={styles.interpretationGroup}>{props.children}</div>
    </section>
  )
}

function InterpretationItemCard(props: {
  item: ZiweiInterpretationItem
}) {
  return (
    <article className={styles.interpretationItem}>
      <h4 className={styles.interpretationTitle}>{props.item.title}</h4>
      <p className={styles.interpretationSummary}>{props.item.summary}</p>
      <TagList tags={props.item.tags} />
      {props.item.sourceRuleIds.length > 0 ? (
        <div className={styles.ruleCodeList}>
          {props.item.sourceRuleIds.map((ruleId) => (
            <code className={styles.ruleCode} key={ruleId}>
              {ruleId}
            </code>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function TagList(props: {
  tags: string[]
}) {
  if (props.tags.length === 0) {
    return null
  }

  return (
    <div className={styles.tagList}>
      {props.tags.map((tag) => (
        <span className={styles.badge} key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function collectSourceRuleIds(items: ZiweiInterpretationItem[]): string[] {
  return Array.from(
    new Set(items.flatMap((item) => item.sourceRuleIds))
  )
}
