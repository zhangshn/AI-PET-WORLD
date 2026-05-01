"use client"

/**
 * 当前文件负责：组装 AI 人格核心测试页。
 */

import {
  BaziProfilePanel,
  BaziRuntimePanel,
  BirthInputBar,
  FinalPersonalityPanel,
  PersonalityTestMainGrid,
  PersonalityTestPageShell,
  PersonalityTestTitle,
  PublicViewPanel,
  SectionSpacer,
  TimelineTestPanel,
  ZiweiDynamicPanel,
  ZiweiPersonalityOutputPanel
} from "./components/personality-test-components"

import { useBaziRuntimeState } from "./hooks/useBaziRuntimeState"
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
    parsedBirthHour,
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

  const baziRuntimeProfile = useBaziRuntimeState({
    baziProfile,
    dynamicGender,
    currentYear: year,
    currentMonth: month,
    currentDay: day,
    currentHour: parsedBirthHour
  })

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
        right={
          <>
            <BaziProfilePanel baziProfile={baziProfile} />

            <SectionSpacer />

            <BaziRuntimePanel runtimeProfile={baziRuntimeProfile} />
          </>
        }
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

      <PublicViewPanel publicView={publicView} />
    </PersonalityTestPageShell>
  )
}