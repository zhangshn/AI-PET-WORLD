"use client"

/**
 * 当前文件负责：组装紫微命盘动态测试面板。
 */

import type { BirthPattern } from "../../../ai/ziwei-core/schema"

import type { DynamicGenderInput } from "../types"

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

import { useZiweiDynamicPanelState } from "../hooks/useZiweiDynamicPanelState"

export function ZiweiDynamicPanel({
  pattern,
  hasBirthHour,
  dynamicGender,
  currentYear,
  timelineDay,
  timelineHour
}: {
  pattern: BirthPattern
  hasBirthHour: boolean
  dynamicGender: DynamicGenderInput
  currentYear: number
  timelineDay: number
  timelineHour: number
}) {
  const {
    activeFlow,
    setActiveFlow,

    timeSelection,
    setTimeSelection,

    chartResult,
    chartData,
    influenceResult,

    activePalace,
    activeFlowResult,
    flowMarkers,
    startAge,
    isDaYunRequestedButInactive
  } = useZiweiDynamicPanelState({
    pattern,
    hasBirthHour,
    dynamicGender,
    currentYear,
    timelineDay,
    timelineHour
  })

  return (
    <InfoCard title="🌌 紫微命盘">
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
              birthYear={currentYear}
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
        </>
      )}
    </InfoCard>
  )
}