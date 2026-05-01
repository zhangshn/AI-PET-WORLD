"use client"

/**
 * 当前文件负责：组装 AI 人格核心测试页。
 */

import { useMemo, useState } from "react"

import {
  buildPetBirthBundle,
  updatePetAiState,
  type PetBirthAiBundle,
  type PetTimelineSnapshot,
  type StateUpdateEvent
} from "../../ai/gateway"

import { buildBaziProfile } from "../../ai/bazi-core/bazi-gateway"
import { buildFinalPersonalityProfile } from "../../ai/personality-vector/vector-gateway"

import { WUXING_LABELS } from "./constants"
import type { DynamicGenderInput } from "./types"

import { ComboInput } from "./components/common/ComboInput"
import { InfoCard } from "./components/common/InfoCard"
import { ScoreLine } from "./components/common/ScoreLine"
import { ValueLine } from "./components/common/ValueLine"
import { ZiweiDynamicPanel } from "./components/ZiweiDynamicPanel"

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

const FINAL_VECTOR_LABELS: Record<string, string> = {
  curiosity: "好奇心",
  activity: "行动性",
  stability: "稳定性",
  sensitivity: "敏感度",
  discipline: "秩序 / 自律",
  attachment: "依附 / 关系需求",
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

const PHASE_LABELS: Record<string, string> = {
  stable_phase: "平稳阶段",
  growth_phase: "成长扩张阶段",
  sensitive_phase: "敏感波动阶段",
  recovery_phase: "修整恢复阶段",
  attachment_phase: "亲近依附阶段",
  withdrawal_phase: "收缩回避阶段"
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
  observe: "观察",
  idle: "待机"
}

const BRANCH_LABEL_MAP: Record<string, string> = {
  balanced: "平衡路径",
  attachment: "亲近路径",
  defense: "防御路径",
  curiosity: "探索路径",
  recovery: "恢复路径",
  survival: "应对路径"
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        background: "#f7f7f7",
        padding: 12,
        borderRadius: 8,
        overflowX: "auto",
        fontSize: 12
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
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
  const [year, setYear] = useState(1900)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthHourInput, setBirthHourInput] = useState("未知")
  const [dynamicGender, setDynamicGender] = useState<DynamicGenderInput>("")

  const parsedBirthHour = useMemo(() => {
    return parseBirthHourInput(birthHourInput)
  }, [birthHourInput])

  const hasBirthHour = parsedBirthHour !== null
  const ziweiHour = parsedBirthHour ?? 0

  const [timelineClock, setTimelineClock] = useState<TimelineClock>({
    ...INITIAL_TIMELINE_CLOCK
  })

  const [birthBundle, setBirthBundle] = useState<PetBirthAiBundle>(() => {
    return buildPetBirthBundle({
      birthInput: {
        year,
        month,
        day,
        hour: 0
      },
      time: INITIAL_TIMELINE_CLOCK
    })
  })

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
          options={Array.from({ length: 201 }, (_, index) => {
            return String(1900 + index)
          })}
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
          options={Array.from({ length: 12 }, (_, index) => {
            return String(index + 1)
          })}
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
          options={Array.from({ length: 31 }, (_, index) => {
            return String(index + 1)
          })}
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
          options={[
            "未知",
            ...Array.from({ length: 24 }, (_, index) => {
              return String(index)
            })
          ]}
          onChange={handleBirthHourInputChange}
        />

        <ComboInput
          label="性别"
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)",
          gap: 20,
          alignItems: "start"
        }}
      >
        <ZiweiDynamicPanel
          key={`${pattern.birthKey}-${year}-${month}-${day}-${birthHourInput}-${dynamicGender}`}
          pattern={pattern}
          hasBirthHour={hasBirthHour}
          dynamicGender={dynamicGender}
          currentYear={year}
          timelineDay={timelineClock.day}
          timelineHour={timelineClock.hour}
        />

        <InfoCard title="☯ 八字动力底盘">
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
                .map((element: string) => {
                  return WUXING_LABELS[element] ?? element
                })
                .join(" / ")}
            />
          </div>
        </InfoCard>
      </div>

      <div style={{ height: 20 }} />

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
              {Object.entries(finalPersonalityProfile.vector).map(([key, value]) => {
                return (
                  <ScoreLine
                    key={key}
                    name={key}
                    label={FINAL_VECTOR_LABELS[key]}
                    value={Number(value)}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <strong>宠物行为偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.petBehaviorBias).map(
                ([key, value]) => {
                  return (
                    <ScoreLine
                      key={key}
                      name={key}
                      label={FINAL_BIAS_LABELS[key]}
                      value={Number(value)}
                    />
                  )
                }
              )}
            </div>
          </div>

          <div>
            <strong>管家行为偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.butlerBehaviorBias).map(
                ([key, value]) => {
                  return (
                    <ScoreLine
                      key={key}
                      name={key}
                      label={FINAL_BIAS_LABELS[key]}
                      value={Number(value)}
                    />
                  )
                }
              )}
            </div>
          </div>

          <div>
            <strong>建筑 / 家园偏置</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(finalPersonalityProfile.bias.buildingBias).map(
                ([key, value]) => {
                  return (
                    <ScoreLine
                      key={key}
                      name={key}
                      label={FINAL_BIAS_LABELS[key]}
                      value={Number(value)}
                    />
                  )
                }
              )}
            </div>
          </div>
        </div>
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
              {Object.entries(corePersonality).map(([key, value]) => {
                return (
                  <ScoreLine
                    key={key}
                    name={key}
                    value={Number(value) * 100}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <strong>行为 traits</strong>
            <div style={{ marginTop: 10 }}>
              {Object.entries(traits).map(([key, value]) => {
                return (
                  <ScoreLine
                    key={key}
                    name={key}
                    value={Number(value)}
                  />
                )
              })}
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
            summaries.map((summary) => {
              return <div key={summary}>- {summary}</div>
            })
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
            onClick={() => {
              applyTimelineUpdate("推进时间 +1 小时", undefined, 1)
            }}
          />
          <ActionButton
            label="推进 +6 小时"
            onClick={() => {
              applyTimelineUpdate("推进时间 +6 小时", undefined, 6)
            }}
          />
          <ActionButton
            label="推进 +1 天"
            onClick={() => {
              applyTimelineUpdate("推进时间 +1 天", undefined, 24)
            }}
          />
          <ActionButton
            label="模拟被安抚"
            onClick={() => {
              applyTimelineUpdate("模拟被安抚", [
                {
                  type: "comforted",
                  intensity: 0.75
                }
              ])
            }}
          />
          <ActionButton
            label="模拟环境刺激"
            onClick={() => {
              applyTimelineUpdate("模拟环境刺激", [
                {
                  type: "stimulated",
                  intensity: 0.85
                }
              ])
            }}
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
                  lastDiffs.map((item) => {
                    return (
                      <div key={`${item.label}-${item.before}-${item.after}`}>
                        {item.label}：{item.before} → {item.after}
                      </div>
                    )
                  })
                ) : (
                  <div style={{ color: "#999" }}>
                    这次操作没有造成可见参数变化。
                  </div>
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
            timelineLogs.slice(0, 20).map((item) => {
              return (
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
              )
            })
          ) : (
            <div style={{ color: "#999" }}>暂无日志</div>
          )}
        </div>
      </InfoCard>

      <div style={{ height: 20 }} />

      <InfoCard title="🪟 公开展示视图">
        <JsonBlock value={publicView} />
      </InfoCard>
    </div>
  )
}