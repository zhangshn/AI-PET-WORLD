"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import {
  buildPetBirthBundle,
  updatePetAiState,
  type PetBirthAiBundle,
  type PetTimelineSnapshot,
  type StateUpdateEvent
} from "../../ai/gateway"

import {
  buildZiweiDynamicChartOnly,
  buildZiweiDynamicInfluence
} from "../../ai/ziwei-core/ziwei-gateway"

import type {
  BranchPalace,
  SectorName,
  StarId
} from "../../ai/ziwei-core/schema"

import {
  DEV_SECTOR_LABELS,
  getDevStarLabel
} from "./devLabels"

import { buildBaziProfile } from "../../ai/bazi-core/bazi-gateway"
import { buildFinalPersonalityProfile } from "../../ai/personality-vector/vector-gateway"

type TimelineClock = {
  day: number
  hour: number
  period: string
}

type BirthInputState = {
  year: number
  month: number
  day: number
  hour: number
}

type DiffItem = {
  label: string
  before: string | number
  after: string | number
}

type TimelineLogEntry = {
  id: string
  actionLabel: string
  beforeClock: TimelineClock
  afterClock: TimelineClock
  diffs: DiffItem[]
  snapshotSummary: {
    phase: string
    emotional: string
    energy: number
    hunger: number
    cognitive: string
    relational: string
    drive: string
    branch: string
  }
  createdAt: string
}

type DynamicGenderInput = "" | "male" | "female"

const INITIAL_TIMELINE_CLOCK: TimelineClock = {
  day: 1,
  hour: 8,
  period: "Morning"
}

const BRANCH_LABELS: Record<BranchPalace, string> = {
  yin: "寅",
  mao: "卯",
  chen: "辰",
  si: "巳",
  wu: "午",
  wei: "未",
  shen: "申",
  you: "酉",
  xu: "戌",
  hai: "亥",
  zi: "子",
  chou: "丑"
}

const BRANCH_FULL_LABELS: Record<BranchPalace, string> = {
  yin: "寅宫",
  mao: "卯宫",
  chen: "辰宫",
  si: "巳宫",
  wu: "午宫",
  wei: "未宫",
  shen: "申宫",
  you: "酉宫",
  xu: "戌宫",
  hai: "亥宫",
  zi: "子宫",
  chou: "丑宫"
}

const SECTOR_LABELS_FALLBACK: Record<SectorName, string> = {
  life: "命宫",
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

const ZIWEI_LAYOUT: (BranchPalace | null)[][] = [
  ["si", "wu", "wei", "shen"],
  ["chen", null, null, "you"],
  ["mao", null, null, "xu"],
  ["yin", "chou", "zi", "hai"]
]

const TIME_BRANCH_BY_HOUR: BranchPalace[] = [
  "zi",
  "chou",
  "chou",
  "yin",
  "yin",
  "mao",
  "mao",
  "chen",
  "chen",
  "si",
  "si",
  "wu",
  "wu",
  "wei",
  "wei",
  "shen",
  "shen",
  "you",
  "you",
  "xu",
  "xu",
  "hai",
  "hai",
  "zi"
]

const ELEMENT_GATE_LABELS: Record<string, string> = {
  water_2: "水二局",
  wood_3: "木三局",
  metal_4: "金四局",
  earth_5: "土五局",
  fire_6: "火六局"
}

const WUXING_LABELS: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水"
}

const FINAL_VECTOR_LABELS: Record<string, string> = {
  curiosity: "好奇心",
  activity: "行动性",
  stability: "稳定性",
  sensitivity: "敏感度",
  discipline: "秩序/自律",
  attachment: "依附/关系需求",
  control: "控制感",
  explorationDrive: "探索驱动",
  reactionSpeed: "反应速度",
  persistence: "持续性",
  adaptability: "适应性",
  sensoryDepth: "感知深度",
  restPreference: "休息偏好"
}

const FINAL_BIAS_LABELS: Record<string, string> = {
  newbornActivity: "新生期活动倾向",
  observationNeed: "观察需求",
  attachmentNeed: "依附需求",
  explorationRange: "探索范围",
  restNeed: "休息需求",
  carePriority: "照顾优先级",
  constructionDrive: "建设驱动力",
  routinePreference: "固定流程偏好",
  riskTolerance: "风险容忍",
  responseSpeed: "响应速度",
  expansionPreference: "扩张偏好",
  stabilityPreference: "稳定偏好",
  comfortPreference: "舒适偏好",
  orderPreference: "秩序偏好",
  adaptabilityPreference: "可变适应偏好"
}

const DYNAMIC_BIAS_LABELS: Record<string, string> = {
  careBias: "照护倾向",
  observeBias: "观察倾向",
  protectBias: "保护倾向",
  exploreBias: "探索倾向",
  recordBias: "记录倾向",
  routineBias: "秩序倾向",
  repairBias: "修复倾向",
  boundaryBias: "边界倾向"
}

