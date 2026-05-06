"use client"

/**
 * 当前文件负责：组装紫微命盘动态测试面板。
 */

import type {
  BirthPattern,
  PersonalityProfile
} from "../../../ai/ziwei-core/schema"

import type { DynamicGenderInput } from "../types"
import type { PersonalityTestRuntimeTime } from "../runtime-time/personality-test-runtime-time-types"
import type { ZiweiDynamicTimeSelection } from "./ZiweiDynamicTimeTable"

import { InfoCard } from "./common/InfoCard"
import { ZiweiChartBoard } from "./ZiweiChartBoard"
import { ZiweiDynamicDetail } from "./ZiweiDynamicDetail"
import { ZiweiDynamicTabs } from "./ZiweiDynamicTabs"
import { ZiweiDynamicTimeTable } from "./ZiweiDynamicTimeTable"

import { ZiweiBirthSummary } from "./dynamic/ZiweiBirthSummary"
import {
  ZiweiDaYunInactiveNotice,
  ZiweiDynamicErrorNotice
} from "./dynamic/ZiweiDynamicNotice"
import { ZiweiDynamicRuntimeLine } from "./dynamic/ZiweiDynamicRuntimeLine"
import { ZiweiDynamicStatusBar } from "./dynamic/ZiweiDynamicStatusBar"
import { ZiweiCurrentDynamicProfilePanel } from "./dynamic-current-profile/ZiweiCurrentDynamicProfilePanel"

import { useZiweiDynamicPanelState } from "../hooks/useZiweiDynamicPanelState"

export function ZiweiDynamicPanel({
  pattern,
  baseProfile,
  hasBirthHour,
  dynamicGender,
  runtimeTime,
  onRuntimeTimeChange,
}: {
  pattern: BirthPattern
  baseProfile: PersonalityProfile | null
  hasBirthHour: boolean
  dynamicGender: DynamicGenderInput
  runtimeTime: PersonalityTestRuntimeTime
  onRuntimeTimeChange: (selection: ZiweiDynamicTimeSelection) => void
}) {
  const {
    activeFlow,
    setActiveFlow,

    timeSelection,
    setTimeSelection,

    chartResult,
    chartData,
    influenceResult,
    currentDynamicProfileResult,

    activePalace,
    activeFlowResult,
    flowMarkers,
    startAge,
    isDaYunRequestedButInactive
  } = useZiweiDynamicPanelState({
    pattern,
    baseProfile,
    hasBirthHour,
    dynamicGender,
    runtimeTime,
    onRuntimeTimeChange,
  })

  return (
    <InfoCard title="🌌 紫微核心区">
      {!hasBirthHour ? (
        <div style={{ color: "#a66", lineHeight: 1.8 }}>
          当前出生时间未知，完整紫微结构暂不参与最终人格融合，也不进入动态运势计算。
        </div>
      ) : (
        <>
          <ZiweiBirthSummary pattern={pattern} />

          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: 14,
              marginBottom: 14
            }}
          >
            <ZiweiDynamicStatusBar
              dynamicGender={dynamicGender}
              timeSelection={timeSelection}
              activeFlowResult={activeFlowResult}
            />

            <ZiweiDynamicTabs
              activeFlow={activeFlow}
              onChange={setActiveFlow}
            />

            <ZiweiDynamicErrorNotice chartResult={chartResult} />

            <ZiweiDaYunInactiveNotice
              activeFlowResult={activeFlowResult}
              visible={isDaYunRequestedButInactive}
            />
          </div>

          <ZiweiChartBoard
            pattern={pattern}
            activePalace={activePalace}
            branchToSectorMap={activeFlowResult?.dynamicBranchToSectorMap}
            flowMarkers={flowMarkers}
          />

          <ZiweiDynamicRuntimeLine chartData={chartData} />

          {chartData && (
            <ZiweiDynamicTimeTable
              birthYear={runtimeTime.currentYear - runtimeTime.currentAge + 1}
              startAge={startAge}
              selection={timeSelection}
              activeFlow={activeFlow}
              onSelectionChange={setTimeSelection}
              onActiveFlowChange={setActiveFlow}
            />
          )}

          {activeFlowResult && influenceResult?.ok && (
            <div style={{ marginTop: 16 }}>
              <ZiweiDynamicDetail
                flow={activeFlowResult}
                influence={influenceResult.data}
              />
            </div>
          )}

          {currentDynamicProfileResult?.ok && (
            <div style={{ marginTop: 16 }}>
              <ZiweiCurrentDynamicProfilePanel
                profile={currentDynamicProfileResult.data}
              />
            </div>
          )}
        </>
      )}
    </InfoCard>
  )
}