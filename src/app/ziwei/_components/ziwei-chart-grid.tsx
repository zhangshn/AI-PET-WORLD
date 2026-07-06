"use client"

import type { CSSProperties } from "react"
import type {
  BranchPalace,
  ZiweiChartMetaView,
  ZiweiDynamicDebugView,
  ZiweiDynamicFlowDetailView,
  ZiweiPalaceCellView,
  ZiweiPalaceDetailView,
  ZiweiPalaceRelationKind,
  ZiweiStarGroupView,
  ZiweiStarView
} from "@/ai/destiny-core/ziwei-core/contracts"

import {
  getZiweiPalaceGridArea,
  moveZiweiPhysicalBranch,
  ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS,
  ZIWEI_MOBILE_GRID_TEMPLATE_ROWS
} from "../_lib/ziwei-palace-layout"
import { isZiweiDynamicFlowWithinSelectedDepth } from "../_lib/ziwei-dynamic-flow-depth"
import type { ZiweiPatternPalaceSummaryRow } from "../_lib/ziwei-pattern-palace-summary"
import styles from "../_styles/ziwei-page.module.css"

type ZiweiChartGridStyle = CSSProperties & {
  "--ziwei-desktop-grid-areas": string
  "--ziwei-mobile-grid-areas": string
}

export function ZiweiChartGrid(props: {
  chartMeta: ZiweiChartMetaView
  dynamicDebug?: ZiweiDynamicDebugView
  dynamicFlows: ZiweiDynamicFlowDetailView[]
  palaces: ZiweiPalaceCellView[]
  palaceDetails: ZiweiPalaceDetailView[]
  patternPalaceRows: ZiweiPatternPalaceSummaryRow[]
  selectedBranch: BranchPalace
  selectedFlowType: ZiweiDynamicFlowDetailView["type"]
  totalStarCount: number
  onSelect: (branch: BranchPalace) => void
  onOpenStarDictionary: () => void
  onOpenInterpretation: () => void
}) {
  const selectedPalace = props.palaces.find((palace) => {
    return palace.branch === props.selectedBranch
  })
  const selectedPatternRow = props.patternPalaceRows.find((row) => {
    return row.branch === props.selectedBranch
  })
  const lifePalace = props.palaces.find((palace) => palace.isLifePalace)
  const bodyPalace = props.palaces.find((palace) => palace.isBodyPalace)
  const relationLines = buildRelationLines({
    palaceDetails: props.palaceDetails,
    sourceBranch: props.selectedBranch,
    sourceFlowType: props.selectedFlowType
  })
  const dynamicMarkersByBranch = buildDynamicMarkersByBranch({
    flows: props.dynamicFlows,
    selectedFlowType: props.selectedFlowType
  })
  const selectedDynamicStarsByBranch = buildSelectedDynamicStarsByBranch({
    flows: props.dynamicFlows,
    selectedFlowType: props.selectedFlowType
  })
  const selectedDynamicSectorMarkersByBranch =
    buildSelectedDynamicSectorMarkersByBranch({
      flows: props.dynamicFlows,
      selectedFlowType: props.selectedFlowType
    })
  const centerDynamicFlows = props.dynamicFlows.filter((flow) => {
    return (
      flow.type !== "natal" &&
      isZiweiDynamicFlowWithinSelectedDepth({
        selectedFlowType: props.selectedFlowType,
        targetFlowType: flow.type
      })
    )
  })
  const daYunRangesByBranch = buildDaYunRangesByBranch({
    debug: props.dynamicDebug,
    lifeBranch: lifePalace?.branch
  })
  const chartGridStyle: ZiweiChartGridStyle = {
    "--ziwei-desktop-grid-areas": formatGridTemplateAreas(
      ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS
    ),
    "--ziwei-mobile-grid-areas": formatGridTemplateAreas(
      ZIWEI_MOBILE_GRID_TEMPLATE_ROWS
    )
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>十二宫盘</h2>
        <div className={styles.panelHeaderActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={props.onOpenStarDictionary}
          >
            星曜字典
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={props.onOpenInterpretation}
          >
            盘面分析
          </button>
        </div>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.chartGrid} style={chartGridStyle}>
          <svg
            aria-hidden="true"
            className={styles.chartRelationOverlay}
            focusable="false"
            preserveAspectRatio="none"
            viewBox="0 0 4 4"
          >
            {relationLines.map((line) => (
              <line
                className={getRelationLineClassName(line)}
                key={`${line.sourceFlowType}-${line.kind}-${line.from}-${line.to}`}
                x1={line.fromPoint.x}
                y1={line.fromPoint.y}
                x2={line.toPoint.x}
                y2={line.toPoint.y}
              />
            ))}
          </svg>
          <div className={styles.chartCenter}>
            <span className={styles.centerLabel}>中宫</span>
            {selectedPalace ? (
              <div className={styles.centerBlock}>
                <span className={styles.centerTitle}>
                  {selectedPalace.sectorLabel} · {selectedPalace.palaceStemLabel}
                  {selectedPalace.branchLabel}
                </span>
                <span className={styles.centerMeta}>
                  {selectedPalace.starGroups.length} 组星曜 · 全盘 {props.totalStarCount} 颗
                </span>
                {selectedPatternRow ? (
                  <span className={styles.centerMeta}>
                    格局 {selectedPatternRow.entries.length} 条 · 破格{" "}
                    {selectedPatternRow.brokenCount} 条 · 凶格{" "}
                    {selectedPatternRow.adverseHitCount} 条
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className={styles.centerInfo}>
              <span>{props.chartMeta.inputSummary}</span>
              <span>{props.chartMeta.ruleSetVersion}</span>
            </div>
            <div className={styles.centerBadges}>
              {lifePalace ? (
                <span className={styles.badge}>原命 {lifePalace.branchLabel}</span>
              ) : null}
              {bodyPalace ? (
                <span className={styles.badge}>身 {bodyPalace.branchLabel}</span>
              ) : null}
              {centerDynamicFlows.map((flow) => (
                <span
                  className={
                    flow.type === props.selectedFlowType
                      ? `${styles.badge} ${styles.dynamicPalaceMarkerActive}`
                      : styles.badge
                  }
                  key={flow.type}
                >
                  {formatDynamicLifeMarkerLabel(flow)} {flow.branchLabel}
                </span>
              ))}
            </div>
          </div>

          {props.palaces.map((palace) => {
            const starCount = countPalaceStars(palace)
            const brightStarCount = countPalaceBrightStars(palace)
            const patternRow = props.patternPalaceRows.find((row) => {
              return row.branch === palace.branch
            })
            const dynamicMarkers =
              dynamicMarkersByBranch.get(palace.branch) ?? []
            const selectedDynamicStars =
              selectedDynamicStarsByBranch.get(palace.branch) ?? []
            const selectedDynamicSectorMarkers =
              selectedDynamicSectorMarkersByBranch.get(palace.branch) ?? []
            const visibleDynamicSectorMarkers = selectedDynamicSectorMarkers.slice(
              0,
              DYNAMIC_SECTOR_MARKER_DISPLAY_LIMIT
            )
            const hiddenDynamicSectorMarkerCount =
              selectedDynamicSectorMarkers.length -
              visibleDynamicSectorMarkers.length
            const visibleDynamicStars = selectedDynamicStars.slice(
              0,
              DYNAMIC_STAR_DISPLAY_LIMIT
            )
            const hiddenDynamicStarCount =
              selectedDynamicStars.length - visibleDynamicStars.length
            const daYunRange = daYunRangesByBranch.get(palace.branch)
            const hasPalaceTimeLayer =
              palace.isLifePalace ||
              palace.isBodyPalace ||
              dynamicMarkers.length > 0 ||
              selectedDynamicSectorMarkers.length > 0 ||
              selectedDynamicStars.length > 0

            return (
              <button
                key={palace.branch}
                className={`${styles.palaceCell} ${
                  props.selectedBranch === palace.branch
                    ? styles.palaceCellSelected
                    : ""
                }`}
                style={{
                  gridArea: getZiweiPalaceGridArea(palace.branch)
                }}
                type="button"
                onClick={() => props.onSelect(palace.branch)}
              >
                <div className={styles.palaceTop}>
                  <span className={styles.palaceName}>{palace.sectorLabel}</span>
                  <span className={styles.palaceBranch}>
                    {palace.palaceStemLabel}
                    {palace.branchLabel}
                  </span>
                </div>
                <div className={styles.palaceCellContent}>
                  <PalaceStarBoard groups={palace.starGroups} />
                </div>
                {hasPalaceTimeLayer ? (
                  <div className={styles.palaceTimeLayer}>
                    <div className={styles.palaceStaticMarkers}>
                      {palace.isLifePalace ? (
                        <span className={`${styles.badge} ${styles.natalPalaceMarker}`}>
                          原命
                        </span>
                      ) : null}
                      {palace.isBodyPalace ? (
                        <span className={styles.badge}>身</span>
                      ) : null}
                      {dynamicMarkers.map((marker) => (
                        <span
                          className={getDynamicPalaceMarkerClassName(marker)}
                          key={marker.type}
                        >
                          {marker.label}
                        </span>
                      ))}
                    </div>
                    {selectedDynamicSectorMarkers.length > 0 ? (
                      <div className={styles.dynamicSectorMarkers}>
                        {visibleDynamicSectorMarkers.map((marker) => (
                          <span
                            className={`${styles.dynamicSectorMarker} ${getDynamicPalaceMarkerToneClassName(
                              marker.type
                            )}`}
                            key={marker.label}
                          >
                            {marker.label}
                          </span>
                        ))}
                        {hiddenDynamicSectorMarkerCount > 0 ? (
                          <span className={styles.dynamicOverflowMarker}>
                            +{hiddenDynamicSectorMarkerCount}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedDynamicStars.length > 0 ? (
                      <div className={styles.palaceDynamicStars}>
                        {visibleDynamicStars.map((star) => (
                          <span
                            className={[
                              styles.dynamicPalaceMarker,
                              getDynamicPalaceMarkerToneClassName(
                                star.sourceFlowType
                              ),
                              getDynamicStarKindClassName(star.kind)
                            ].join(" ")}
                            key={`${star.sourceFlowType}-${star.starId}-${star.displayLabel}`}
                          >
                            {star.displayLabel}
                          </span>
                        ))}
                        {hiddenDynamicStarCount > 0 ? (
                          <span className={styles.dynamicOverflowMarker}>
                            +{hiddenDynamicStarCount}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.palaceFlowLines}>
                  {daYunRange ? (
                    <span>
                      {daYunRange.startAge}~{daYunRange.endAge}
                    </span>
                  ) : null}
                  <small>
                    {starCount}星 · {palace.starGroups.length}组 · {brightStarCount}
                    庙旺
                  </small>
                </div>
                <div className={styles.palaceBottom}>
                  <span
                    className={
                      patternRow && patternRow.brokenCount > 0
                        ? styles.palacePatternWarning
                        : patternRow && patternRow.adverseHitCount > 0
                          ? styles.palacePatternAdverse
                          : undefined
                    }
                  >
                    {patternRow?.entries.length ?? 0}格
                  </span>
                  <strong>{palace.sectorLabel}</strong>
                  <em>
                    {palace.palaceStemLabel}
                    {palace.branchLabel}
                  </em>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

interface RelationLine {
  sourceFlowType: ZiweiDynamicFlowDetailView["type"]
  kind: Extract<ZiweiPalaceRelationKind, "opposite" | "trine">
  from: BranchPalace
  to: BranchPalace
  fromPoint: ChartGridPoint
  toPoint: ChartGridPoint
}

interface DynamicPalaceMarker {
  type: ZiweiDynamicFlowDetailView["type"]
  label: string
  isSelected: boolean
}

interface DynamicSectorMarker {
  type: ZiweiDynamicFlowDetailView["type"]
  label: string
}

interface DaYunRangeMarker {
  startAge: number
  endAge: number
}

interface ChartGridPoint {
  x: number
  y: number
}

function PalaceStarBoard(props: {
  groups: ZiweiStarGroupView[]
}) {
  const mainStars = getStarsByCategory(props.groups, "main")
  const assistantStars = getStarsByCategory(props.groups, "assistant")
  const pressureStars = getStarsByCategories(props.groups, [
    "malefic",
    "transformation"
  ])
  const miscStars = getStarsByCategory(props.groups, "misc")
  const flowStars = getStarsByCategories(props.groups, [
    "lifecycle",
    "yearly",
    "monthly",
    "dailyHourly"
  ])

  if (props.groups.length === 0) {
    return <span className={styles.palaceStarEmpty}>本宫暂无星曜</span>
  }

  return (
    <div className={styles.palaceStarBoard}>
      <PalaceStarRow className={styles.palaceStarRowMain} stars={mainStars} />
      <PalaceStarRow
        className={styles.palaceStarRowAssistant}
        stars={assistantStars}
      />
      <PalaceStarRow
        className={styles.palaceStarRowPressure}
        stars={pressureStars}
      />
      <PalaceStarRow className={styles.palaceStarRowMisc} stars={miscStars} />
      <PalaceStarRow className={styles.palaceStarRowFlow} stars={flowStars} />
    </div>
  )
}

function PalaceStarRow(props: {
  className: string
  stars: ZiweiStarView[]
}) {
  if (props.stars.length === 0) {
    return null
  }

  return (
    <div className={`${styles.palaceStarRow} ${props.className}`}>
      {props.stars.map((star) => (
        <span
          className={`${styles.palaceStarToken} ${getPalaceStarTokenClassName(
            star
          )}`}
          key={`${star.source}-${star.starId}-${star.displayLabel}`}
        >
          <strong>{star.displayLabel}</strong>
          {shouldShowPalaceBrightness(star) ? (
            <em>{star.brightness?.label}</em>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function getStarsByCategory(
  groups: ZiweiStarGroupView[],
  category: ZiweiStarGroupView["category"]
): ZiweiStarView[] {
  return groups.flatMap((group) => {
    if (group.category === category) {
      return group.stars
    }

    return []
  })
}

function getStarsByCategories(
  groups: ZiweiStarGroupView[],
  categories: ZiweiStarGroupView["category"][]
): ZiweiStarView[] {
  return groups.flatMap((group) => {
    if (
      categories.some((category) => {
      return group.category === category
      })
    ) {
      return group.stars
    }

    return []
  })
}

function getPalaceStarTokenClassName(star: ZiweiStarView): string {
  if (star.category === "main") return styles.palaceStarTokenMain
  if (star.category === "assistant") return styles.palaceStarTokenAssistant
  if (star.category === "malefic") return styles.palaceStarTokenPressure
  if (star.category === "transformation") {
    return styles.palaceStarTokenTransformation
  }
  if (star.category === "misc") return styles.palaceStarTokenMisc
  return styles.palaceStarTokenFlow
}

function shouldShowPalaceBrightness(star: ZiweiStarView): boolean {
  return Boolean(
    star.category !== "transformation" &&
      star.brightness &&
      star.brightness.level !== "unmapped"
  )
}

const CHART_GRID_POINTS: Record<BranchPalace, ChartGridPoint> = {
  si: { x: 0.5, y: 0.5 },
  wu: { x: 1.5, y: 0.5 },
  wei: { x: 2.5, y: 0.5 },
  shen: { x: 3.5, y: 0.5 },
  chen: { x: 0.5, y: 1.5 },
  you: { x: 3.5, y: 1.5 },
  mao: { x: 0.5, y: 2.5 },
  xu: { x: 3.5, y: 2.5 },
  yin: { x: 0.5, y: 3.5 },
  chou: { x: 1.5, y: 3.5 },
  zi: { x: 2.5, y: 3.5 },
  hai: { x: 3.5, y: 3.5 }
}

const ZIWEI_DYNAMIC_SECTOR_ORDER: Array<ZiweiPalaceCellView["sectorName"]> = [
  "life",
  "siblings",
  "spouse",
  "children",
  "wealth",
  "health",
  "travel",
  "friends",
  "career",
  "property",
  "fortune",
  "parents"
]

const ZIWEI_DYNAMIC_SECTOR_LABELS: Record<
  ZiweiPalaceCellView["sectorName"],
  string
> = {
  life: "命",
  siblings: "兄弟",
  spouse: "夫妻",
  children: "子女",
  wealth: "财帛",
  health: "疾厄",
  travel: "迁移",
  friends: "交友",
  career: "官禄",
  property: "田宅",
  fortune: "福德",
  parents: "父母"
}

const DYNAMIC_SECTOR_MARKER_DISPLAY_LIMIT = 24
const DYNAMIC_STAR_DISPLAY_LIMIT = 48

function buildRelationLines(params: {
  palaceDetails: ZiweiPalaceDetailView[]
  sourceBranch: BranchPalace
  sourceFlowType: ZiweiDynamicFlowDetailView["type"]
}): RelationLine[] {
  const sourcePalace = params.palaceDetails.find((palace) => {
    return palace.branch === params.sourceBranch
  })

  if (!sourcePalace) {
    return []
  }

  return sourcePalace.relations
    .filter((relation): relation is typeof relation & {
      kind: RelationLine["kind"]
    } => {
      return relation.kind === "opposite" || relation.kind === "trine"
    })
    .map((relation) => {
      return {
        sourceFlowType: params.sourceFlowType,
        kind: relation.kind,
        from: params.sourceBranch,
        to: relation.branch,
        fromPoint: CHART_GRID_POINTS[params.sourceBranch],
        toPoint: CHART_GRID_POINTS[relation.branch]
      }
    })
}

function getRelationLineClassName(line: RelationLine): string {
  const classNames = [
    styles.chartRelationLine,
    line.kind === "opposite"
      ? styles.chartRelationLineOpposite
      : styles.chartRelationLineTrine,
    getRelationLineToneClassName(line.sourceFlowType)
  ]

  return classNames.join(" ")
}

function getRelationLineToneClassName(
  type: ZiweiDynamicFlowDetailView["type"]
): string {
  if (type === "natal") return styles.chartRelationLineNatal
  if (type === "daYun") return styles.chartRelationLineDaYun
  if (type === "liuNian") return styles.chartRelationLineLiuNian
  if (type === "liuYue") return styles.chartRelationLineLiuYue
  if (type === "liuRi") return styles.chartRelationLineLiuRi
  return styles.chartRelationLineLiuShi
}

function buildDynamicMarkersByBranch(params: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedFlowType: ZiweiDynamicFlowDetailView["type"]
}): Map<BranchPalace, DynamicPalaceMarker[]> {
  const markers = new Map<BranchPalace, DynamicPalaceMarker[]>()

  for (const flow of params.flows) {
    if (
      flow.type === "natal" ||
      !isZiweiDynamicFlowWithinSelectedDepth({
        selectedFlowType: params.selectedFlowType,
        targetFlowType: flow.type
      })
    ) {
      continue
    }

    const branchMarkers = markers.get(flow.palace) ?? []
    branchMarkers.push({
      type: flow.type,
      label: formatDynamicLifeMarkerLabel(flow),
      isSelected: flow.type === params.selectedFlowType
    })
    markers.set(flow.palace, branchMarkers)
  }

  return markers
}

function buildSelectedDynamicSectorMarkersByBranch(params: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedFlowType: ZiweiDynamicFlowDetailView["type"]
}): Map<BranchPalace, DynamicSectorMarker[]> {
  const markers = new Map<BranchPalace, DynamicSectorMarker[]>()

  if (params.selectedFlowType === "natal") {
    return markers
  }

  const selectedDepthFlows = params.flows.filter((flow) => {
    return (
      flow.type !== "natal" &&
      isZiweiDynamicFlowWithinSelectedDepth({
        selectedFlowType: params.selectedFlowType,
        targetFlowType: flow.type
      })
    )
  })

  selectedDepthFlows.forEach((flow) => {
    ZIWEI_DYNAMIC_SECTOR_ORDER.forEach((sectorName, index) => {
      const branch = moveZiweiPhysicalBranch(flow.palace, -index)
      const branchMarkers = markers.get(branch) ?? []
      branchMarkers.push({
        type: flow.type,
        label: `${formatDynamicFlowScopeLabel(flow)}${ZIWEI_DYNAMIC_SECTOR_LABELS[sectorName]}`
      })
      markers.set(branch, branchMarkers)
    })
  })

  return markers
}

type SelectedDynamicStar =
  {
    starId: string
    branch: BranchPalace
    displayLabel: string
    sourceFlowType: ZiweiDynamicFlowDetailView["type"]
    kind: "transformation" | "flowing" | "annualCycle"
  }

function buildSelectedDynamicStarsByBranch(params: {
  flows: ZiweiDynamicFlowDetailView[]
  selectedFlowType: ZiweiDynamicFlowDetailView["type"]
}): Map<BranchPalace, SelectedDynamicStar[]> {
  const starsByBranch = new Map<BranchPalace, SelectedDynamicStar[]>()

  if (params.selectedFlowType === "natal") {
    return starsByBranch
  }

  const selectedDynamicStars = params.flows.flatMap((flow) => {
    if (
      flow.type === "natal" ||
      !isZiweiDynamicFlowWithinSelectedDepth({
        selectedFlowType: params.selectedFlowType,
        targetFlowType: flow.type
      })
    ) {
      return []
    }

    return [
      ...flow.flowingStars.map((star) => {
        return {
          starId: star.starId,
          branch: star.branch,
          displayLabel: star.displayLabel,
          sourceFlowType: flow.type,
          kind: "flowing" as const
        }
      }),
      ...flow.annualCycleStars.map((star) => {
        return {
          starId: star.starId,
          branch: star.branch,
          displayLabel: star.displayLabel,
          sourceFlowType: flow.type,
          kind: "annualCycle" as const
        }
      }),
      ...flow.transformations.map((transformation) => {
        return {
          starId: transformation.transformationStarId,
          branch: transformation.branch,
          displayLabel: transformation.displayLabel,
          sourceFlowType: flow.type,
          kind: "transformation" as const
        }
      })
    ]
  })

  selectedDynamicStars.forEach((star) => {
    const branchStars = starsByBranch.get(star.branch) ?? []
    branchStars.push(star)
    branchStars.sort(compareSelectedDynamicStars)
    starsByBranch.set(star.branch, branchStars)
  })

  return starsByBranch
}

function compareSelectedDynamicStars(
  left: SelectedDynamicStar,
  right: SelectedDynamicStar
): number {
  return (
    getDynamicFlowSortWeight(left.sourceFlowType) -
      getDynamicFlowSortWeight(right.sourceFlowType) ||
    getDynamicStarKindSortWeight(left.kind) -
      getDynamicStarKindSortWeight(right.kind) ||
    left.displayLabel.localeCompare(right.displayLabel, "zh-Hans-CN")
  )
}

function getDynamicFlowSortWeight(
  type: ZiweiDynamicFlowDetailView["type"]
): number {
  if (type === "daYun") return 1
  if (type === "liuNian") return 2
  if (type === "liuYue") return 3
  if (type === "liuRi") return 4
  if (type === "liuShi") return 5
  return 0
}

function getDynamicStarKindSortWeight(kind: SelectedDynamicStar["kind"]): number {
  if (kind === "transformation") return 1
  if (kind === "flowing") return 2
  return 3
}

function buildDaYunRangesByBranch(params: {
  debug?: ZiweiDynamicDebugView
  lifeBranch?: BranchPalace
}): Map<BranchPalace, DaYunRangeMarker> {
  const ranges = new Map<BranchPalace, DaYunRangeMarker>()

  if (!params.debug || !params.lifeBranch) {
    return ranges
  }

  for (let index = 0; index < 12; index += 1) {
    const step = params.debug.direction === "forward" ? index : -index
    const branch = moveZiweiPhysicalBranch(params.lifeBranch, step)
    const startAge = params.debug.startAge + index * 10

    ranges.set(branch, {
      startAge,
      endAge: startAge + 9
    })
  }

  return ranges
}

function formatDynamicLifeMarkerLabel(
  flow: ZiweiDynamicFlowDetailView
): string {
  if (flow.type === "natal") {
    return "本命"
  }

  return `${flow.label}命`
}

function formatDynamicFlowScopeLabel(flow: ZiweiDynamicFlowDetailView): string {
  if (flow.type === "daYun") return "大限"
  if (flow.type === "liuNian") return "流年"
  if (flow.type === "liuYue") return "流月"
  if (flow.type === "liuRi") return "流日"
  if (flow.type === "liuShi") return "流时"
  return flow.label
}

function getDynamicPalaceMarkerClassName(
  marker: DynamicPalaceMarker
): string {
  const classNames = [
    styles.dynamicPalaceMarker,
    getDynamicPalaceMarkerToneClassName(marker.type)
  ]

  if (marker.isSelected) {
    classNames.push(styles.dynamicPalaceMarkerActive)
  }

  return classNames.join(" ")
}

function getDynamicPalaceMarkerToneClassName(
  type: ZiweiDynamicFlowDetailView["type"]
): string {
  if (type === "natal") return styles.dynamicPalaceMarkerNatal
  if (type === "daYun") return styles.dynamicPalaceMarkerDaYun
  if (type === "liuNian") return styles.dynamicPalaceMarkerLiuNian
  if (type === "liuYue") return styles.dynamicPalaceMarkerLiuYue
  if (type === "liuRi") return styles.dynamicPalaceMarkerLiuRi
  return styles.dynamicPalaceMarkerLiuShi
}

function getDynamicStarKindClassName(
  kind: SelectedDynamicStar["kind"]
): string {
  if (kind === "transformation") return styles.dynamicStarTransformation
  if (kind === "flowing") return styles.dynamicStarFlowing
  return styles.dynamicStarAnnualCycle
}

function formatGridTemplateAreas(rows: readonly string[]): string {
  return rows.map((row) => `"${row}"`).join(" ")
}

function countPalaceStars(palace: ZiweiPalaceCellView): number {
  return palace.starGroups.reduce((total, group) => {
    return total + group.stars.length
  }, 0)
}

function countPalaceBrightStars(palace: ZiweiPalaceCellView): number {
  return palace.starGroups.reduce((total, group) => {
    return (
      total +
      group.stars.filter((star) => {
        return (
          star.category !== "transformation" &&
          star.brightness &&
          star.brightness.level !== "unmapped"
        )
      }).length
    )
  }, 0)
}
