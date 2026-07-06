"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import type {
  ZiweiStarCategory,
  ZiweiStarDictionaryEntryView
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

type DictionaryMode = "body" | "palace" | "combination" | "boundary" | "placement"

const DICTIONARY_MODE_OPTIONS: Array<{
  mode: DictionaryMode
  label: string
}> = [
  { mode: "body", label: "星曜本体" },
  { mode: "palace", label: "入宫解释" },
  { mode: "combination", label: "组合解释" },
  { mode: "boundary", label: "读盘边界" },
  { mode: "placement", label: "盘中位置" }
]

export function StarDictionaryModal(props: {
  entries: ZiweiStarDictionaryEntryView[]
  open: boolean
  onClose: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | ZiweiStarCategory>(
    "all"
  )
  const [selectedMode, setSelectedMode] = useState<DictionaryMode>("body")
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const categoryOptions = useMemo(() => {
    return buildCategoryOptions(props.entries)
  }, [props.entries])
  const visibleEntries = useMemo(() => {
    return filterEntries({
      entries: props.entries,
      selectedCategory,
      query
    })
  }, [props.entries, query, selectedCategory])
  const selectedEntry = useMemo(() => {
    return (
      visibleEntries.find((entry) => entry.starId === selectedStarId) ??
      visibleEntries[0] ??
      null
    )
  }, [selectedStarId, visibleEntries])

  if (!props.open) {
    return null
  }

  return (
    <div className={styles.dictionaryOverlay} role="presentation">
      <section
        aria-modal="true"
        className={styles.dictionaryDialog}
        role="dialog"
      >
        <header className={styles.dictionaryHeader}>
          <div>
            <p className={styles.dictionaryEyebrow}>星曜数据字典</p>
            <h2>星曜本体解释</h2>
            <span>
              {visibleEntries.length} / {props.entries.length} 项
            </span>
          </div>
          <button
            className={styles.dictionaryCloseButton}
            type="button"
            onClick={props.onClose}
          >
            关闭
          </button>
        </header>

        <div className={styles.dictionaryFilters}>
          <label className={styles.field}>
            <span className={styles.label}>分类</span>
            <select
              className={styles.select}
              value={selectedCategory}
              onChange={(event) => {
                setSelectedCategory(event.target.value as "all" | ZiweiStarCategory)
              }}
            >
              <option value="all">全部星曜</option>
              {categoryOptions.map((option) => (
                <option key={option.category} value={option.category}>
                  {option.label}（{option.count}）
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>搜索</span>
            <input
              className={styles.input}
              placeholder="输入星名、分类、标签或解释关键词"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <button
            className={styles.secondaryButton}
            disabled={selectedCategory === "all" && query.trim().length === 0}
            type="button"
            onClick={() => {
              setSelectedCategory("all")
              setQuery("")
            }}
          >
            清空
          </button>
        </div>

        <div className={styles.dictionaryModeTabs}>
          {DICTIONARY_MODE_OPTIONS.map((option) => (
            <button
              className={
                selectedMode === option.mode
                  ? `${styles.dictionaryModeTab} ${styles.dictionaryModeTabActive}`
                  : styles.dictionaryModeTab
              }
              key={option.mode}
              type="button"
              onClick={() => setSelectedMode(option.mode)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.dictionaryBody}>
          <aside className={styles.dictionaryIndex} aria-label="星曜列表">
            {visibleEntries.length > 0 ? (
              visibleEntries.map((entry) => (
                <button
                  className={
                    selectedEntry?.starId === entry.starId
                      ? `${styles.dictionaryIndexButton} ${styles.dictionaryIndexButtonActive}`
                      : styles.dictionaryIndexButton
                  }
                  key={entry.starId}
                  type="button"
                  onClick={() => setSelectedStarId(entry.starId)}
                >
                  <strong>{entry.label}</strong>
                  <span>{entry.categoryLabel}</span>
                </button>
              ))
            ) : (
              <p className={styles.dictionaryPending}>没有匹配的星曜。</p>
            )}
          </aside>

          <div className={styles.dictionaryDetailPane}>
            {selectedEntry ? (
              <article className={styles.dictionaryCard} key={selectedEntry.starId}>
              <div className={styles.dictionaryCardHeader}>
                <div>
                  <h3>{selectedEntry.label}</h3>
                  <span>{selectedEntry.categoryLabel}</span>
                </div>
              </div>

              <p className={styles.dictionarySummary}>{selectedEntry.summary}</p>

              <div className={styles.dictionaryTagRow}>
                {selectedEntry.tags.map((tag) => (
                  <span className={styles.badge} key={tag}>
                    {tag}
                  </span>
                ))}
              </div>

              {selectedEntry.detail ? (
                <>
                  {selectedMode === "body" ? (
                    <DictionarySection title="星曜本体解释">
                      <p className={styles.dictionaryLongText}>
                        {selectedEntry.detail.extendedOverview}
                      </p>
                      <div className={styles.dictionaryLongSectionList}>
                        {selectedEntry.detail.extendedSections.map((section) => (
                          <div
                            className={styles.dictionaryLongSection}
                            key={`${selectedEntry.starId}-${section.title}`}
                          >
                            <h5>{section.title}</h5>
                            {section.items.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className={styles.dictionaryDetailGrid}>
                        <DictionaryFact label="资料来源" value={selectedEntry.detail.sourceLabel} />
                        <DictionaryFact label="阴阳" value={selectedEntry.detail.yinYangLabel} />
                        <DictionaryFact label="五行" value={selectedEntry.detail.elementLabel} />
                        <DictionaryList label="别名索引" values={selectedEntry.detail.aliases} />
                        <DictionaryList label="身份定位" values={selectedEntry.detail.identity} />
                        <DictionaryFact label="星性" value={selectedEntry.detail.nature} />
                        <DictionaryList
                          label="通用象义"
                          values={selectedEntry.detail.symbolicMeanings}
                        />
                        <DictionaryList label="核心主题" values={selectedEntry.detail.coreThemes} />
                        <DictionaryList label="优势" values={selectedEntry.detail.strengths} />
                        <DictionaryList label="风险" values={selectedEntry.detail.risks} />
                        <DictionaryList
                          label="喜见"
                          values={selectedEntry.detail.favorableSignals}
                        />
                        <DictionaryList
                          label="忌见"
                          values={selectedEntry.detail.unfavorableSignals}
                        />
                      </div>
                    </DictionarySection>
                  ) : null}

                  {selectedMode === "palace" ? (
                    <DictionarySection title="星曜入宫解释规则">
                      <DictionaryLongSections
                        sections={pickDictionarySections(
                          selectedEntry.detail.extendedSections,
                          [
                            "入十二宫前置原则",
                            "十二宫逐宫细则",
                            "庙旺落陷与状态判断"
                          ]
                        )}
                        starId={selectedEntry.starId}
                      />
                      <div className={styles.dictionaryDetailGrid}>
                        <DictionaryFact label="入宫观察" value={selectedEntry.detail.palaceFocus} />
                        <DictionaryList label="入宫用法" values={selectedEntry.detail.palaceUsage} />
                        <DictionaryList
                          label="庙旺用法"
                          values={selectedEntry.detail.brightnessUsage}
                        />
                      </div>
                    </DictionarySection>
                  ) : null}

                  {selectedMode === "combination" ? (
                    <DictionarySection title="星曜组合解释规则">
                      <DictionaryLongSections
                        sections={pickDictionarySections(
                          selectedEntry.detail.extendedSections,
                          [
                            "同宫会照与组合原则",
                            "常见固定组合专条",
                            "同宫组合细则",
                            "对宫与三方四正细则",
                            "动态盘层解释",
                            "流层组合细则"
                          ]
                        )}
                        starId={selectedEntry.starId}
                      />
                      <div className={styles.dictionaryDetailGrid}>
                        <DictionaryList
                          label="功能角色"
                          values={selectedEntry.detail.functionalRole}
                        />
                        <DictionaryList
                          label="组合用法"
                          values={selectedEntry.detail.combinationUsage}
                        />
                      </div>
                    </DictionarySection>
                  ) : null}

                  {selectedMode === "boundary" ? (
                    <DictionarySection title="整盘解释边界">
                      <DictionaryLongSections
                        sections={pickDictionarySections(
                          selectedEntry.detail.extendedSections,
                          ["读盘顺序", "资料来源与复核边界", "常见误读"]
                        )}
                        starId={selectedEntry.starId}
                      />
                      <div className={styles.dictionaryDetailGrid}>
                        <DictionaryList
                          label="读盘步骤"
                          values={selectedEntry.detail.interpretationSteps}
                        />
                        <DictionaryList label="常见误区" values={selectedEntry.detail.cautions} />
                        <DictionaryList
                          label="复用场景"
                          values={selectedEntry.detail.reusableScenes}
                        />
                        <DictionaryList label="读盘提示" values={selectedEntry.detail.readingNotes} />
                      </div>
                    </DictionarySection>
                  ) : null}
                </>
              ) : (
                <p className={styles.dictionaryPending}>
                  该星曜已有盘面索引，详细解释资料待补充。
                </p>
              )}

              {selectedMode === "placement" ? (
                <DictionarySection title="当前盘中出现位置">
                  {selectedEntry.placements.length > 0 ? (
                    <div className={styles.dictionaryPlacementList}>
                      {selectedEntry.placements.map((placement) => (
                        <div
                          className={styles.dictionaryPlacement}
                          key={`${selectedEntry.starId}-${placement.palaceLabel}-${placement.placementRuleId}`}
                        >
                          <header className={styles.dictionaryPlacementHeader}>
                            <strong>
                              {placement.palaceLabel} · {placement.sectorLabel}
                            </strong>
                            <span>{placement.brightnessLabel ?? "不论庙旺"}</span>
                          </header>
                          <PlacementParagraph title="落宫含义" text={placement.palaceMeaning} />
                          <PlacementParagraph title="本星解释" text={placement.starMeaning} />
                          <PlacementStarList
                            title="同宫组合"
                            emptyText="本宫无其他星曜直接同宫。"
                            values={placement.samePalaceStarLabels}
                          />
                          <PlacementStarList
                            title="对宫冲照"
                            emptyText="对宫暂无星曜证据。"
                            values={placement.oppositePalaceStarLabels}
                          />
                          <PlacementStarList
                            title="三方四正"
                            emptyText="三方四正暂无星曜证据。"
                            values={placement.trineSquareStarLabels}
                          />
                          <PlacementParagraph
                            title="组合意义"
                            text={placement.combinationMeaning}
                          />
                          <PlacementParagraph
                            title="三方四正解释"
                            text={placement.relationMeaning}
                          />
                          <PlacementParagraph
                            title="读盘边界"
                            text={placement.readingBoundary}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.dictionaryPending}>
                      当前盘未出现，仍保留为通用星曜资料。
                    </p>
                  )}
                </DictionarySection>
              ) : null}
            </article>
            ) : (
              <p className={styles.dictionaryPending}>请选择星曜查看详情。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function DictionarySection(props: { title: string; children: ReactNode }) {
  return (
    <section className={styles.dictionarySection}>
      <h4>{props.title}</h4>
      {props.children}
    </section>
  )
}

function DictionaryLongSections(props: {
  sections: Array<{ title: string; items: string[] }>
  starId: string
}) {
  if (props.sections.length === 0) {
    return null
  }

  return (
    <div className={styles.dictionaryLongSectionList}>
      {props.sections.map((section) => (
        <div
          className={styles.dictionaryLongSection}
          key={`${props.starId}-${section.title}`}
        >
          <h5>{section.title}</h5>
          {section.items.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ))}
    </div>
  )
}

function PlacementParagraph(props: { title: string; text: string }) {
  return (
    <div className={styles.dictionaryPlacementBlock}>
      <span>{props.title}</span>
      <p>{props.text}</p>
    </div>
  )
}

function PlacementStarList(props: {
  title: string
  values: string[]
  emptyText: string
}) {
  return (
    <div className={styles.dictionaryPlacementBlock}>
      <span>{props.title}</span>
      {props.values.length > 0 ? (
        <div className={styles.dictionaryPlacementStars}>
          {props.values.map((value) => (
            <em key={value}>{value}</em>
          ))}
        </div>
      ) : (
        <p>{props.emptyText}</p>
      )}
    </div>
  )
}

function DictionaryFact(props: { label: string; value: string }) {
  return (
    <div className={styles.dictionaryFact}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function pickDictionarySections(
  sections: Array<{ title: string; items: string[] }>,
  titles: string[]
): Array<{ title: string; items: string[] }> {
  const titleSet = new Set(titles)

  return sections.filter((section) => titleSet.has(section.title))
}

function DictionaryList(props: { label: string; values: string[] }) {
  return (
    <div className={styles.dictionaryFact}>
      <span>{props.label}</span>
      <strong>{props.values.join("、")}</strong>
    </div>
  )
}

function buildCategoryOptions(
  entries: ZiweiStarDictionaryEntryView[]
): Array<{
  category: ZiweiStarCategory
  label: string
  count: number
}> {
  const seen = new Map<ZiweiStarCategory, { label: string; count: number }>()

  entries.forEach((entry) => {
    const existing = seen.get(entry.category)
    seen.set(entry.category, {
      label: entry.categoryLabel,
      count: (existing?.count ?? 0) + 1
    })
  })

  return Array.from(seen.entries()).map(([category, option]) => {
    return {
      category,
      label: option.label,
      count: option.count
    }
  })
}

function filterEntries(params: {
  entries: ZiweiStarDictionaryEntryView[]
  selectedCategory: "all" | ZiweiStarCategory
  query: string
}): ZiweiStarDictionaryEntryView[] {
  const normalizedQuery = params.query.trim().toLowerCase()

  return params.entries.filter((entry) => {
    if (
      params.selectedCategory !== "all" &&
      entry.category !== params.selectedCategory
    ) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchableText = [
      entry.label,
      entry.starId,
      entry.categoryLabel,
      entry.summary,
      ...entry.tags,
      ...(entry.detail?.identity ?? []),
      ...(entry.detail?.symbolicMeanings ?? []),
      ...(entry.detail?.palaceUsage ?? []),
      ...(entry.detail?.combinationUsage ?? []),
      ...entry.placements.flatMap((placement) => [
        placement.palaceLabel,
        placement.sectorLabel,
        placement.placementRuleId ?? ""
      ])
    ]
      .join(" ")
      .toLowerCase()

    return searchableText.includes(normalizedQuery)
  })
}
