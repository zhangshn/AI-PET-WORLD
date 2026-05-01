"use client"

/**
 * 当前文件负责：组装 AI 人格核心测试页。
 */

import { BaziProfilePanel } from "./components/bazi-panel/BaziProfilePanel"
import { BirthInputBar } from "./components/birth-input/BirthInputBar"
import { InfoCard } from "./components/common/InfoCard"
import { JsonBlock } from "./components/debug/JsonBlock"
import { FinalPersonalityPanel } from "./components/final-profile/FinalPersonalityPanel"
import { PersonalityTestMainGrid } from "./components/layout/PersonalityTestMainGrid"
import { PersonalityTestPageShell } from "./components/layout/PersonalityTestPageShell"
import { PersonalityTestTitle } from "./components/layout/PersonalityTestTitle"
import { SectionSpacer } from "./components/layout/SectionSpacer"
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
    <PersonalityTestPageShell>
      <PersonalityTestTitle />

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

      <PersonalityTestMainGrid
        left={
          <ZiweiDynamicPanel
            key={`${pattern.birthKey}-${year}-${month}-${day}-${birthHourInput}-${dynamicGender}`}
            pattern={pattern}
            hasBirthHour={hasBirthHour}
            dynamicGender={dynamicGender}
            currentYear={year}
            timelineDay={timelineClock.day}
            timelineHour={timelineClock.hour}
          />
        }
        right={<BaziProfilePanel baziProfile={baziProfile} />}
      />

      <SectionSpacer />

      <FinalPersonalityPanel
        hasBirthHour={hasBirthHour}
        finalPersonalityProfile={finalPersonalityProfile}
      />

      <SectionSpacer />

      <ZiweiPersonalityOutputPanel
        corePersonality={profile.corePersonality}
        traits={profile.traits}
        summaries={profile.summaries}
        debug={profile.debug}
      />

      <SectionSpacer />

      <TimelineTestPanel
        timelineClock={timelineClock}
        timelineSnapshot={timelineSnapshot}
        lastOperation={lastOperation}
        lastDiffs={lastDiffs}
        timelineLogs={timelineLogs}
        onApplyTimelineUpdate={actions.applyTimelineUpdate}
        onResetTimeline={actions.resetTimeline}
      />

      <SectionSpacer />

      <InfoCard title="🪟 公开展示视图">
        <JsonBlock value={publicView} />
      </InfoCard>
    </PersonalityTestPageShell>
  )
}