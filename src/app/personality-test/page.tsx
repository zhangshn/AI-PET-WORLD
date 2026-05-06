"use client"

/**
 * 当前文件负责：组装 AI 人格核心测试页。
 */

import {
  BaziRuntimePanel,
  BirthInputBar,
  PersonalityInterpretationPanel,
  PersonalityTestPageShell,
  PersonalityTestTitle,
  PublicViewPanel,
  SectionSpacer,
  TimelineTestPanel,
  ZiweiDynamicPanel,
  ZiweiPersonalityOutputPanel,
} from "./components/personality-test-components"

import { usePersonalityTestState } from "./hooks/usePersonalityTestState"

export default function PersonalityTestPage() {
  const {
    birthInput,
    profileData,
    timelineData,
    actions,
  } = usePersonalityTestState()

  const {
    year,
    month,
    day,
    birthHourInput,
    dynamicGender,
    parsedBirthHour,
    hasBirthHour,
  } = birthInput

  const {
    lifeProfileBundle,
    profile,
    publicView,
    pattern,
    baziProfile,
  } = profileData

  const {
    timelineClock,
    timelineSnapshot,
    lastOperation,
    lastDiffs,
    timelineLogs,
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

      {hasBirthHour && pattern !== null ? (
        <>
          <ZiweiDynamicPanel
            key={`${pattern.birthKey}-${year}-${month}-${day}-${birthHourInput}-${dynamicGender}`}
            pattern={pattern}
            baseProfile={profile}
            hasBirthHour={hasBirthHour}
            dynamicGender={dynamicGender}
            currentYear={year}
            timelineDay={timelineClock.day}
            timelineHour={timelineClock.hour}
          />

          <SectionSpacer />
        </>
      ) : null}

      <BaziRuntimePanel
        key={`${year}-${month}-${day}-${birthHourInput}-${dynamicGender}-bazi-runtime`}
        baziProfile={baziProfile}
        dynamicGender={dynamicGender}
        initialYear={year}
        initialMonth={month}
        initialDay={day}
        initialHour={parsedBirthHour}
      />

      <SectionSpacer />

      <PersonalityInterpretationPanel
        dynamicGender={dynamicGender}
        lifeProfileBundle={lifeProfileBundle}
      />

      {hasBirthHour && profile !== null && publicView !== null ? (
        <>
          <SectionSpacer />

          <ZiweiPersonalityOutputPanel
            corePersonality={profile.corePersonality}
            traits={profile.traits}
            summaries={profile.summaries}
            debug={profile.debug}
          />

          <SectionSpacer />

          <PublicViewPanel publicView={publicView} />
        </>
      ) : null}

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
    </PersonalityTestPageShell>
  )
}