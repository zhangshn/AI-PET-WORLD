"use client"

/**
 * 当前文件负责：组装 AI 人格核心测试页。
 */

import { BaziProfilePanel } from "./components/bazi-panel/BaziProfilePanel"
import { BirthInputBar } from "./components/birth-input/BirthInputBar"
import { InfoCard } from "./components/common/InfoCard"
import { JsonBlock } from "./components/debug/JsonBlock"
import { FinalPersonalityPanel } from "./components/final-profile/FinalPersonalityPanel"
import { TimelineTestPanel } from "./components/timeline-test/TimelineTestPanel"
import { ZiweiDynamicPanel } from "./components/ZiweiDynamicPanel"
import { ZiweiPersonalityOutputPanel } from "./components/ziwei-output/ZiweiPersonalityOutputPanel"

import { usePersonalityTestState } from "./hooks/usePersonalityTestState"

export default function PersonalityTestPage() {
  const {
    birthInput,
    profileData,
    timelineData,
    actions
  } = usePersonalityTestState()

  const {
    year,
    month,
    day,
    birthHourInput,
    dynamicGender,
    hasBirthHour
  } = birthInput

  const {
    profile,
    publicView,
    pattern,
    baziProfile,
    finalPersonalityProfile
  } = profileData

  const {
    timelineClock,
    timelineSnapshot,
    lastOperation,
    lastDiffs,
    timelineLogs
  } = timelineData

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

      <BirthInputBar
        year={year}
        month={month}
        day={day}
        birthHourInput={birthHourInput}
        dynamicGender={dynamicGender}
        onDateChange={actions.handleDateChange}
        onBirthHourInputChange={actions.handleBirthHourInputChange}
        onDynamicGenderChange={actions.setDynamicGender}
      />

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

        <BaziProfilePanel baziProfile={baziProfile} />
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
        onApplyTimelineUpdate={actions.applyTimelineUpdate}
        onResetTimeline={actions.resetTimeline}
      />

      <div style={{ height: 20 }} />

      <InfoCard title="🪟 公开展示视图">
        <JsonBlock value={publicView} />
      </InfoCard>
    </div>
  )
}