const POSITION_BIAS_LABELS: Record<string, string> = {
  near_incubator: "靠近孵化器",
  near_nest: "靠近巢穴",
  near_door: "靠近门口",
  near_desk: "靠近记录桌",
  patrol_room: "房间巡查"
}

const OBSERVATION_DISTANCE_LABELS: Record<string, string> = {
  close: "近距离观察",
  medium: "中距离观察",
  distant: "远距离观察"
}

const TONE_BIAS_LABELS: Record<string, string> = {
  gentle: "温和",
  rational: "理性",
  concise: "简洁",
  protective: "保护性",
  curious: "好奇"
}

const PHASE_LABELS: Record<string, string> = {
  stable_phase: "平稳阶段",
  growth_phase: "成长扩张阶段",
  sensitive_phase: "敏感波动阶段",
  recovery_phase: "修整恢复阶段",
  attachment_phase: "亲近依附阶段",
  withdrawal_phase: "收缩回避阶段"
}

const BRANCH_LABEL_MAP: Record<string, string> = {
  balanced: "平衡路径",
  attachment: "亲近路径",
  defense: "防御路径",
  curiosity: "探索路径",
  recovery: "恢复路径",
  survival: "应对路径"
}

const EMOTIONAL_LABELS: Record<string, string> = {
  relaxed: "放松",
  content: "满足",
  curious: "好奇",
  excited: "兴奋",
  alert: "警觉",
  irritated: "烦躁",
  anxious: "不安",
  low: "低落",
  neutral: "平稳"
}

const COGNITIVE_LABELS: Record<string, string> = {
  idle: "松散观察",
  observing: "观察中",
  focused: "专注",
  curious: "探索留意",
  hesitant: "犹豫",
  stressed: "紧张",
  avoidant: "回避"
}

const RELATIONAL_LABELS: Record<string, string> = {
  secure: "安心",
  attached: "亲近",
  neutral: "中性",
  guarded: "保留",
  distant: "疏离"
}

const DRIVE_LABELS: Record<string, string> = {
  rest: "休息",
  eat: "进食",
  explore: "探索",
  approach: "靠近",
  avoid: "回避",
  idle: "待机"
}

function parseBirthHourInput(value: string): number | null {
  const normalized = value.trim()

  if (
    !normalized ||
    normalized === "未知" ||
    normalized.toLowerCase() === "unknown"
  ) {
    return null
  }

  const numericHour = Number(normalized)

  if (Number.isInteger(numericHour) && numericHour >= 0 && numericHour <= 23) {
    return numericHour
  }

  return null
}

function getSectorLabel(sector: SectorName): string {
  return DEV_SECTOR_LABELS?.[sector] || SECTOR_LABELS_FALLBACK[sector] || sector
}

function getStarDisplay(starId: StarId): string {
  return `${starId}（${getDevStarLabel(starId)}）`
}

function getBorrowedStarsByBranch(
  branch: BranchPalace,
  borrowedPalaces: Array<{
    targetPalace: BranchPalace
    sourcePalace: BranchPalace
    stars: StarId[]
  }>
): StarId[] {
  const item = borrowedPalaces.find((p) => p.targetPalace === branch)
  return item?.stars ?? []
}

function clampHour(hour: number): number {
  return ((hour % 24) + 24) % 24
}

function getPeriodFromHour(hour: number): string {
  const safeHour = clampHour(hour)

  if (safeHour >= 6 && safeHour < 12) {
    return "Morning"
  }

  if (safeHour >= 12 && safeHour < 18) {
    return "Daytime"
  }

  if (safeHour >= 18 && safeHour < 22) {
    return "Evening"
  }

  return "Night"
}

function getTimeBranchFromHour(hour: number): BranchPalace {
  return TIME_BRANCH_BY_HOUR[clampHour(hour)]
}

function advanceClock(current: TimelineClock, hourDelta: number): TimelineClock {
  const totalHours = (current.day - 1) * 24 + current.hour + hourDelta
  const nextDay = Math.floor(totalHours / 24) + 1
  const nextHour = clampHour(totalHours)

  return {
    day: Math.max(1, nextDay),
    hour: nextHour,
    period: getPeriodFromHour(nextHour)
  }
}

function formatClock(clock: TimelineClock): string {
  return `Day ${clock.day} - ${clock.hour}:00 - ${clock.period}`
}

function resolveCurrentAge(clock: TimelineClock): number {
  return Math.max(1, Math.ceil(clock.day / 365))
}

function snapshotToComparableMap(snapshot: PetTimelineSnapshot) {
  return {
    phase: snapshot.fortune.phaseTag,
    phaseSummary: snapshot.fortune.summary,
    emotional: snapshot.state.emotional.label,
    energy: Math.round(snapshot.state.physical.energy),
    hunger: Math.round(snapshot.state.physical.hunger),
    cognitive: snapshot.state.cognitive.label,
    relational: snapshot.state.relational.label,
    drive: snapshot.state.drive.primary,
    branch: snapshot.trajectory.branchTag,
    trajectorySummary: snapshot.trajectory.summary
  }
}

