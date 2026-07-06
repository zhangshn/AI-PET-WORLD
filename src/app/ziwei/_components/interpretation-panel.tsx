import type { ReactNode } from "react"
import type {
  BranchPalace,
  ZiweiChartInterpretation,
  ZiweiDetailedDynamicFlowAnalysis,
  ZiweiDetailedPalaceAnalysis,
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
  const detailedAnalysis = props.interpretation.detailedAnalysis
  const selectedPalaceAnalysis = detailedAnalysis.palaceAnalyses.find((palace) => {
    return palace.branch === props.selectedBranch
  })

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
            meta={`${detailedAnalysis.palaceAnalyses.length} 宫`}
            title="正统整盘详细分析"
          >
            <DetailedLineGroup
              title="整盘总论"
              lines={detailedAnalysis.overviewLines}
            />
            <DetailedLineGroup
              title="命宫主轴"
              lines={detailedAnalysis.lifePalaceLines}
            />
            <DetailedLineGroup
              title="身宫承接"
              lines={detailedAnalysis.bodyPalaceLines}
            />
          </InterpretationSection>

          {selectedPalaceAnalysis ? (
            <InterpretationSection
              meta={`${selectedPalaceAnalysis.starCount} 星`}
              title={`当前宫位细断 · ${selectedPalaceAnalysis.sectorLabel}${selectedPalaceAnalysis.branchLabel}`}
            >
              <DetailedPalaceAnalysisCard palace={selectedPalaceAnalysis} />
            </InterpretationSection>
          ) : null}

          <InterpretationSection
            meta={`${detailedAnalysis.palaceAnalyses.length} 宫`}
            title="十二宫逐宫分析"
          >
            {detailedAnalysis.palaceAnalyses.map((palace) => (
              <DetailedPalaceAnalysisCard
                key={`${palace.branch}-${palace.sectorName}`}
                palace={palace}
              />
            ))}
          </InterpretationSection>

          {detailedAnalysis.dynamicFlowAnalyses.length > 0 ? (
            <InterpretationSection
              meta={`${detailedAnalysis.dynamicFlowAnalyses.length} 层`}
              title="动态盘层分析"
            >
              {detailedAnalysis.dynamicFlowAnalyses.map((flow) => (
                <DetailedDynamicFlowCard
                  flow={flow}
                  key={`${flow.type}-${flow.palace}`}
                />
              ))}
            </InterpretationSection>
          ) : null}

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
            title="证据追踪"
          >
            <p className={styles.metaText}>
              {sourceRuleIds.length > 0
                ? `当前宫位已有${sourceRuleIds.length}条安星与解释证据，内部保留追踪编号，页面只展示中文分析。`
                : "当前宫位暂无可追踪证据；整盘摘要类条目通常不绑定安星规则。"}
            </p>
          </InterpretationSection>
        </div>
      </div>
    </section>
  )
}

function DetailedPalaceAnalysisCard(props: {
  palace: ZiweiDetailedPalaceAnalysis
}) {
  const title = `${props.palace.sectorLabel}${props.palace.branchLabel}`
  const roleText =
    props.palace.palaceRoles.length > 0
      ? ` · ${props.palace.palaceRoles.join("、")}`
      : ""

  return (
    <article className={styles.interpretationItem}>
      <h4 className={styles.interpretationTitle}>
        {title}
        {roleText}
      </h4>
      <DetailedLineGroup title="本宫主题" lines={props.palace.palaceThemeLines} />
      <DetailedLineGroup title="星曜分类" lines={props.palace.categorySummaryLines} />
      <DetailedLineGroup title="同宫组合" lines={props.palace.combinationLines} />
      <DetailedLineGroup title="主星主轴" lines={props.palace.mainAxisLines} />
      <DetailedLineGroup title="辅曜助力" lines={props.palace.supportLines} />
      <DetailedLineGroup title="煞忌压力" lines={props.palace.pressureLines} />
      <DetailedLineGroup title="四化动态" lines={props.palace.dynamicLines} />
      <DetailedLineGroup title="杂曜细节" lines={props.palace.detailLines} />
      <DetailedLineGroup title="庙旺落陷" lines={props.palace.brightnessLines} />
      <DetailedLineGroup title="三方四正" lines={props.palace.relationLines} />
      <DetailedLineGroup
        title="三方组合"
        lines={props.palace.trineSquareCombinationLines}
      />
      <DetailedLineGroup title="复核要点" lines={props.palace.reviewGapLines} />
      {props.palace.starAnalyses.length > 0 ? (
        <div className={styles.detailedAnalysisSubGrid}>
          {props.palace.starAnalyses.map((star) => (
            <DetailedLineGroup
              key={`${props.palace.branch}-${star.starId}-${star.label}`}
              title={`${star.label} · ${star.categoryLabel}`}
              lines={star.analysisLines}
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}

function DetailedDynamicFlowCard(props: {
  flow: ZiweiDetailedDynamicFlowAnalysis
}) {
  return (
    <article className={styles.interpretationItem}>
      <h4 className={styles.interpretationTitle}>
        {props.flow.typeLabel} · {props.flow.sectorLabel}
        {props.flow.branchLabel}
      </h4>
      <DetailedLineGroup title="流层总览" lines={props.flow.overviewLines} />
      <DetailedLineGroup title="落宫解释" lines={props.flow.palaceLines} />
      <DetailedLineGroup title="流星落点" lines={props.flow.flowingStarLines} />
      <DetailedLineGroup title="年系十二神" lines={props.flow.annualCycleLines} />
      <DetailedLineGroup title="四化触发" lines={props.flow.transformationLines} />
      <DetailedLineGroup title="复核要点" lines={props.flow.reviewLines} />
    </article>
  )
}

function DetailedLineGroup(props: {
  title: string
  lines: string[]
}) {
  if (props.lines.length === 0) {
    return null
  }

  return (
    <section className={styles.detailedAnalysisGroup}>
      <h5>{props.title}</h5>
      <ul>
        {props.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
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
