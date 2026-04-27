"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  buildPetBirthBundle,
  updatePetAiState,
  type PetBirthAiBundle,
  type PetTimelineSnapshot,
  type StateUpdateEvent
} from "../../ai/gateway"
import type { BranchPalace, SectorName, StarId } from "../../ai/ziwei-core/schema"
import {
  DEV_SECTOR_LABELS,
  DEV_TRAIT_LABELS,
  getDevStarLabel
} from "./devLabels"
import { buildBaziProfile } from "../../ai/bazi-core/bazi-gateway"
import { buildFinalPersonalityProfile } from "../../ai/personality-vector/vector-gateway"

const BRANCH_LABELS: Record<BranchPalace, string> = {
  yin: "Yin",
  mao: "Mao",
  chen: "Chen",
  si: "Si",
  wu: "Wu",
  wei: "Wei",
  shen: "Shen",
  you: "You",
  xu: "Xu",
  hai: "Hai",
  zi: "Zi",
  chou: "Chou"
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

const WUXING_LABELS: Record<string, string> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水"
}

const DYNAMICS_LABELS: Record<string, string> = {
  actionIntensity: "行动强度",
  reactionSpeed: "反应速度",
  sensoryDepth: "感知深度",
  consistency: "行为一致性",
  explorationDrive: "探索驱动力",
  stability: "稳定性",
  persistence: "持续性",
  adaptability: "适应性"
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

const BEHAVIOR_TAG_LABELS: Record<string, string> = {
  high_action_release: "行动释放强",
  fast_reaction: "反应速度快",
  deep_observer: "观察深度高",
  stable_state: "状态稳定",
  consistent_pattern: "行为模式一致",
  strong_exploration: "探索驱动力强",
  persistent_behavior: "持续性强",
  adaptive_response: "适应能力强",
  balanced_dynamics: "动力结构均衡"
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
  observing: "Observing",
  focused: "Focused",
  curious: "探索留意",
  hesitant: "Hesitant",
  stressed: "Stressed",
  avoidant: "Avoidant"
}

const RELATIONAL_LABELS: Record<string, string> = {
  secure: "安心",
  attached: "亲近",
  neutral: "Neutral",
  guarded: "保留",
  distant: "疏离"
}

const DRIVE_LABELS: Record<string, string> = {
  rest: "Rest",
  eat: "Eat",
  explore: "Explore",
  approach: "Approach",
  avoid: "Avoid",
  idle: "Idle"
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

const INITIAL_TIMELINE_CLOCK: TimelineClock = {
  day: 1,
  hour: 8,
  period: "Morning"
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
  return `${starId} (${getDevStarLabel(starId)})`
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
  if (safeHour >= 6 && safeHour < 12) return "Morning"
  if (safeHour >= 12 && safeHour < 18) return "Daytime"
  if (safeHour >= 18 && safeHour < 22) return "Evening"
  return "Night"
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
      if (!wrapperRef.current) return
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
          onChange={(e) => {
            onChange(e.target.value)
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

export default function PersonalityTestPage() {
  const [year, setYear] = useState(1900)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthHourInput, setBirthHourInput] = useState("未知")

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

  const [timelineSnapshot, setTimelineSnapshot] = useState<PetTimelineSnapshot | null>(
    birthBundle.timelineSnapshot
  )
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
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontWeight: "bold" }}>
            {getSectorLabel(sector)}
            {isPrimary ? " ⭐命" : ""}
            {isBody ? " ◎身" : ""}
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>{BRANCH_LABELS[branch]}</div>
        </div>

        <div style={{ lineHeight: 1.6, marginBottom: 6 }}>
          {stars.length > 0 ? (
            <>
              <div style={{ color: "#333", marginBottom: 4 }}>原生星：</div>
              {stars.map((starId: StarId) => (
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
            {borrowedStars.map((starId: StarId) => (
              <div key={`borrowed-${branch}-${starId}`}>{getStarDisplay(starId)}</div>
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
    if (!timelineSnapshot) return

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
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
          options={Array.from({ length: 201 }, (_, index) => String(1900 + index))}
          onChange={(value) => {
            const nextYear = Number(value)
            if (!Number.isNaN(nextYear)) handleDateChange({ year: nextYear })
          }}
        />

        <ComboInput
          label="月"
          value={String(month)}
          width={70}
          options={Array.from({ length: 12 }, (_, index) => String(index + 1))}
          onChange={(value) => {
            const nextMonth = Number(value)
            if (!Number.isNaN(nextMonth)) handleDateChange({ month: nextMonth })
          }}
        />

        <ComboInput
          label="日"
          value={String(day)}
          width={70}
          options={Array.from({ length: 31 }, (_, index) => String(index + 1))}
          onChange={(value) => {
            const nextDay = Number(value)
            if (!Number.isNaN(nextDay)) handleDateChange({ day: nextDay })
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
      </div>

      <InfoCard title="🧬 最终 AI 人格结果（已融合）">
        <div style={{ lineHeight: 1.9 }}>
          <div>
            <strong>当前模式：</strong>
            {hasBirthHour ? "紫微结构 + 八字动力融合" : "八字三柱动力人格"}
          </div>

          <div>
            <strong>人格标签：</strong>
            {finalPersonalityProfile.labels.join(" / ")}
          </div>

          <div style={{ marginTop: 8, color: "#555" }}>
            {finalPersonalityProfile.summary}
          </div>
        </div>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

        <div style={{ marginBottom: 12 }}>
          <strong>融合逻辑：</strong>
        </div>

        <div style={{ lineHeight: 1.9, color: "#444" }}>
          {hasBirthHour ? (
            <>
              <div>紫微提供“人格结构”：决定这个生命的核心性格、表达方式、关系倾向与行为骨架。</div>
              <div>八字提供“动力底盘”：修正行动速度、感知深度、恢复偏好、探索冲动与适应能力。</div>
              <div>最终人格不是单独的紫微或八字，而是统一成 AI 行为系统可读取的人格向量。</div>
            </>
          ) : (
            <>
              <div>当前出生时间未知，因此无法生成完整紫微结构。</div>
              <div>系统使用八字三柱生成基础动力人格，后续仍可驱动宠物、管家和建筑倾向。</div>
            </>
          )}
        </div>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
          <div>
            <strong>统一人格向量</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.vector).map(([key, value]: [string, number]) => (
                <ScoreLine
                  key={key}
                  name={key}
                  label={FINAL_VECTOR_LABELS[key]}
                  value={value}
                />
              ))}
            </div>
          </div>

          <div>
            <strong>宠物行为偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.petBehaviorBias).map(([key, value]: [string, number]) => (
                <ScoreLine
                  key={key}
                  name={key}
                  label={FINAL_BIAS_LABELS[key]}
                  value={value}
                />
              ))}
            </div>
          </div>

          <div>
            <strong>管家行为偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.butlerBehaviorBias).map(([key, value]: [string, number]) => (
                <ScoreLine
                  key={key}
                  name={key}
                  label={FINAL_BIAS_LABELS[key]}
                  value={value}
                />
              ))}
            </div>
          </div>

          <div>
            <strong>建筑/家园偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.buildingBias).map(([key, value]: [string, number]) => (
                <ScoreLine
                  key={key}
                  name={key}
                  label={FINAL_BIAS_LABELS[key]}
                  value={value}
                />
              ))}
            </div>
          </div>
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="☯ 来源一：八字动力底盘">
        <div style={{ lineHeight: 2 }}>
          <div><strong>年柱：</strong>{baziProfile.chart.yearPillar.label}</div>
          <div><strong>月柱：</strong>{baziProfile.chart.monthPillar.label}</div>
          <div><strong>日柱：</strong>{baziProfile.chart.dayPillar.label}</div>
          {baziProfile.chart.hourPillar && (
            <div><strong>时柱：</strong>{baziProfile.chart.hourPillar.label}</div>
          )}
          <div><strong>当前模式：</strong>{baziProfile.chart.hasHour ? "四柱" : "三柱"}</div>
          <div>
            <strong>主导五行：</strong>
            {baziProfile.dominantElements.map((element: string) => WUXING_LABELS[element]).join(" / ")}
          </div>
        </div>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #eee" }} />

        {Object.entries(baziProfile.dynamics).map(([key, value]: [string, number]) => (
          <ScoreLine
            key={key}
            name={key}
            label={DYNAMICS_LABELS[key]}
            value={value}
          />
        ))}

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {baziProfile.behaviorTags.map((tag: string) => (
            <span
              key={tag}
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                background: "#f0f5ff",
                border: "1px solid #adc6ff",
                fontSize: 12
              }}
            >
              {BEHAVIOR_TAG_LABELS[tag] || tag}
            </span>
          ))}
        </div>

        <div style={{ marginTop: 14, color: "#555", lineHeight: 1.8 }}>
          {baziProfile.interpretation.summary}
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      {hasBirthHour && (
        <>
          <InfoCard title="⭐ 来源二：紫微人格结构">
            <div style={{ lineHeight: 1.9 }}>
              <div><strong>先天气质：</strong>{publicView.innateTemperamentLabel}</div>
              <div><strong>核心宫位：</strong>{getSectorLabel(pattern.primarySector)}</div>
              <div>
                <strong>核心星曜：</strong>
                {pattern.primaryStars.length > 0
                  ? pattern.primaryStars.map((starId: StarId) => getStarDisplay(starId)).join(" / ")
                  : "空宫"}
              </div>
              <div style={{ color: "#555", marginTop: 8 }}>
                紫微部分用于提供人格骨架、关系结构、核心性格表达和长期倾向。
              </div>
            </div>
          </InfoCard>

          <div style={{ height: 20 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginBottom: 20 }}>
            <InfoCard title="Timeline 控制台">
              <div style={{ marginBottom: 12, color: "#555", lineHeight: 1.8 }}>
                这里用于可控测试“时间推动”和“事件推动”对当前状态层、阶段偏移与生命轨迹的影响。
              </div>

              <div style={{ marginBottom: 10, fontWeight: 600 }}>当前测试时间</div>
              <div style={{ marginBottom: 16 }}>{formatClock(timelineClock)}</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <ActionButton label="+1 小时" onClick={() => applyTimelineUpdate("推进时间 +1 小时", undefined, 1)} />
                <ActionButton label="+6 小时" onClick={() => applyTimelineUpdate("推进时间 +6 小时", undefined, 6)} />
                <ActionButton label="+1 天" onClick={() => applyTimelineUpdate("推进时间 +1 天", undefined, 24)} />
                <ActionButton label="重置 timeline" onClick={resetTimeline} />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <ActionButton label="喂食" onClick={() => applyTimelineUpdate("事件：喂食", [{ type: "fed", intensity: 0.7 }])} />
                <ActionButton label="休息" onClick={() => applyTimelineUpdate("事件：休息", [{ type: "rested", intensity: 0.7 }])} />
                <ActionButton label="安抚" onClick={() => applyTimelineUpdate("事件：安抚", [{ type: "comforted", intensity: 0.7 }])} />
                <ActionButton label="惊扰" onClick={() => applyTimelineUpdate("事件：惊扰", [{ type: "disturbed", intensity: 0.75 }])} />
                <ActionButton label="陪伴" onClick={() => applyTimelineUpdate("事件：陪伴", [{ type: "bonding", intensity: 0.75 }])} />
                <ActionButton label="忽视" onClick={() => applyTimelineUpdate("事件：忽视", [{ type: "ignored", intensity: 0.45 }])} />
                <ActionButton label="探索刺激" onClick={() => applyTimelineUpdate("事件：探索刺激", [{ type: "stimulated", intensity: 0.45 }])} />
              </div>

              <div style={{ padding: 12, borderRadius: 8, background: "#fafafa", border: "1px solid #eee" }}>
                <strong>最近一次操作：</strong> {lastOperation}
              </div>
            </InfoCard>

            <InfoCard title="📡 Timeline 当前结果">
              {timelineSnapshot ? (
                <div style={{ lineHeight: 1.9, fontSize: 14 }}>
                  <div><strong>阶段：</strong>{PHASE_LABELS[timelineSnapshot.fortune.phaseTag] || timelineSnapshot.fortune.phaseTag}</div>
                  <div style={{ color: "#666", marginBottom: 10 }}>{timelineSnapshot.fortune.summary}</div>
                  <div><strong>情绪状态：</strong>{EMOTIONAL_LABELS[timelineSnapshot.state.emotional.label] || timelineSnapshot.state.emotional.label}</div>
                  <div><strong>生理能量：</strong>{Math.round(timelineSnapshot.state.physical.energy)}</div>
                  <div><strong>饥饿程度：</strong>{Math.round(timelineSnapshot.state.physical.hunger)}</div>
                  <div><strong>认知状态：</strong>{COGNITIVE_LABELS[timelineSnapshot.state.cognitive.label] || timelineSnapshot.state.cognitive.label}</div>
                  <div><strong>关系状态：</strong>{RELATIONAL_LABELS[timelineSnapshot.state.relational.label] || timelineSnapshot.state.relational.label}</div>
                  <div><strong>当前驱动：</strong>{DRIVE_LABELS[timelineSnapshot.state.drive.primary] || timelineSnapshot.state.drive.primary}</div>
                  <div><strong>生命路径：</strong>{BRANCH_LABEL_MAP[timelineSnapshot.trajectory.branchTag] || timelineSnapshot.trajectory.branchTag}</div>
                </div>
              ) : (
                <div>尚未初始化 timeline。</div>
              )}
            </InfoCard>
          </div>

          <InfoCard title="🧭 紫微斗数十二宫盘（调试详情）">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {ZIWEI_LAYOUT.flat().map((branch: BranchPalace | null, index: number) => {
                if (!branch) {
                  return (
                    <div
                      key={`empty-${index}`}
                      style={{
                        border: "1px dashed #ddd",
                        borderRadius: 8,
                        minHeight: 150,
                        background: "#fafafa"
                      }}
                    />
                  )
                }

                return renderBranchCell(branch)
              })}
            </div>
          </InfoCard>

          <div style={{ height: 20 }} />

          <InfoCard title="行为层人格参数（紫微来源）">
            {Object.entries(traits).map(([key, value]: [string, unknown]) => (
              <div key={key} style={{ marginBottom: 6 }}>
                {key} ({DEV_TRAIT_LABELS[key] || "未定义"})： {String(value)}
              </div>
            ))}
          </InfoCard>

          <div style={{ height: 20 }} />

          <InfoCard title="📝 紫微人格摘要">
            {summaries.length > 0 ? (
              <ul>
                {summaries.map((item: string, index: number) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <div>暂无摘要</div>
            )}
          </InfoCard>

          <div style={{ height: 20 }} />
        </>
      )}

      <InfoCard title="🧾 Debug">
        <pre
          style={{
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto",
            fontSize: 12
          }}
        >
          {JSON.stringify(
            {
              finalPersonalityProfile,
              baziProfile,
              ziweiProfile: hasBirthHour
                ? {
                    pattern,
                    debug,
                    publicView,
                    corePersonality,
                    traits,
                    summaries
                  }
                : null,
              timelineClock,
              timelineSnapshot,
              lastDiffs,
              timelineLogs
            },
            null,
            2
          )}
        </pre>
      </InfoCard>
    </div>
  )
}