function buildTimelineDiffs(
  before: PetTimelineSnapshot,
  after: PetTimelineSnapshot
): DiffItem[] {
  const beforeMap = snapshotToComparableMap(before)
  const afterMap = snapshotToComparableMap(after)

  const labelMap: Record<string, string> = {
    phase: "阶段标签",
    phaseSummary: "阶段摘要",
    emotional: "情绪状态",
    energy: "生理能量",
    hunger: "饥饿程度",
    cognitive: "认知状态",
    relational: "关系状态",
    drive: "当前驱动",
    branch: "生命路径",
    trajectorySummary: "路径摘要"
  }

  const diffs: DiffItem[] = []

  Object.keys(beforeMap).forEach((key) => {
    const typedKey = key as keyof typeof beforeMap

    if (beforeMap[typedKey] !== afterMap[typedKey]) {
      diffs.push({
        label: labelMap[key] || key,
        before: beforeMap[typedKey] as string | number,
        after: afterMap[typedKey] as string | number
      })
    }
  })

  return diffs
}

function InfoCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 16,
        background: "#fff"
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  )
}

function ActionButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer"
      }}
    >
      {label}
    </button>
  )
}

function ComboInput({
  label,
  value,
  options,
  placeholder,
  width,
  onChange
}: {
  label: string
  value: string
  options: string[]
  placeholder?: string
  width?: number
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) {
        return
      }

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {label}：
      <div ref={wrapperRef} style={{ position: "relative", width: width ?? 100 }}>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          style={{
            width: "100%",
            padding: "6px 28px 6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6
          }}
        />

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            width: 22,
            height: 22,
            border: "none",
            background: "transparent",
            cursor: "pointer"
          }}
        >
          ▼
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: 34,
              left: 0,
              width: "100%",
              maxHeight: 240,
              overflowY: "auto",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              zIndex: 9999
            }}
          >
            {options.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onChange(item)
                  setOpen(false)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  textAlign: "left",
                  border: "none",
                  background: item === value ? "#f0f5ff" : "#fff",
                  cursor: "pointer"
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  )
}

function ScoreLine({
  name,
  value,
  label
}: {
  name: string
  value: number
  label?: string
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      {name}
      {label ? `（${label}）` : ""}：{Math.round(value)}
    </div>
  )
}

function ValueLine({
  label,
  value
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <strong>{label}：</strong>
      {value}
    </div>
  )
}

