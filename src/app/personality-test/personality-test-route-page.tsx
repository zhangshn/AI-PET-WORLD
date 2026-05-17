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

import { DynamicMappingExplainPanel } from "./components/dashboard/DynamicMappingExplainPanel"
import { TestDashboardGrid } from "./components/dashboard/TestDashboardGrid"
import { TestDashboardHero } from "./components/dashboard/TestDashboardHero"
import { TestDashboardNotice } from "./components/dashboard/TestDashboardNotice"
import { TestDashboardPanel } from "./components/dashboard/TestDashboardPanel"
import { TestDashboardSection } from "./components/dashboard/TestDashboardSection"

import type { ActiveDynamicFlow } from "./types"
import type { BaziRuntimeActiveLevel } from "./components/bazi-runtime-panel/bazi-runtime-panel-types"

import { PersonalityTestRuntimeTimePanel } from "./runtime-time/PersonalityTestRuntimeTimePanel"
import { usePersonalityTestRuntimeTime } from "./runtime-time/usePersonalityTestRuntimeTime"

import { usePersonalityTestState } from "./hooks/usePersonalityTestState"

function toBaziRuntimeLevel(
  activeFlow: ActiveDynamicFlow
): BaziRuntimeActiveLevel {
  if (activeFlow === "natal") {
    return "daYun"
  }

  return activeFlow
}

