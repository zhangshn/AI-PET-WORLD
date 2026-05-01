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
import { ValueLine } from "./components/common/ValueLine"
import { JsonBlock } from "./components/debug/JsonBlock"
import { FinalPersonalityPanel } from "./components/final-profile/FinalPersonalityPanel"
import { TimelineTestPanel } from "./components/timeline-test/TimelineTestPanel"
import type {
  DiffItem,
  TimelineClock,
  TimelineLogEntry
} from "./components/timeline-test/timeline-types"
import {
  advanceClock,
  buildTimelineDiffs
} from "./components/timeline-test/timeline-utils"
import { ZiweiDynamicPanel } from "./components/ZiweiDynamicPanel"
import { ZiweiPersonalityOutputPanel } from "./components/ziwei-output/ZiweiPersonalityOutputPanel"

type BirthInputState = {
  year: number
  month: number
  day: number
  hour: number
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

      <FinalPersonalityPanel
        hasBirthHour={hasBirthHour}
        finalPersonalityProfile={finalPersonalityProfile}
      />

      <div style={{ height: 20 }} />

      <ZiweiPersonalityOutputPanel
        corePersonality={profile.corePersonality}
        traits={profile.traits}
        summaries={profile.summaries}
        debug={profile.debug}
      />

      <div style={{ height: 20 }} />

      <TimelineTestPanel
        timelineClock={timelineClock}
        timelineSnapshot={timelineSnapshot}
        lastOperation={lastOperation}
        lastDiffs={lastDiffs}
        timelineLogs={timelineLogs}
        onApplyTimelineUpdate={applyTimelineUpdate}
        onResetTimeline={resetTimeline}
      />

      <div style={{ height: 20 }} />

      <InfoCard title="🪟 公开展示视图">
        <JsonBlock value={publicView} />
      </InfoCard>
    </div>
  )
}