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

import { PersonalityTestRuntimeTimePanel } from "./runtime-time/PersonalityTestRuntimeTimePanel"
import { usePersonalityTestRuntimeTime } from "./runtime-time/usePersonalityTestRuntimeTime"

import { usePersonalityTestState } from "./hooks/usePersonalityTestState"

function SectionTitle({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      style={{
        margin: "20px 0 12px",
        padding: "12px 14px",
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
      <div style={{ color: "#666", marginTop: 6, lineHeight: 1.7 }}>
        {description}
      </div>
    </div>
  )
}

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

  const {
    runtimeTime,
    setFromZiweiSelection,
    setFromBaziSelection,
  } = usePersonalityTestRuntimeTime({
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    birthHour: parsedBirthHour,
    lunarMonth: pattern?.lunarInfo.lunarMonth ?? month,
    lunarDay: pattern?.lunarInfo.lunarDay ?? day,
  })

  return (
    <PersonalityTestPageShell>
      <PersonalityTestTitle />

      <SectionTitle
        title="① 出生输入区"
        description="这里只负责生成原始出生数据。紫微需要完整出生时间；八字可以在缺少出生时间时进入三柱模式。"
      />

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

      <SectionSpacer />

      <SectionTitle
        title="② 统一动态时间区"
        description="紫微和八字共用同一个当前时间点；但两者的大运起运、运段归属、动态结果必须各自独立计算。"
      />

      <PersonalityTestRuntimeTimePanel runtimeTime={runtimeTime} />

      <SectionTitle
        title="③ 紫微核心区"
        description="紫微是主系统，负责生命底盘、动态流盘、当前流动人格与行动趋向。"
      />

      {hasBirthHour && pattern !== null ? (
        <>
          <ZiweiDynamicPanel
            key={`${pattern.birthKey}-${year}-${month}-${day}-${birthHourInput}-${dynamicGender}`}
            pattern={pattern}
            baseProfile={profile}
            hasBirthHour={hasBirthHour}
            dynamicGender={dynamicGender}
            runtimeTime={runtimeTime}
            onRuntimeTimeChange={setFromZiweiSelection}
          />

          <SectionSpacer />
        </>
      ) : (
        <div style={{ color: "#a66", lineHeight: 1.8 }}>
          当前出生时间未知，紫微核心区暂不运行完整命盘与动态流。
        </div>
      )}

      <SectionTitle
        title="④ 八字辅助区"
        description="八字是辅助系统，负责五行气质、动态环境场与行动修正。它跟随同一个当前时间点，但按自己的起运规则独立落位。"
      />

      <BaziRuntimePanel
        key={`${year}-${month}-${day}-${birthHourInput}-${dynamicGender}-bazi-runtime`}
        baziProfile={baziProfile}
        dynamicGender={dynamicGender}
        runtimeTime={runtimeTime}
        onRuntimeTimeChange={setFromBaziSelection}
      />

      <SectionSpacer />

      <SectionTitle
        title="⑤ 五维性格分析区"
        description="这里展示性别视角、五维人格解释与生命功能倾向，属于解释层，不直接控制行为。"
      />

      <PersonalityInterpretationPanel
        dynamicGender={dynamicGender}
        lifeProfileBundle={lifeProfileBundle}
      />

      {hasBirthHour && profile !== null && publicView !== null ? (
        <>
          <SectionSpacer />

          <SectionTitle
            title="⑥ 原始人格 / 公开视图调试区"
            description="这里保留原盘人格、traits、debug 与正式展示用 public view，方便对比原始底盘和动态流动结果。"
          />

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

      <SectionTitle
        title="⑦ Timeline / 行为链路测试区"
        description="这里用于测试生命阶段、记忆、状态变化与后续行为链路，不属于命理原始计算区。"
      />

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