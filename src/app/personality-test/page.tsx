"use client"

/**
 * 当前文件负责：组装 AI 人格核心测试页。
 */

import { useState } from "react"

import {
  BaziProfilePanel,
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

import type { ActiveDynamicFlow } from "./types"
import type { BaziRuntimeActiveLevel } from "./components/bazi-runtime-panel/bazi-runtime-panel-types"

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

function DataExplainPanel() {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        lineHeight: 1.8,
      }}
    >
      <strong>📌 数据说明</strong>

      <div style={{ marginTop: 10, color: "#555" }}>
        <div>
          <strong>紫微：</strong>
          主系统。负责生命底盘、动态流盘、当前流动人格与行动趋向。
        </div>

        <div>
          <strong>八字：</strong>
          辅助系统。负责五行气质、动态环境场、行动强度、恢复、谨慎、感知等修正。
        </div>

        <div>
          <strong>五维性格映射：</strong>
          解释层。用于把底层命理结果翻译成更可读的性格维度和生命功能倾向。
        </div>

        <div>
          <strong>同步规则：</strong>
          紫微和八字同步的是“当前时间点”和“当前查看层级”，不是同步大运起运结果。
          紫微和八字的大运起运岁数、运段归属、动态结果必须由各自系统独立计算。
        </div>

        <div>
          <strong>未来游戏接入：</strong>
          当前测试页里的统一动态时间，后续会来自世界运行时间；
          当前动态人格和行动趋向会进入 drive / goal / behavior 链路，影响宠物和管家的未来行动倾向。
        </div>
      </div>
    </div>
  )
}

function toBaziRuntimeLevel(
  activeFlow: ActiveDynamicFlow
): BaziRuntimeActiveLevel {
  if (activeFlow === "natal") {
    return "daYun"
  }

  return activeFlow
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

  const [activeRuntimeLevel, setActiveRuntimeLevel] =
    useState<ActiveDynamicFlow>("natal")

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
        title="一、命理运行区"
        description="这里先展示紫微和八字的运行内容。紫微是主系统，八字是辅助系统；两者同步当前时间点和查看层级，但各自独立计算起运与运段。"
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

      <PersonalityTestRuntimeTimePanel runtimeTime={runtimeTime} />

      <SectionTitle
        title="1. 紫微核心内容"
        description="紫微负责生命底盘、动态流盘、当前流动人格与行动趋向，是后续生命趋向系统的主线。"
      />

      {hasBirthHour && pattern !== null ? (
        <>
          <ZiweiDynamicPanel
            key={`${pattern.birthKey}-${year}-${month}-${day}-${birthHourInput}-${dynamicGender}`}
            pattern={pattern}
            baseProfile={profile}
            hasBirthHour={hasBirthHour}
            dynamicGender={dynamicGender}
            birthYear={year}
            runtimeTime={runtimeTime}
            activeFlow={activeRuntimeLevel}
            onActiveFlowChange={setActiveRuntimeLevel}
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
        title="2. 八字辅助内容"
        description="八字负责五行气质、动态环境场与行动修正。它跟随同一时间点和同一查看层级，但按自己的起运规则独立落位。"
      />

      <BaziRuntimePanel
        key={`${year}-${month}-${day}-${birthHourInput}-${dynamicGender}-bazi-runtime`}
        baziProfile={baziProfile}
        dynamicGender={dynamicGender}
        runtimeTime={runtimeTime}
        activeLevel={toBaziRuntimeLevel(activeRuntimeLevel)}
        onActiveLevelChange={(level) => {
          setActiveRuntimeLevel(level)
        }}
        onRuntimeTimeChange={setFromBaziSelection}
      />

      <SectionSpacer />

      <SectionTitle
        title="二、数据结果区"
        description="这里按功能分开展示数据：紫微数据、八字数据、五维性格映射，以及数据说明。"
      />

      {hasBirthHour && profile !== null && publicView !== null ? (
        <>
          <SectionTitle
            title="1. 紫微数据"
            description="这里展示紫微原始人格底盘、核心人格、traits、星曜组合 debug 和 public view，用于对比动态流动结果。"
          />

          <ZiweiPersonalityOutputPanel
            corePersonality={profile.corePersonality}
            traits={profile.traits}
            summaries={profile.summaries}
            debug={profile.debug}
          />

          <SectionSpacer />

          <PublicViewPanel publicView={publicView} />

          <SectionSpacer />
        </>
      ) : null}

      <SectionTitle
        title="2. 八字数据"
        description="这里展示八字原局、五行分布、动力向量和调试信息。八字是辅助，不覆盖紫微主系统。"
      />

      <BaziProfilePanel baziProfile={baziProfile} />

      <SectionSpacer />

      <SectionTitle
        title="3. 五维性格映射"
        description="这里展示性别视角、五维人格解释与生命功能倾向，属于解释层，不直接控制行为。"
      />

      <PersonalityInterpretationPanel
        dynamicGender={dynamicGender}
        lifeProfileBundle={lifeProfileBundle}
      />

      <SectionSpacer />

      <SectionTitle
        title="4. 数据说明"
        description="这里解释紫微、八字、五维映射和未来游戏行为系统之间的关系。"
      />

      <DataExplainPanel />

      <SectionSpacer />

      <SectionTitle
        title="三、Timeline / 行为链路测试区"
        description="这里用于测试生命阶段、记忆、状态变化与后续行为链路。未来会读取紫微主导趋向、八字辅助趋向和五维解释结果。"
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