export default function PersonalityTestRoutePage() {
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
      <TestDashboardHero
        runtimeTime={runtimeTime}
        activeFlow={activeRuntimeLevel}
        hasBirthHour={hasBirthHour}
      />

      <PersonalityTestTitle />

      <TestDashboardSection
        index="1"
        title="输入与同步时间"
        description="这里管理出生输入、动态性别和统一动态时间。紫微和八字同步当前时间点与查看层级，但各自独立计算起运和动态结果。"
      >
        <TestDashboardGrid minColumnWidth={520}>
          <TestDashboardPanel
            title="出生输入"
            subtitle="紫微需要完整出生时间；八字可以在缺少出生时间时进入三柱模式。"
          >
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
          </TestDashboardPanel>

          <TestDashboardPanel
            title="统一动态时间"
            subtitle="后续实际游戏中，这里会由世界时间驱动，而不是手动点击。"
          >
            <PersonalityTestRuntimeTimePanel runtimeTime={runtimeTime} />
          </TestDashboardPanel>
        </TestDashboardGrid>
      </TestDashboardSection>

      <TestDashboardSection
        index="2"
        title="命盘展示区"
        description="这里先展示紫微盘和八字盘。左右分布保留；八字动态时间表紧接八字盘展示，方便和紫微动态时间同步对齐。"
      >
        <TestDashboardGrid minColumnWidth={620}>
          <TestDashboardPanel
            title="紫微盘"
            subtitle="紫微是主系统，展示本命结构、宫位、星曜、动态流盘和当前选中层级。"
          >
            {hasBirthHour && pattern !== null ? (
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
            ) : (
              <TestDashboardNotice title="紫微盘暂不可用">
                当前出生时间未知，紫微盘暂不运行完整命盘与动态流。
              </TestDashboardNotice>
            )}
          </TestDashboardPanel>

          <TestDashboardPanel
            title="八字盘"
            subtitle="八字是辅助系统。这里展示八字原局，并紧接动态时间表。"
          >
            <BaziProfilePanel
              baziProfile={baziProfile}
              mode="chart"
            />

            <SectionSpacer />

            <BaziRuntimePanel
              key={`${year}-${month}-${day}-${birthHourInput}-${dynamicGender}-bazi-runtime-time`}
              baziProfile={baziProfile}
              dynamicGender={dynamicGender}
              runtimeTime={runtimeTime}
              activeLevel={toBaziRuntimeLevel(activeRuntimeLevel)}
              onActiveLevelChange={(level) => {
                setActiveRuntimeLevel(level)
              }}
              onRuntimeTimeChange={setFromBaziSelection}
              mode="time"
            />
          </TestDashboardPanel>
        </TestDashboardGrid>
      </TestDashboardSection>

      <TestDashboardSection
        index="3"
        title="数据内容区"
        description="盘展示完成后，再分开看动态数据内容：紫微数据、八字数据、五维性格映射。这里的数据未来要进入实际游戏行为链路。"
      >
        <TestDashboardGrid minColumnWidth={620}>
          <TestDashboardPanel
            title="紫微数据"
            subtitle="这里展示紫微原盘人格底盘、核心人格、traits、星曜组合 debug 和 public view。后续会继续拆出紫微动态数据。"
          >
            {hasBirthHour && profile !== null && publicView !== null ? (
              <>
                <ZiweiPersonalityOutputPanel
                  corePersonality={profile.corePersonality}
                  traits={profile.traits}
                  summaries={profile.summaries}
                  debug={profile.debug}
                />

                <SectionSpacer />

                <PublicViewPanel publicView={publicView} />
              </>
            ) : (
              <TestDashboardNotice title="紫微数据暂不可用">
                当前出生时间未知，无法生成完整紫微数据。
              </TestDashboardNotice>
            )}
          </TestDashboardPanel>

          <TestDashboardPanel
            title="八字数据"
            subtitle="这里展示八字动态五行环境场、AI 动力映射、当前行动趋向和调试信息。动态时间表已经放到上面的八字盘区域。"
          >
            <BaziRuntimePanel
              key={`${year}-${month}-${day}-${birthHourInput}-${dynamicGender}-bazi-runtime-data`}
              baziProfile={baziProfile}
              dynamicGender={dynamicGender}
              runtimeTime={runtimeTime}
              activeLevel={toBaziRuntimeLevel(activeRuntimeLevel)}
              onActiveLevelChange={(level) => {
                setActiveRuntimeLevel(level)
              }}
              onRuntimeTimeChange={setFromBaziSelection}
              mode="data"
            />

            <SectionSpacer />

            <BaziProfilePanel
              baziProfile={baziProfile}
              mode="data"
            />
          </TestDashboardPanel>
        </TestDashboardGrid>

        <div style={{ marginTop: 18 }}>
          <TestDashboardPanel
            title="五维性格映射"
            subtitle="这里展示五维人格解释、性别视角与生命功能倾向。当前仍是解释层，下一步会接入紫微动态数据 + 八字动态数据。"
          >
            <PersonalityInterpretationPanel
              dynamicGender={dynamicGender}
              lifeProfileBundle={lifeProfileBundle}
            />
          </TestDashboardPanel>
        </div>
      </TestDashboardSection>

      <TestDashboardSection
        index="4"
        title="动态映射说明"
        description="这里直接展示当前紫微、八字、五维映射出来的生命趋向结果，以及它们未来如何进入实际游戏行为系统。"
      >
        <DynamicMappingExplainPanel
          pattern={pattern}
          profile={profile}
          baziProfile={baziProfile}
          dynamicGender={dynamicGender}
          runtimeTime={runtimeTime}
        />
      </TestDashboardSection>

      <TestDashboardSection
        index="5"
        title="Timeline / 行为链路测试区"
        description="这里用于测试生命阶段、记忆、状态变化与后续行为链路。未来会读取紫微主导趋向、八字辅助趋向和五维解释结果。"
      >
        <TimelineTestPanel
          timelineClock={timelineClock}
          timelineSnapshot={timelineSnapshot}
          lastOperation={lastOperation}
          lastDiffs={lastDiffs}
          timelineLogs={timelineLogs}
          onApplyTimelineUpdate={actions.applyTimelineUpdate}
          onResetTimeline={actions.resetTimeline}
        />
      </TestDashboardSection>
    </PersonalityTestPageShell>
  )
}