export default function PersonalityTestPage() {
  const [year, setYear] = useState(1900)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthHourInput, setBirthHourInput] = useState("未知")
  const [dynamicGender, setDynamicGender] = useState<DynamicGenderInput>("")

  const parsedBirthHour = useMemo(
    () => parseBirthHourInput(birthHourInput),
    [birthHourInput]
  )

  const hasBirthHour = parsedBirthHour !== null
  const ziweiHour = parsedBirthHour ?? 0

  const [timelineClock, setTimelineClock] = useState<TimelineClock>({
    ...INITIAL_TIMELINE_CLOCK
  })

  const [birthBundle, setBirthBundle] = useState<PetBirthAiBundle>(() =>
    buildPetBirthBundle({
      birthInput: {
        year,
        month,
        day,
        hour: 0
      },
      time: INITIAL_TIMELINE_CLOCK
    })
  )

  const [timelineSnapshot, setTimelineSnapshot] =
    useState<PetTimelineSnapshot | null>(birthBundle.timelineSnapshot)

  const [lastOperation, setLastOperation] = useState("尚未操作")
  const [lastDiffs, setLastDiffs] = useState<DiffItem[]>([])
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogEntry[]>([])

  const profile = birthBundle.personalityProfile
  const publicView = birthBundle.publicPersonalityView
  const pattern = profile.pattern
  const traits = profile.traits
  const debug = profile.debug
  const summaries = profile.summaries
  const corePersonality = profile.corePersonality

  const currentAge = useMemo(() => {
    return resolveCurrentAge(timelineClock)
  }, [timelineClock])

  const currentTimeBranch = useMemo(() => {
    return getTimeBranchFromHour(timelineClock.hour)
  }, [timelineClock.hour])

  const baziProfile = useMemo(() => {
    return buildBaziProfile({
      year,
      month,
      day,
      hour: parsedBirthHour
    })
  }, [year, month, day, parsedBirthHour])

  const finalPersonalityProfile = useMemo(() => {
    return buildFinalPersonalityProfile({
      ziweiProfile: hasBirthHour ? profile : null,
      baziProfile
    })
  }, [hasBirthHour, profile, baziProfile])

  const ziweiDynamicChartResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicChartOnly({
      pattern,
      gender: dynamicGender,
      currentAge,
      currentYear: year,
      currentLunarMonth: pattern.lunarInfo.lunarMonth,
      currentLunarDay: pattern.lunarInfo.lunarDay,
      currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    currentAge,
    year,
    currentTimeBranch
  ])

  const ziweiDynamicInfluenceResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicInfluence({
      pattern,
      gender: dynamicGender,
      currentAge,
      currentYear: year,
      currentLunarMonth: pattern.lunarInfo.lunarMonth,
      currentLunarDay: pattern.lunarInfo.lunarDay,
      currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    currentAge,
    year,
    currentTimeBranch
  ])

  function resetFromBirthInput(nextBirthInput: BirthInputState) {
    const nextBundle = buildPetBirthBundle({
      birthInput: nextBirthInput,
      time: INITIAL_TIMELINE_CLOCK
    })

    setBirthBundle(nextBundle)
    setTimelineSnapshot(nextBundle.timelineSnapshot)
    setTimelineClock({ ...INITIAL_TIMELINE_CLOCK })
    setLastOperation("根据当前出生输入重新初始化测试快照")
    setLastDiffs([])
    setTimelineLogs([])
  }

  function syncZiweiWhenPossible(nextInput: {
    year: number
    month: number
    day: number
    hour: number | null
  }) {
    if (nextInput.hour === null) {
      setLastOperation("当前出生时间未知，仅使用八字三柱生成统一人格")
      setLastDiffs([])
      setTimelineLogs([])
      return
    }

    resetFromBirthInput({
      year: nextInput.year,
      month: nextInput.month,
      day: nextInput.day,
      hour: nextInput.hour
    })
  }

  function handleDateChange(nextInput: {
    year?: number
    month?: number
    day?: number
  }) {
    const nextYear = nextInput.year ?? year
    const nextMonth = nextInput.month ?? month
    const nextDay = nextInput.day ?? day

    setYear(nextYear)
    setMonth(nextMonth)
    setDay(nextDay)

    syncZiweiWhenPossible({
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      hour: parsedBirthHour
    })
  }

  function handleBirthHourInputChange(value: string) {
    const nextHour = parseBirthHourInput(value)
    setBirthHourInput(value)

    syncZiweiWhenPossible({
      year,
      month,
      day,
      hour: nextHour
    })
  }

  function renderBranchCell(branch: BranchPalace) {
    const sector = pattern.branchToSectorMap[branch]
    const stars = pattern.branchPalaces[branch] || []
    const borrowedStars = getBorrowedStarsByBranch(branch, pattern.borrowedPalaces)

    const isPrimary = branch === pattern.primaryBranchPalace
    const isBody = branch === pattern.bodyBranchPalace
    const isSupport = pattern.supportBranchPalaces.includes(branch)
    const isOpposite = branch === pattern.oppositeBranchPalace
    const isEmpty = stars.length === 0

    let border = "1px solid #ccc"
    let background = "#fff"

    if (isPrimary) {
      border = "2px solid #ff4d4f"
      background = "#fff1f0"
    } else if (isOpposite) {
      border = "2px solid #faad14"
      background = "#fffbe6"
    } else if (isSupport) {
      border = "2px dashed #1677ff"
      background = "#f0f8ff"
    }

    return (
      <div
        key={branch}
        style={{
          border,
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          minHeight: 150,
          background
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8
          }}
        >
          <div style={{ fontWeight: "bold" }}>
            {getSectorLabel(sector)}
            {isPrimary ? " ⭐命" : ""}
            {isBody ? " ◎身" : ""}
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>
            {BRANCH_LABELS[branch]}
          </div>
        </div>

        <div style={{ lineHeight: 1.6, marginBottom: 6 }}>
          {stars.length > 0 ? (
            <>
              <div style={{ color: "#333", marginBottom: 4 }}>原生星：</div>
              {stars.map((starId) => (
                <div key={starId}>{getStarDisplay(starId)}</div>
              ))}
            </>
          ) : (
            <div style={{ color: "#999" }}>原生：空宫</div>
          )}
        </div>

        {isEmpty && borrowedStars.length > 0 && (
          <div style={{ lineHeight: 1.6, marginTop: 8, color: "#666" }}>
            <div style={{ marginBottom: 4 }}>借星：</div>
            {borrowedStars.map((starId) => (
              <div key={`borrowed-${branch}-${starId}`}>
                {getStarDisplay(starId)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function applyTimelineUpdate(
    label: string,
    events?: StateUpdateEvent[],
    hourDelta: number = 0
  ) {
    if (!timelineSnapshot) {
      return
    }

    const beforeSnapshot = timelineSnapshot
    const beforeClock = timelineClock
    const nextClock = advanceClock(timelineClock, hourDelta)

    const nextSnapshot = updatePetAiState({
      currentSnapshot: timelineSnapshot,
      time: {
        day: nextClock.day,
        hour: nextClock.hour,
        period: nextClock.period
      },
      events,
      tickDelta: hourDelta > 0 ? hourDelta : 0,
      shouldRefreshTrajectory: true
    })

    const diffs = buildTimelineDiffs(beforeSnapshot, nextSnapshot)

    const logEntry: TimelineLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      actionLabel: label,
      beforeClock,
      afterClock: nextClock,
      diffs,
      snapshotSummary: {
        phase: nextSnapshot.fortune.phaseTag,
        emotional: nextSnapshot.state.emotional.label,
        energy: Math.round(nextSnapshot.state.physical.energy),
        hunger: Math.round(nextSnapshot.state.physical.hunger),
        cognitive: nextSnapshot.state.cognitive.label,
        relational: nextSnapshot.state.relational.label,
        drive: nextSnapshot.state.drive.primary,
        branch: nextSnapshot.trajectory.branchTag
      },
      createdAt: new Date().toLocaleTimeString()
    }

    setTimelineClock(nextClock)
    setTimelineSnapshot(nextSnapshot)
    setLastOperation(label)
    setLastDiffs(diffs)
    setTimelineLogs((prev) => [logEntry, ...prev])
  }

  function resetTimeline() {
    resetFromBirthInput({
      year,
      month,
      day,
      hour: ziweiHour
    })
    setLastOperation("已重置 timeline 到初始状态")
  }

  return (
    <div
      style={{
        padding: 20,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#f7f7f7",
        minHeight: "100vh"
      }}
    >
      <h2 style={{ marginBottom: 16 }}>🧠 AI 人格核心测试系统</h2>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 16,
          background: "#fff",
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center"
        }}
      >
        <ComboInput
          label="年"
          value={String(year)}
          width={100}
          options={Array.from({ length: 201 }, (_, index) =>
            String(1900 + index)
          )}
          onChange={(value) => {
            const nextYear = Number(value)
            if (!Number.isNaN(nextYear)) {
              handleDateChange({ year: nextYear })
            }
          }}
        />

        <ComboInput
          label="月"
          value={String(month)}
          width={70}
          options={Array.from({ length: 12 }, (_, index) => String(index + 1))}
          onChange={(value) => {
            const nextMonth = Number(value)
            if (!Number.isNaN(nextMonth)) {
              handleDateChange({ month: nextMonth })
            }
          }}
        />

        <ComboInput
          label="日"
          value={String(day)}
          width={70}
          options={Array.from({ length: 31 }, (_, index) => String(index + 1))}
          onChange={(value) => {
            const nextDay = Number(value)
            if (!Number.isNaN(nextDay)) {
              handleDateChange({ day: nextDay })
            }
          }}
        />

        <ComboInput
          label="时"
          value={birthHourInput}
          width={120}
          placeholder="未知 / 0-23"
          options={["未知", ...Array.from({ length: 24 }, (_, index) => String(index))]}
          onChange={handleBirthHourInputChange}
        />

        <ComboInput
          label="动态性别"
          value={dynamicGender || "未选择"}
          width={120}
          options={["未选择", "male", "female"]}
          onChange={(value) => {
            if (value === "male" || value === "female") {
              setDynamicGender(value)
              return
            }

            setDynamicGender("")
          }}
        />
      </div>

      <InfoCard title="🧬 最终 AI 人格结果（已融合）">
        <div style={{ lineHeight: 1.9 }}>
          <ValueLine
            label="当前模式"
            value={hasBirthHour ? "紫微结构 + 八字动力融合" : "八字三柱动力人格"}
          />
          <ValueLine
            label="人格标签"
            value={finalPersonalityProfile.labels.join(" / ")}
          />
          <div style={{ marginTop: 8, color: "#555" }}>
            {finalPersonalityProfile.summary}
          </div>
        </div>

        <hr
          style={{
            margin: "16px 0",
            border: "none",
            borderTop: "1px solid #eee"
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 18
          }}
        >
          <div>
            <strong>统一人格向量</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.vector).map(
                ([key, value]) => (
                  <ScoreLine
                    key={key}
                    name={key}
                    label={FINAL_VECTOR_LABELS[key]}
                    value={Number(value)}
                  />
                )
              )}
            </div>
          </div>

          <div>
            <strong>宠物行为偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.petBehaviorBias).map(
                ([key, value]) => (
                  <ScoreLine
                    key={key}
                    name={key}
                    label={FINAL_BIAS_LABELS[key]}
                    value={Number(value)}
                  />
                )
              )}
            </div>
          </div>

          <div>
            <strong>管家行为偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.butlerBehaviorBias).map(
                ([key, value]) => (
                  <ScoreLine
                    key={key}
                    name={key}
                    label={FINAL_BIAS_LABELS[key]}
                    value={Number(value)}
                  />
                )
              )}
            </div>
          </div>

          <div>
            <strong>建筑/家园偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.buildingBias).map(
                ([key, value]) => (
                  <ScoreLine
                    key={key}
                    name={key}
                    label={FINAL_BIAS_LABELS[key]}
                    value={Number(value)}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="🔮 紫微动态运势测试">
        {!hasBirthHour ? (
          <div style={{ color: "#a66", lineHeight: 1.8 }}>
            当前出生时间未知，无法生成完整紫微结构，因此不进入动态运势计算。
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
                lineHeight: 1.8,
                marginBottom: 16
              }}
            >
              <ValueLine
                label="五行局"
                value={`${pattern.elementGate}（${
                  ELEMENT_GATE_LABELS[pattern.elementGate] ?? pattern.elementGate
                }）`}
              />
              <ValueLine label="五行局数" value={pattern.elementBase} />
              <ValueLine
                label="当前动态性别"
                value={dynamicGender || "未选择"}
              />
              <ValueLine label="当前年龄" value={currentAge} />
              <ValueLine label="当前年份" value={year} />
              <ValueLine
                label="当前时辰"
                value={`${currentTimeBranch}（${BRANCH_LABELS[currentTimeBranch]}）`}
              />
              <ValueLine
                label="农历月"
                value={pattern.lunarInfo.lunarMonth}
              />
              <ValueLine
                label="农历日"
                value={pattern.lunarInfo.lunarDay}
              />
              <ValueLine
                label="当前世界时间"
                value={formatClock(timelineClock)}
              />
            </div>

            {ziweiDynamicChartResult && !ziweiDynamicChartResult.ok && (
              <div
                style={{
                  border: "1px solid #ffccc7",
                  background: "#fff2f0",
                  borderRadius: 8,
                  padding: 12,
                  color: "#a8071a",
                  marginBottom: 16
                }}
              >
                {ziweiDynamicChartResult.message}
              </div>
            )}

            {ziweiDynamicChartResult?.ok && (
              <div style={{ marginBottom: 18 }}>
                <strong>动态盘落点</strong>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                    marginTop: 12
                  }}
                >
                  {[
                    ziweiDynamicChartResult.data.natal,
                    ziweiDynamicChartResult.data.daYun,
                    ziweiDynamicChartResult.data.liuNian,
                    ziweiDynamicChartResult.data.liuYue,
                    ziweiDynamicChartResult.data.liuRi,
                    ziweiDynamicChartResult.data.liuShi
                  ].map((flow) => (
                    <div
                      key={flow.type}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 8,
                        padding: 12,
                        background: "#fafafa",
                        lineHeight: 1.8
                      }}
                    >
                      <ValueLine label="类型" value={flow.type} />
                      <ValueLine
                        label="落宫"
                        value={`${flow.palace}（${BRANCH_FULL_LABELS[flow.palace]}）`}
                      />
                      <ValueLine
                        label="业务宫位"
                        value={getSectorLabel(flow.sectorName as SectorName)}
                      />
                      <ValueLine label="权重" value={flow.influence} />
                      <ValueLine
                        label="星曜"
                        value={
                          flow.stars.length > 0
                            ? flow.stars.map(getStarDisplay).join(" / ")
                            : "空宫"
                        }
                      />
                      <ValueLine
                        label="组合"
                        value={
                          flow.pairIds.length > 0
                            ? flow.pairIds.join(" / ")
                            : "无"
                        }
                      />
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, color: "#666" }}>
                  大运方向：{ziweiDynamicChartResult.data.debug.direction}；
                  起运岁数：{ziweiDynamicChartResult.data.debug.startAge}
                </div>
              </div>
            )}

            {ziweiDynamicInfluenceResult?.ok && (
              <div>
                <strong>动态行为影响</strong>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 18,
                    marginTop: 12
                  }}
                >
                  <div>
                    {[
                      "careBias",
                      "observeBias",
                      "protectBias",
                      "exploreBias",
                      "recordBias",
                      "routineBias",
                      "repairBias",
                      "boundaryBias"
                    ].map((key) => (
                      <ScoreLine
                        key={key}
                        name={key}
                        label={DYNAMIC_BIAS_LABELS[key]}
                        value={
                          ziweiDynamicInfluenceResult.data[
                            key as keyof typeof ziweiDynamicInfluenceResult.data
                          ] as number
                        }
                      />
                    ))}
                  </div>

                  <div style={{ lineHeight: 1.9 }}>
                    <ValueLine
                      label="站位倾向"
                      value={
                        POSITION_BIAS_LABELS[
                          ziweiDynamicInfluenceResult.data.positionBias
                        ] ?? ziweiDynamicInfluenceResult.data.positionBias
                      }
                    />
                    <ValueLine
                      label="观察距离"
                      value={
                        OBSERVATION_DISTANCE_LABELS[
                          ziweiDynamicInfluenceResult.data.observationDistance
                        ] ?? ziweiDynamicInfluenceResult.data.observationDistance
                      }
                    />
                    <ValueLine
                      label="语气倾向"
                      value={
                        TONE_BIAS_LABELS[ziweiDynamicInfluenceResult.data.toneBias] ??
                        ziweiDynamicInfluenceResult.data.toneBias
                      }
                    />
                    <ValueLine
                      label="当前阶段"
                      value={ziweiDynamicInfluenceResult.data.currentPhaseLabel}
                    />
                    <ValueLine
                      label="当前关注点"
                      value={ziweiDynamicInfluenceResult.data.currentFocusLabel}
                    />
                    <ValueLine
                      label="Top Bias"
                      value={ziweiDynamicInfluenceResult.data.debug.topBiases.join(
                        " / "
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="☯ 来源一：八字动力底盘">
        <div style={{ lineHeight: 2 }}>
          <ValueLine label="年柱" value={baziProfile.chart.yearPillar.label} />
          <ValueLine label="月柱" value={baziProfile.chart.monthPillar.label} />
          <ValueLine label="日柱" value={baziProfile.chart.dayPillar.label} />
          {baziProfile.chart.hourPillar && (
            <ValueLine label="时柱" value={baziProfile.chart.hourPillar.label} />
          )}
          <ValueLine
            label="当前模式"
            value={baziProfile.chart.hasHour ? "四柱" : "三柱"}
          />
          <ValueLine
            label="主导五行"
            value={baziProfile.dominantElements
              .map((element: string) => WUXING_LABELS[element] ?? element)
              .join(" / ")}
          />
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="🌌 来源二：紫微人格结构">
        {!hasBirthHour ? (
          <div style={{ color: "#a66", lineHeight: 1.8 }}>
            当前出生时间未知，完整紫微结构暂不参与最终人格融合。
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 18,
                lineHeight: 1.9
              }}
            >
              <div>
                <ValueLine label="Birth Key" value={pattern.birthKey} />
                <ValueLine
                  label="农历"
                  value={`${pattern.lunarInfo.lunarYear}-${pattern.lunarInfo.lunarMonth}-${pattern.lunarInfo.lunarDay}`}
                />
                <ValueLine
                  label="出生时辰"
                  value={`${pattern.timeBranch}（${BRANCH_LABELS[pattern.timeBranch]}）`}
                />
                <ValueLine
                  label="命宫"
                  value={`${pattern.primaryBranchPalace}（${BRANCH_FULL_LABELS[pattern.primaryBranchPalace]}）`}
                />
                <ValueLine
                  label="身宫"
                  value={`${pattern.bodyBranchPalace}（${BRANCH_FULL_LABELS[pattern.bodyBranchPalace]}）`}
                />
                <ValueLine
                  label="五行局"
                  value={`${pattern.elementGate}（${
                    ELEMENT_GATE_LABELS[pattern.elementGate] ?? pattern.elementGate
                  }）`}
                />
              </div>

              <div>
                <ValueLine
                  label="命宫主星"
                  value={
                    pattern.primaryStars.length > 0
                      ? pattern.primaryStars.map(getStarDisplay).join(" / ")
                      : "空宫"
                  }
                />
                <ValueLine
                  label="support 宫位"
                  value={pattern.supportSectors.map(getSectorLabel).join(" / ")}
                />
                <ValueLine
                  label="support 星"
                  value={
                    pattern.supportStars.length > 0
                      ? pattern.supportStars.map(getStarDisplay).join(" / ")
                      : "无"
                  }
                />
                <ValueLine
                  label="对宫"
                  value={`${getSectorLabel(pattern.oppositeSector)} / ${
                    BRANCH_FULL_LABELS[pattern.oppositeBranchPalace]
                  }`}
                />
                <ValueLine
                  label="借星"
                  value={
                    pattern.borrowedStars.length > 0
                      ? pattern.borrowedStars.map(getStarDisplay).join(" / ")
                      : "无"
                  }
                />
              </div>
            </div>

            <hr
              style={{
                margin: "16px 0",
                border: "none",
                borderTop: "1px solid #eee"
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12
              }}
            >
              {ZIWEI_LAYOUT.flatMap((row, rowIndex) =>
                row.map((branch, colIndex) => {
                  if (!branch) {
                    return (
                      <div
                        key={`empty-${rowIndex}-${colIndex}`}
                        style={{
                          minHeight: 150,
                          borderRadius: 8,
                          background: "#f7f7f7"
                        }}
                      />
                    )
                  }

                  return renderBranchCell(branch)
                })
              )}
            </div>
          </>
        )}
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="🧩 紫微人格输出">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 18
          }}
        >
          <div>
            <strong>核心人格</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(corePersonality).map(([key, value]) => (
                <ScoreLine key={key} name={key} value={Number(value) * 100} />
              ))}
            </div>
          </div>

          <div>
            <strong>行为 traits</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(traits).map(([key, value]) => (
                <ScoreLine key={key} name={key} value={Number(value)} />
              ))}
            </div>
          </div>
        </div>

        <hr
          style={{
            margin: "16px 0",
            border: "none",
            borderTop: "1px solid #eee"
          }}
        />

        <strong>摘要</strong>
        <div style={{ marginTop: 10, lineHeight: 1.8 }}>
          {summaries.length > 0 ? (
            summaries.map((summary) => <div key={summary}>- {summary}</div>)
          ) : (
            <div style={{ color: "#999" }}>暂无摘要</div>
          )}
        </div>

        {debug && (
          <>
            <hr
              style={{
                margin: "16px 0",
                border: "none",
                borderTop: "1px solid #eee"
              }}
            />

            <strong>Debug Pair</strong>
            <div style={{ marginTop: 10, lineHeight: 1.8 }}>
              <ValueLine
                label="命中组合"
                value={
                  debug.hitPairs.length > 0
                    ? debug.hitPairs.map((item) => item.pairLabel).join(" / ")
                    : "无"
                }
              />
              <ValueLine
                label="support 组合"
                value={
                  debug.supportPairs.length > 0
                    ? debug.supportPairs.map((item) => item.pairLabel).join(" / ")
                    : "无"
                }
              />
            </div>
          </>
        )}
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="🌱 Timeline / 状态推进测试">
        <div style={{ lineHeight: 2, marginBottom: 12 }}>
          <ValueLine label="当前时间" value={formatClock(timelineClock)} />
          <ValueLine label="上次操作" value={lastOperation} />
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16
          }}
        >
          <ActionButton
            label="推进 +1 小时"
            onClick={() => applyTimelineUpdate("推进时间 +1 小时", undefined, 1)}
          />
          <ActionButton
            label="推进 +6 小时"
            onClick={() => applyTimelineUpdate("推进时间 +6 小时", undefined, 6)}
          />
          <ActionButton
            label="推进 +1 天"
            onClick={() => applyTimelineUpdate("推进时间 +1 天", undefined, 24)}
          />
          <ActionButton
            label="模拟被安抚"
            onClick={() =>
              applyTimelineUpdate("模拟被安抚", [
                {
                  type: "comforted",
                  intensity: 0.75
                }
              ])
            }
          />
          <ActionButton
            label="模拟环境刺激"
            onClick={() =>
              applyTimelineUpdate("模拟环境刺激", [
                {
                  type: "stimulated",
                  intensity: 0.85
                }
              ])
            }
          />
          <ActionButton label="重置 Timeline" onClick={resetTimeline} />
        </div>

        {timelineSnapshot && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 18,
              lineHeight: 1.9
            }}
          >
            <div>
              <strong>当前快照</strong>
              <ValueLine
                label="阶段"
                value={
                  PHASE_LABELS[timelineSnapshot.fortune.phaseTag] ??
                  timelineSnapshot.fortune.phaseTag
                }
              />
              <ValueLine
                label="情绪"
                value={
                  EMOTIONAL_LABELS[timelineSnapshot.state.emotional.label] ??
                  timelineSnapshot.state.emotional.label
                }
              />
              <ValueLine
                label="能量"
                value={Math.round(timelineSnapshot.state.physical.energy)}
              />
              <ValueLine
                label="饥饿"
                value={Math.round(timelineSnapshot.state.physical.hunger)}
              />
              <ValueLine
                label="认知"
                value={
                  COGNITIVE_LABELS[timelineSnapshot.state.cognitive.label] ??
                  timelineSnapshot.state.cognitive.label
                }
              />
              <ValueLine
                label="关系"
                value={
                  RELATIONAL_LABELS[timelineSnapshot.state.relational.label] ??
                  timelineSnapshot.state.relational.label
                }
              />
              <ValueLine
                label="驱动"
                value={
                  DRIVE_LABELS[timelineSnapshot.state.drive.primary] ??
                  timelineSnapshot.state.drive.primary
                }
              />
              <ValueLine
                label="路径"
                value={
                  BRANCH_LABEL_MAP[timelineSnapshot.trajectory.branchTag] ??
                  timelineSnapshot.trajectory.branchTag
                }
              />
            </div>

            <div>
              <strong>本次变化</strong>
              <div style={{ marginTop: 10 }}>
                {lastDiffs.length > 0 ? (
                  lastDiffs.map((item) => (
                    <div key={`${item.label}-${item.before}-${item.after}`}>
                      {item.label}：{item.before} → {item.after}
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#999" }}>这次操作没有造成可见参数变化。</div>
                )}
              </div>
            </div>
          </div>
        )}

        <hr
          style={{
            margin: "16px 0",
            border: "none",
            borderTop: "1px solid #eee"
          }}
        />

        <strong>操作日志</strong>
        <div style={{ marginTop: 10, lineHeight: 1.8 }}>
          {timelineLogs.length > 0 ? (
            timelineLogs.slice(0, 20).map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                  background: "#fafafa"
                }}
              >
                <div>
                  <strong>{item.actionLabel}</strong>
                  <span style={{ color: "#999", marginLeft: 8 }}>
                    {item.createdAt}
                  </span>
                </div>
                <div style={{ color: "#666" }}>
                  {formatClock(item.beforeClock)} → {formatClock(item.afterClock)}
                </div>
                <div>
                  phase: {item.snapshotSummary.phase} | emotional:{" "}
                  {item.snapshotSummary.emotional} | energy:{" "}
                  {item.snapshotSummary.energy} | hunger:{" "}
                  {item.snapshotSummary.hunger} | drive:{" "}
                  {item.snapshotSummary.drive}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: "#999" }}>暂无日志</div>
          )}
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="🪟 公开展示视图">
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f7f7f7",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto"
          }}
        >
          {JSON.stringify(publicView, null, 2)}
        </pre>
      </InfoCard>
    </div>
  )
}