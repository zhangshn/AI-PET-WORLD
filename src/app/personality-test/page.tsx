"use client"

import { useState } from "react"
import {
  buildPetBirthBundle,
  updatePetAiState,
  type PetBirthAiBundle,
  type PetTimelineSnapshot,
  type StateUpdateEvent
} from "../../ai/gateway"
import type { BranchPalace, SectorName, StarId } from "../../ai/personality-core/schema"
import {
  DEV_SECTOR_LABELS,
  DEV_TRAIT_LABELS,
  getDevStarLabel
} from "./devLabels"

/**
 * ======================================================
 * 地支中文标签
 * ======================================================
 */
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

/**
 * ======================================================
 * 宫位中文兜底
 * ======================================================
 */
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

/**
 * ======================================================
 * 紫微盘固定物理布局
 * ======================================================
 */
const ZIWEI_LAYOUT: (BranchPalace | null)[][] = [
  ["si", "wu", "wei", "shen"],
  ["chen", null, null, "you"],
  ["mao", null, null, "xu"],
  ["yin", "chou", "zi", "hai"]
]

/**
 * ======================================================
 * timeline 展示映射
 * ======================================================
 */
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

/**
 * ======================================================
 * 灏忓伐鍏?
 * ======================================================
 */
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

type TimelineClock = {
  day: number
  hour: number
  period: string
}

const INITIAL_TIMELINE_CLOCK: TimelineClock = {
  day: 1,
  hour: 8,
  period: "Morning"
}

type BirthInputState = {
  year: number
  month: number
  day: number
  hour: number
}

