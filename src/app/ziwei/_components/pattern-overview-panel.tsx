"use client"

import { useMemo, useState } from "react"

import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import {
  ZIWEI_PATTERN_CATEGORY_LABELS,
  buildZiweiPatternMatches,
  summarizeZiweiPatterns,
  type ZiweiPatternCategory,
  type ZiweiPatternStatus
} from "../_lib/ziwei-pattern-catalog"
import { buildZiweiPatternExplanation } from "../_lib/ziwei-pattern-explanation"
import { buildZiweiPatternDetailedAnalysis } from "../_lib/ziwei-pattern-detailed-analysis"
import type { PatternFilterValue } from "../_lib/ziwei-pattern-filter"
import {
  getZiweiPatternPriorityLabel,
  sortZiweiPatternMatchesByPriority
} from "../_lib/ziwei-pattern-priority"

const STATUS_LABELS: Record<ZiweiPatternStatus, string> = {
  hit: "命中",
  miss: "未命中",
  pending: "待校准"
}

const STATUS_FILTER_OPTIONS: {
  value: PatternFilterValue
  label: string
}[] = [
  { value: "all", label: "盘中结果" },
  { value: "hit", label: "命中" },
  { value: "enhanced", label: "加吉增强" },
  { value: "broken", label: "煞忌破格" }
]

const CATEGORY_FILTER_OPTIONS: {
  value: PatternFilterValue
  label: string
}[] = Object.entries(ZIWEI_PATTERN_CATEGORY_LABELS).map(([category, label]) => {
  return {
    value: `category:${category as ZiweiPatternCategory}`,
    label
  }
})

type PatternDictionaryMode = "body" | "condition" | "breakage" | "evidence" | "placement"

const PATTERN_DICTIONARY_MODE_OPTIONS: Array<{
  mode: PatternDictionaryMode
  label: string
}> = [
  { mode: "body", label: "格局本体" },
  { mode: "condition", label: "成格条件" },
  { mode: "breakage", label: "破格条件" },
  { mode: "evidence", label: "命中证据" },
  { mode: "placement", label: "盘中位置" }
]

export function PatternOverviewPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  scopeLabel: string
  selectedFilter: PatternFilterValue
  onFilterChange: (filter: PatternFilterValue) => void
  onSelectBranch?: (branch: ZiweiPalaceDetailView["branch"]) => void
  onOpenCatalog?: () => void
}) {
  const [selectedMode, setSelectedMode] =
    useState<PatternDictionaryMode>("body")
  const matches = useMemo(() => {
    return buildZiweiPatternMatches(props.palaces)
  }, [props.palaces])
  const summary = useMemo(() => summarizeZiweiPatterns(matches), [matches])
  const visibleMatches = useMemo(() => {
    return matches.filter((match) => {
      return match.status === "hit"
    })
  }, [matches])
  const visibleCategoryCount = useMemo(() => {
    return new Set(
      visibleMatches.map((match) => {
        return match.category
      })
    ).size
  }, [visibleMatches])
  const visibleEnhancedCount = visibleMatches.filter((match) => {
    return match.strength === "enhanced"
  }).length
  const visibleBrokenCount = visibleMatches.filter((match) => {
    return match.strength === "broken"
  }).length
  const visibleAdverseCount = visibleMatches.filter((match) => {
    return match.category === "adverse" || match.category === "malefic"
  }).length
  const filteredMatches = useMemo(() => {
    return sortZiweiPatternMatchesByPriority(
      visibleMatches.filter((match) => {
        if (props.selectedFilter === "all") {
          return true
        }

        if (props.selectedFilter === "hit") {
          return true
        }

        if (
          props.selectedFilter === "enhanced" ||
          props.selectedFilter === "broken"
        ) {
          return match.strength === props.selectedFilter
        }

        if (props.selectedFilter === "miss") {
          return false
        }

        return match.category === props.selectedFilter.replace("category:", "")
      })
    )
  }, [props.selectedFilter, visibleMatches])

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>盘中格局结果</h2>
        <span className={styles.metaText}>
          {formatPatternScopeLabel(props.scopeLabel)} · {summary.hitCount} 命中
        </span>
      </div>
      <div className={styles.panelBody}>
        <section className={styles.patternExplanation}>
          <div className={styles.patternExplanationHeader}>
            <strong>格局解释边界</strong>
            <span>只显示命中</span>
          </div>
          <p>
            总格局字典用于保存所有格局的本体解释、成格条件、破格条件和复核边界；当前这里是盘中格局结果，只显示本盘实际命中的格局。
          </p>
          <ul className={styles.patternExplanationList}>
            <li>格局本体解释只说明这个格局本身是什么，不代表当前命盘一定形成。</li>
            <li>盘中结果解释必须结合当前整张盘的命宫、三方四正、同宫星曜、四化、庙旺落陷和动态盘层。</li>
            <li>未命中的格局不在这里展示，避免把资料字典误当成当前盘结论。</li>
          </ul>
        </section>

        <div className={styles.patternSummaryGrid}>
          <div className={styles.dynamicFact}>
            <span>盘中结果</span>
            <strong>{visibleMatches.length}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>已命中</span>
            <strong>{summary.hitCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>加吉增强</span>
            <strong>{visibleEnhancedCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>煞忌破格</span>
            <strong>{visibleBrokenCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>凶格命中</span>
            <strong>{visibleAdverseCount}</strong>
          </div>
          <div className={styles.dynamicFact}>
            <span>分类</span>
            <strong>{visibleCategoryCount}</strong>
          </div>
        </div>

        <div className={styles.patternFilterGrid}>
          {[...STATUS_FILTER_OPTIONS, ...CATEGORY_FILTER_OPTIONS].map(
            (option) => (
              <button
                aria-pressed={props.selectedFilter === option.value}
                className={`${styles.patternFilterButton} ${
                  props.selectedFilter === option.value
                    ? styles.patternFilterButtonActive
                    : ""
                }`}
                key={option.value}
                onClick={() => props.onFilterChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            )
          )}
        </div>

        <div className={styles.patternDictionaryModeTabs}>
          {PATTERN_DICTIONARY_MODE_OPTIONS.map((option) => (
            <button
              aria-pressed={selectedMode === option.mode}
              className={
                selectedMode === option.mode
                  ? `${styles.patternDictionaryModeTab} ${styles.patternDictionaryModeTabActive}`
                  : styles.patternDictionaryModeTab
              }
              key={option.mode}
              onClick={() => setSelectedMode(option.mode)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.patternStack}>
          <section className={styles.patternSection}>
            <h3>
              {formatPatternScopeLabel(props.scopeLabel)}：{filteredMatches.length} 条
            </h3>
            {filteredMatches.length > 0 ? (
              <div className={styles.patternList}>
                {filteredMatches.map((match) => (
                  <PatternCard
                    key={match.id}
                    match={match}
                    selectedMode={selectedMode}
                    scopeLabel={props.scopeLabel}
                    onOpenCatalog={props.onOpenCatalog}
                    onSelectBranch={props.onSelectBranch}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.metaText}>当前盘层没有命中的格局结果。</p>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

function PatternCard(props: {
  match: ReturnType<typeof buildZiweiPatternMatches>[number]
  selectedMode: PatternDictionaryMode
  scopeLabel: string
  onSelectBranch?: (branch: ZiweiPalaceDetailView["branch"]) => void
  onOpenCatalog?: () => void
}) {
  const explanation = buildZiweiPatternExplanation(props.match)
  const detailedAnalysis = buildZiweiPatternDetailedAnalysis(props.match)

  return (
    <article
      className={`${styles.patternCard} ${getStatusClassName(
        props.match.status
      )} ${getStrengthClassName(props.match.strength)} ${getCategoryClassName(
        props.match.category
      )}`}
    >
      <div className={styles.patternHeader}>
        <span>
          <strong>{props.match.label}</strong>
          <small>
            {formatPatternScopeLabel(props.scopeLabel)} · {props.match.categoryLabel}
          </small>
        </span>
        <em>{`${STATUS_LABELS[props.match.status]} · ${getZiweiPatternPriorityLabel(
          props.match
        )}`}</em>
      </div>

      {props.selectedMode === "body" ? (
        <section
          className={`${styles.patternExplanation} ${getExplanationClassName(
            explanation.tone
          )}`}
        >
          <div className={styles.patternExplanationHeader}>
            <strong>格局本体</strong>
            <span>{props.match.strengthLabel}</span>
          </div>
          <p>{explanation.headline}</p>
          <ul className={styles.patternExplanationList}>
            <li>总字典解释：只说明{props.match.label}这个格局的本体含义。</li>
            <li>
              盘中解释：当前仅因本盘命中{props.match.label}，才结合整盘证据展开分析。
            </li>
            {explanation.focusLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.selectedMode === "condition" ? (
        <>
          <div className={styles.patternStrengthLine}>
            <strong>{props.match.strengthLabel}</strong>
            <span>{props.match.strengthReasonLines.join(" / ")}</span>
          </div>
          <p className={styles.patternCondition}>{props.match.conditionText}</p>
          <section className={styles.patternExplanation}>
            <div className={styles.patternExplanationHeader}>
              <strong>成格条件</strong>
              <span>{props.match.categoryLabel}</span>
            </div>
            <ul className={styles.patternExplanationList}>
              {detailedAnalysis.structureLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {props.selectedMode === "breakage" ? (
        <section
          className={`${styles.patternExplanation} ${getExplanationClassName(
            detailedAnalysis.tone === "adverse" ? "adverse" : "neutral"
          )}`}
        >
          <div className={styles.patternExplanationHeader}>
            <strong>破格条件</strong>
            <span>{props.match.strength === "broken" ? "已触发" : "复核"}</span>
          </div>
          <ul className={styles.patternExplanationList}>
            {[...detailedAnalysis.breakLines, ...explanation.reviewLines].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.selectedMode === "evidence" ? (
        <section
          className={`${styles.patternExplanation} ${getExplanationClassName(
            detailedAnalysis.tone === "adverse"
              ? "adverse"
              : detailedAnalysis.tone === "favorable"
                ? "favorable"
                : "neutral"
          )}`}
        >
          <div className={styles.patternExplanationHeader}>
            <strong>命中证据</strong>
            <span>{props.match.status === "hit" ? "已命中" : "未成格"}</span>
          </div>
          <p>{detailedAnalysis.statusLine}</p>
          <ul className={styles.patternExplanationList}>
            {[
              ...props.match.evidenceLines,
              ...detailedAnalysis.effectLines,
              ...detailedAnalysis.reviewLines,
              explanation.sourceLine
            ].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.match.starLabels.length > 0 ? (
        <div className={styles.starList}>
          {props.match.starLabels.map((label) => (
            <span className={styles.starPill} key={label}>
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {props.selectedMode === "placement" ? (
        <dl className={styles.patternFacts}>
          <div>
            <dt>宫位</dt>
            <dd>
              {props.match.matchedPalaces.length > 0 ? (
                <span className={styles.patternActionRow}>
                  {props.match.matchedPalaces.map((palace) => (
                    <button
                      className={styles.patternMiniButton}
                      key={palace.branch}
                      onClick={() => props.onSelectBranch?.(palace.branch)}
                      type="button"
                    >
                      {palace.label}
                    </button>
                  ))}
                </span>
              ) : (
                "未形成"
              )}
            </dd>
          </div>
          <div>
            <dt>规则</dt>
            <dd>
              {props.match.sourceRuleIds.length > 0
                ? props.match.sourceRuleIds.join(" / ")
                : props.match.status === "pending"
                  ? "待补条件"
                  : "无命中来源"}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className={styles.patternActionRow}>
        <button
          className={styles.patternMiniButton}
          onClick={props.onOpenCatalog}
          type="button"
        >
          查看资料总表
        </button>
      </div>
    </article>
  )
}

function getExplanationClassName(
  tone: ReturnType<typeof buildZiweiPatternExplanation>["tone"]
): string {
  if (tone === "adverse") {
    return styles.patternExplanationAdverse
  }

  if (tone === "favorable") {
    return styles.patternExplanationFavorable
  }

  return styles.patternExplanationNeutral
}

function formatPatternScopeLabel(scopeLabel: string): string {
  if (scopeLabel === "本命" || scopeLabel === "原盘") {
    return "原盘格局"
  }

  return `${scopeLabel}格局`
}

function getStatusClassName(status: ZiweiPatternStatus): string {
  if (status === "hit") {
    return styles.patternCardHit
  }

  if (status === "pending") {
    return styles.patternCardPending
  }

  return styles.patternCardMiss
}

function getCategoryClassName(
  category: ReturnType<typeof buildZiweiPatternMatches>[number]["category"]
): string {
  if (category === "adverse" || category === "malefic") {
    return styles.patternCardAdverse
  }

  return ""
}

function getStrengthClassName(
  strength: ReturnType<typeof buildZiweiPatternMatches>[number]["strength"]
): string {
  if (strength === "enhanced") {
    return styles.patternCardEnhanced
  }

  if (strength === "broken") {
    return styles.patternCardBroken
  }

  if (strength === "review") {
    return styles.patternCardReview
  }

  return ""
}