function advanceClock(
  current: TimelineClock,
  hourDelta: number
): TimelineClock {
  const totalHours = (current.day - 1) * 24 + current.hour + hourDelta
  const nextDay = Math.floor(totalHours / 24) + 1
  const nextHour = clampHour(totalHours)
  const nextPeriod = getPeriodFromHour(nextHour)

  return {
    day: Math.max(1, nextDay),
    hour: nextHour,
    period: nextPeriod
  }
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

export default function PersonalityTestPage() {
  /**
   * ======================================================
   * 出生输入
   * ======================================================
   */
  const [year, setYear] = useState(1900)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [hour, setHour] = useState(1)

  /**
   * ======================================================
   * timeline 测试时间
   * ======================================================
   */
  const [timelineClock, setTimelineClock] = useState<TimelineClock>({
    ...INITIAL_TIMELINE_CLOCK
  })

  /**
   * ======================================================
   * 运行中的 AI bundle / snapshot / 操作日志
   * ======================================================
   */
  const [birthBundle, setBirthBundle] = useState<PetBirthAiBundle>(() =>
    buildPetBirthBundle({
      birthInput: {
        year,
        month,
        day,
        hour
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

  function handleBirthInputChange(field: keyof BirthInputState, value: number) {
    const nextValue = Number.isNaN(value) ? 0 : value
    const nextBirthInput: BirthInputState = {
      year,
      month,
      day,
      hour,
      [field]: nextValue
    }

    setYear(nextBirthInput.year)
    setMonth(nextBirthInput.month)
    setDay(nextBirthInput.day)
    setHour(nextBirthInput.hour)
    resetFromBirthInput(nextBirthInput)
  }
  const inputStyle: React.CSSProperties = {
    width: 90,
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 6,
    marginRight: 8
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
            alignItems: "center",
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

    /**
     * 鍏抽敭淇锛?
     * - 浜嬩欢鎸夐挳涓嶅簲璇ラ粯璁ら檮甯?1 灏忔椂鑷劧娴侀€?
     * - 只有真实时间推进时，tickDelta 鎵?> 0
     */
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
      hour
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
      <h2 style={{ marginBottom: 16 }}>🧠 人格核心测试命盘（紫微十二宫开发版）</h2>

      {/* ================= 杈撳叆鍖?================= */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 16,
          background: "#fff",
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center"
        }}
      >
        <label>
          年：
          <input
            style={inputStyle}
            type="number"
            value={year}
            onChange={(e) =>
              handleBirthInputChange("year", Number(e.target.value))
            }
          />
        </label>

        <label>
          月：
          <input
            style={inputStyle}
            type="number"
            value={month}
            onChange={(e) =>
              handleBirthInputChange("month", Number(e.target.value))
            }
          />
        </label>

        <label>
          日：
          <input
            style={inputStyle}
            type="number"
            value={day}
            onChange={(e) =>
              handleBirthInputChange("day", Number(e.target.value))
            }
          />
        </label>

        <label>
          时：
          <input
            style={inputStyle}
            type="number"
            value={hour}
            onChange={(e) =>
              handleBirthInputChange("hour", Number(e.target.value))
            }
          />
        </label>
      </div>

      {/* ================= timeline 实验面板 ================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 16,
          marginBottom: 20
        }}
      >
        <InfoCard title="Timeline 控制台">
          <div style={{ marginBottom: 12, color: "#555", lineHeight: 1.8 }}>
            这里用于可控测试“时间推动”和“事件推动”对当前状态层、阶段偏移与生命轨迹的影响。
          </div>

          <div style={{ marginBottom: 10, fontWeight: 600 }}>当前测试时间</div>
          <div style={{ marginBottom: 16 }}>
            {formatClock(timelineClock)}
          </div>

          <div style={{ marginBottom: 10, fontWeight: 600 }}>时间推进</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <ActionButton
              label="+1 小时"
              onClick={() => applyTimelineUpdate("推进时间 +1 小时", undefined, 1)}
            />
            <ActionButton
              label="+6 小时"
              onClick={() => applyTimelineUpdate("推进时间 +6 小时", undefined, 6)}
            />
            <ActionButton
              label="+1 天"
              onClick={() => applyTimelineUpdate("推进时间 +1 天", undefined, 24)}
            />
            <ActionButton
              label="重置 timeline"
              onClick={resetTimeline}
            />
          </div>

          <div style={{ marginBottom: 10, fontWeight: 600 }}>事件推动</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <ActionButton
              label="喂食"
              onClick={() =>
                applyTimelineUpdate("事件：喂食", [
                  { type: "fed", intensity: 0.7 }
                ])
              }
            />
            <ActionButton
              label="休息"
              onClick={() =>
                applyTimelineUpdate("事件：休息", [
                  { type: "rested", intensity: 0.7 }
                ])
              }
            />
            <ActionButton
              label="安抚"
              onClick={() =>
                applyTimelineUpdate("事件：安抚", [
                  { type: "comforted", intensity: 0.7 }
                ])
              }
            />
            <ActionButton
              label="惊扰"
              onClick={() =>
                applyTimelineUpdate("事件：惊扰", [
                  { type: "disturbed", intensity: 0.75 }
                ])
              }
            />
            <ActionButton
              label="陪伴"
              onClick={() =>
                applyTimelineUpdate("事件：陪伴", [
                  { type: "bonding", intensity: 0.75 }
                ])
              }
            />
            <ActionButton
              label="忽视"
              onClick={() =>
                applyTimelineUpdate("事件：忽视", [
                  { type: "ignored", intensity: 0.45 }
                ])
              }
            />
            <ActionButton
              label="探索刺激"
              onClick={() =>
                applyTimelineUpdate("事件：探索刺激", [
                  { type: "stimulated", intensity: 0.45 }
                ])
              }
            />
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#fafafa",
              border: "1px solid #eee"
            }}
          >
            <strong>最近一次操作：</strong> {lastOperation}
          </div>
        </InfoCard>

        <InfoCard title="📡 Timeline 当前结果">
          {timelineSnapshot ? (
            <div style={{ lineHeight: 1.9, fontSize: 14 }}>
              <div>
                <strong>阶段：</strong>
                {PHASE_LABELS[timelineSnapshot.fortune.phaseTag] || timelineSnapshot.fortune.phaseTag}
              </div>
              <div style={{ color: "#666", marginBottom: 10 }}>
                {timelineSnapshot.fortune.summary}
              </div>

              <div>
                <strong>情绪状态：</strong>
                {EMOTIONAL_LABELS[timelineSnapshot.state.emotional.label] ||
                  timelineSnapshot.state.emotional.label}
              </div>

              <div>
                <strong>生理能量：</strong>
                {Math.round(timelineSnapshot.state.physical.energy)}
              </div>

              <div>
                <strong>饥饿程度：</strong>
                {Math.round(timelineSnapshot.state.physical.hunger)}
              </div>

              <div>
                <strong>认知状态：</strong>
                {COGNITIVE_LABELS[timelineSnapshot.state.cognitive.label] ||
                  timelineSnapshot.state.cognitive.label}
              </div>

              <div>
                <strong>关系状态：</strong>
                {RELATIONAL_LABELS[timelineSnapshot.state.relational.label] ||
                  timelineSnapshot.state.relational.label}
              </div>

              <div>
                <strong>当前驱动：</strong>
                {DRIVE_LABELS[timelineSnapshot.state.drive.primary] ||
                  timelineSnapshot.state.drive.primary}
              </div>

              <div style={{ marginTop: 10 }}>
                <strong>生命路径：</strong>
                {BRANCH_LABEL_MAP[timelineSnapshot.trajectory.branchTag] ||
                  timelineSnapshot.trajectory.branchTag}
              </div>

              <div style={{ color: "#666", marginTop: 4 }}>
                {timelineSnapshot.trajectory.summary}
              </div>

              <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid #eee" }} />

              <div style={{ fontWeight: 600, marginBottom: 8 }}>当前参数快照</div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div>phaseTag: {timelineSnapshot.fortune.phaseTag}</div>
                <div>emotional.label: {timelineSnapshot.state.emotional.label}</div>
                <div>physical.energy: {Math.round(timelineSnapshot.state.physical.energy)}</div>
                <div>physical.hunger: {Math.round(timelineSnapshot.state.physical.hunger)}</div>
                <div>cognitive.label: {timelineSnapshot.state.cognitive.label}</div>
                <div>relational.label: {timelineSnapshot.state.relational.label}</div>
                <div>drive.primary: {timelineSnapshot.state.drive.primary}</div>
                <div>trajectory.branchTag: {timelineSnapshot.trajectory.branchTag}</div>
              </div>
            </div>
          ) : (
            <div>尚未初始化 timeline。</div>
          )}
        </InfoCard>
      </div>

      {/* ================= 鏈€杩戝彉鍖栬鎯?+ 日志 ================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: 16,
          marginBottom: 20
        }}
      >
        <InfoCard title="最近一次参数变化">
          <div style={{ marginBottom: 10 }}>
            <strong>最近操作：</strong> {lastOperation}
          </div>

          <div style={{ marginBottom: 10 }}>
            <strong>当前测试时间：</strong> {formatClock(timelineClock)}
          </div>

          {lastDiffs.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
              {lastDiffs.map((diff, index) => (
                <li key={`${diff.label}-${index}`}>
                  {diff.label}: {String(diff.before)} → {String(diff.after)}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "#666" }}>当前还没有参数变化记录。</div>
          )}
        </InfoCard>

        <InfoCard title="📚 Timeline 操作日志">
          {timelineLogs.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: 520,
                overflowY: "auto",
                paddingRight: 4
              }}
            >
              {timelineLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    border: "1px solid #eaeaea",
                    borderRadius: 8,
                    padding: 12,
                    background: "#fafafa"
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    {log.actionLabel}
                  </div>

                  <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                    {log.createdAt} · {formatClock(log.beforeClock)} → {formatClock(log.afterClock)}
                  </div>

                  <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>
                    <div>phase: {log.snapshotSummary.phase}</div>
                    <div>emotional: {log.snapshotSummary.emotional}</div>
                    <div>energy: {log.snapshotSummary.energy}</div>
                    <div>hunger: {log.snapshotSummary.hunger}</div>
                    <div>cognitive: {log.snapshotSummary.cognitive}</div>
                    <div>relational: {log.snapshotSummary.relational}</div>
                    <div>drive: {log.snapshotSummary.drive}</div>
                    <div>branch: {log.snapshotSummary.branch}</div>
                  </div>

                  {log.diffs.length > 0 ? (
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                      <strong>变化：</strong>
                      <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                        {log.diffs.map((diff, index) => (
                          <li key={`${log.id}-${diff.label}-${index}`}>
                            {diff.label}: {String(diff.before)} → {String(diff.after)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#666" }}>
                      这次操作没有造成可见参数变化。
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#666" }}>还没有日志，请先点击时间推进或事件按钮。</div>
          )}
        </InfoCard>
      </div>

      {/* ================= 公开展示人格 ================= */}
      <InfoCard title="🌤 对外公开人格结果">
        <div style={{ marginBottom: 8 }}>
          <strong>先天气质：</strong> {publicView.innateTemperamentLabel}
        </div>

        <div>
          <strong>公开摘要：</strong>
          {publicView.publicSummaries.length > 0 ? (
            <ul>
              {publicView.publicSummaries.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <div>暂无公开摘要</div>
          )}
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 中央校验信息 ================= */}
      <InfoCard title="📌 核心校验信息">
        <div style={{ marginBottom: 8 }}>
          出生键：
          <strong> {pattern.birthKey}</strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          核心宫位：
          <strong>
            {" "}
            {getSectorLabel(pattern.primarySector)} ({pattern.primarySector})
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          命宫地支：
          <strong>
            {" "}
            {BRANCH_LABELS[pattern.primaryBranchPalace]} ({pattern.primaryBranchPalace})
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          身宫地支：
          <strong>
            {" "}
            {BRANCH_LABELS[pattern.bodyBranchPalace]} ({pattern.bodyBranchPalace})
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          对宫：
          <strong>
            {" "}
            {getSectorLabel(pattern.oppositeSector)} ({BRANCH_LABELS[pattern.oppositeBranchPalace]})
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          核心星曜：
          <strong>
            {" "}
            {pattern.primaryStars.length > 0
              ? pattern.primaryStars.map(getStarDisplay).join(" / ")
              : "空宫"}
          </strong>
        </div>

        <div>
          support 宫位：
          <strong>
            {" "}
            {pattern.supportSectors.map((sector) => getSectorLabel(sector)).join(" / ")}
          </strong>
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 正规紫微斗数十二宫盘 ================= */}
      <InfoCard title="🧭 紫微斗数十二宫盘（地支物理位置固定）">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8
          }}
        >
          {ZIWEI_LAYOUT.flat().map((branch, index) => {
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

        <div style={{ marginTop: 12, color: "#666", fontSize: 12, lineHeight: 1.7 }}>
          <div>说明：</div>
          <div>1. 格子物理位置固定，宫位名称由当前命盘映射决定。</div>
          <div>2. 红框=命宫，黄框=对宫，蓝色虚线框=support 宫位。</div>
          <div>3. 空宫会额外展示借星。</div>
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 鍐滃巻涓庢椂杈颁俊鎭?================= */}
      <InfoCard title="农历与时辰信息">
        <div style={{ marginBottom: 8 }}>
          阳历：
          <strong>
            {" "}
            {pattern.lunarInfo.solarYear}-{pattern.lunarInfo.solarMonth}-{pattern.lunarInfo.solarDay}{" "}
            {pattern.lunarInfo.solarHour}:{String(pattern.lunarInfo.solarMinute).padStart(2, "0")}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          农历：
          <strong>
            {" "}
            {pattern.lunarInfo.lunarYear}年{pattern.lunarInfo.lunarMonth}月{pattern.lunarInfo.lunarDay}日
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          时辰：
          <strong>
            {" "}
            {BRANCH_LABELS[pattern.lunarInfo.timeBranch]} ({pattern.lunarInfo.timeBranch})
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          timeBranchIndex：
          <strong> {pattern.lunarInfo.timeBranchIndex}</strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          timeBranchNumber：
          <strong> {pattern.lunarInfo.timeBranchNumber}</strong>
        </div>

        <div>
          formulaTimeIndex：
          <strong> {pattern.lunarInfo.formulaTimeIndex}</strong>
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 核心人格信息 ================= */}
      <InfoCard title="🧬 核心人格信息">
        <div style={{ marginBottom: 8 }}>
          核心宫位：
          <strong>
            {" "}
            {getSectorLabel(pattern.primarySector)} ({BRANCH_LABELS[pattern.primaryBranchPalace]})
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          核心星曜：
          <strong>
            {" "}
            {debug?.primaryStars?.length
              ? debug.primaryStars.map(getStarDisplay).join(" + ")
              : "无"}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          命宫组合：
          <strong>
            {" "}
            {debug?.hitPairs?.length
              ? debug.hitPairs
                  .map(
                    (pair) =>
                      `${pair.pairId} (${pair.starIds
                        .map((starId) => getDevStarLabel(starId))
                        .join(" + ")})`
                  )
                  .join(" / ")
              : "无"}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          三方四正组合：
          <strong>
            {" "}
            {debug?.supportPairs?.length
              ? debug.supportPairs
                  .map(
                    (pair) =>
                      `${pair.pairId} (${pair.starIds
                        .map((starId) => getDevStarLabel(starId))
                        .join(" + ")})`
                  )
                  .join(" / ")
              : "无"}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          联动宫位：
          <strong>
            {" "}
            {debug?.supportSectors?.length
              ? debug.supportSectors
                  .map((sector) => `${sector} (${getSectorLabel(sector)})`)
                  .join(" / ")
              : "无"}
          </strong>
        </div>

        <div>
          联动星曜：
          <strong>
            {" "}
            {debug?.supportStars?.length
              ? debug.supportStars.map(getStarDisplay).join(" / ")
              : "无"}
          </strong>
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 核心 5 缁翠汉鏍?================= */}
      <InfoCard title="核心 5 维人格">
        {Object.entries(corePersonality).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 6 }}>
            {key}: {value}
          </div>
        ))}
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 琛屼负灞?traits ================= */}
      <InfoCard title="行为层人格参数">
        {Object.entries(traits).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 6 }}>
            {key} ({DEV_TRAIT_LABELS[key] || "未定义"})： {value}
          </div>
        ))}
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= 摘要 ================= */}
      <InfoCard title="📝 人格摘要">
        {summaries.length > 0 ? (
          <ul>
            {summaries.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <div>暂无摘要</div>
        )}
      </InfoCard>

      <div style={{ height: 20 }} />

      {/* ================= Debug ================= */}
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
              pattern,
              debug,
              publicView,
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





