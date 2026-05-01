"use client"

/**
 * 当前文件负责：展示紫微命盘，并在同一张盘上测试本命、大运、流年、流月、流日、流时。
 */

import { useMemo, useState } from "react"

import {
  buildZiweiDynamicChartOnly,
  buildZiweiDynamicInfluence
} from "../../../ai/ziwei-core/ziwei-gateway"

import type {
  BirthPattern,
  BranchPalace
} from "../../../ai/ziwei-core/schema"

import type {
  ZiweiDynamicChart,
  ZiweiFlowResult
} from "../../../ai/ziwei-core/dynamic/dynamic-schema"

import {
  BRANCH_FULL_LABELS,
  BRANCH_LABELS,
  ELEMENT_GATE_LABELS
} from "../constants"

import type {
  ActiveDynamicFlow,
  DynamicGenderInput
} from "../types"

import {
  getTimeBranchFromHour,
  resolveCurrentAge
} from "../utils"

import { InfoCard } from "./common/InfoCard"
import { ValueLine } from "./common/ValueLine"
import { ZiweiChartBoard } from "./ZiweiChartBoard"
import type { ZiweiChartFlowMarker } from "./chart/ziwei-chart-types"
import { ZiweiDynamicDetail } from "./ZiweiDynamicDetail"
import { ZiweiDynamicTabs } from "./ZiweiDynamicTabs"
import {
  ZiweiDynamicTimeTable,
  type ZiweiDynamicTimeSelection
} from "./ZiweiDynamicTimeTable"

function getActiveFlowResult(
  chart: ZiweiDynamicChart,
  activeFlow: ActiveDynamicFlow
): ZiweiFlowResult {
  return chart[activeFlow]
}

function buildFlowMarkers(params: {
  chart: ZiweiDynamicChart
  activeFlow: ActiveDynamicFlow
}): ZiweiChartFlowMarker[] {
  return [
    {
      kind: "natal",
      label: "本命",
      palace: params.chart.natal.palace,
      active: params.activeFlow === "natal",
      inactive: !params.chart.natal.isActive
    },
    {
      kind: "daYun",
      label: "大命",
      palace: params.chart.daYun.palace,
      active: params.activeFlow === "daYun",
      inactive: !params.chart.daYun.isActive
    },
    {
      kind: "liuNian",
      label: "年命",
      palace: params.chart.liuNian.palace,
      active: params.activeFlow === "liuNian",
      inactive: !params.chart.liuNian.isActive
    },
    {
      kind: "liuYue",
      label: "月命",
      palace: params.chart.liuYue.palace,
      active: params.activeFlow === "liuYue",
      inactive: !params.chart.liuYue.isActive
    },
    {
      kind: "liuRi",
      label: "日命",
      palace: params.chart.liuRi.palace,
      active: params.activeFlow === "liuRi",
      inactive: !params.chart.liuRi.isActive
    },
    {
      kind: "liuShi",
      label: "时命",
      palace: params.chart.liuShi.palace,
      active: params.activeFlow === "liuShi",
      inactive: !params.chart.liuShi.isActive
    }
  ]
}

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
  const [activeFlow, setActiveFlow] = useState<ActiveDynamicFlow>("natal")

  const defaultAge = useMemo(() => {
    return resolveCurrentAge(timelineDay)
  }, [timelineDay])

  const defaultTimeBranch = useMemo(() => {
    return getTimeBranchFromHour(timelineHour)
  }, [timelineHour])

  const [timeSelection, setTimeSelection] =
    useState<ZiweiDynamicTimeSelection>(() => {
      return {
        currentAge: Math.max(1, defaultAge),
        currentYear,
        currentLunarMonth: pattern.lunarInfo.lunarMonth,
        currentLunarDay: pattern.lunarInfo.lunarDay,
        currentTimeBranch: defaultTimeBranch
      }
    })

  const chartResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicChartOnly({
      pattern,
      gender: dynamicGender,
      currentAge: timeSelection.currentAge,
      currentYear: timeSelection.currentYear,
      currentLunarMonth: timeSelection.currentLunarMonth,
      currentLunarDay: timeSelection.currentLunarDay,
      currentTimeBranch: timeSelection.currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    timeSelection
  ])

  const influenceResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicInfluence({
      pattern,
      gender: dynamicGender,
      currentAge: timeSelection.currentAge,
      currentYear: timeSelection.currentYear,
      currentLunarMonth: timeSelection.currentLunarMonth,
      currentLunarDay: timeSelection.currentLunarDay,
      currentTimeBranch: timeSelection.currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    timeSelection
  ])

  let activePalace: BranchPalace | undefined
  let activeFlowResult: ZiweiFlowResult | null = null
  let flowMarkers: ZiweiChartFlowMarker[] = []

  if (chartResult?.ok) {
    activeFlowResult = getActiveFlowResult(chartResult.data, activeFlow)
    activePalace = activeFlowResult.palace
    flowMarkers = buildFlowMarkers({
      chart: chartResult.data,
      activeFlow
    })
  }

  const startAge = chartResult?.ok ? chartResult.data.debug.startAge : 1

  const isDaYunRequestedButInactive =
    activeFlow === "daYun" &&
    activeFlowResult !== null &&
    !activeFlowResult.isActive

  return (
    <InfoCard title="🌌 紫微命盘">
      {!hasBirthHour ? (
        <div style={{ color: "#a66", lineHeight: 1.8 }}>
          当前出生时间未知，完整紫微结构暂不参与最终人格融合，也不进入动态运势计算。
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              lineHeight: 1.8,
              marginBottom: 16
            }}
          >
            <ValueLine label="Birth Key" value={pattern.birthKey} />
            <ValueLine
              label="农历"
              value={`${pattern.lunarInfo.lunarYear}-${pattern.lunarInfo.lunarMonth}-${pattern.lunarInfo.lunarDay}`}
            />
            <ValueLine
              label="出生时辰"
              value={`${pattern.timeBranch}（${BRANCH_LABELS[pattern.timeBranch]}）`}
            />
            <ValueLine
              label="五行局"
              value={`${pattern.elementGate}（${
                ELEMENT_GATE_LABELS[pattern.elementGate] ?? pattern.elementGate
              }）`}
            />
            <ValueLine
              label="本命命宫"
              value={`${pattern.primaryBranchPalace}（${BRANCH_FULL_LABELS[pattern.primaryBranchPalace]}）`}
            />
            <ValueLine
              label="身宫"
              value={`${pattern.bodyBranchPalace}（${BRANCH_FULL_LABELS[pattern.bodyBranchPalace]}）`}
            />
          </div>

          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: 14,
              marginBottom: 14
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
                marginBottom: 12,
                lineHeight: 1.8
              }}
            >
              <ValueLine label="动态性别" value={dynamicGender || "未选择"} />
              <ValueLine label="当前年龄" value={timeSelection.currentAge} />
              <ValueLine
                label="当前时辰"
                value={`${timeSelection.currentTimeBranch}（${
                  BRANCH_LABELS[timeSelection.currentTimeBranch]
                }）`}
              />

              {activeFlowResult && (
                <ValueLine
                  label="当前动态命宫"
                  value={`${activeFlowResult.palace}（${
                    BRANCH_FULL_LABELS[activeFlowResult.palace]
                  }）`}
                />
              )}
            </div>

            <ZiweiDynamicTabs
              activeFlow={activeFlow}
              onChange={setActiveFlow}
            />

            {chartResult && !chartResult.ok && (
              <div
                style={{
                  border: "1px solid #ffccc7",
                  background: "#fff2f0",
                  borderRadius: 8,
                  padding: 12,
                  color: "#a8071a",
                  marginBottom: 16
                }}
              >
                {chartResult.message}
              </div>
            )}

            {isDaYunRequestedButInactive && (
              <div
                style={{
                  border: "1px solid #ffe58f",
                  background: "#fffbe6",
                  borderRadius: 8,
                  padding: 12,
                  color: "#8c6d1f",
                  marginBottom: 16
                }}
              >
                {activeFlowResult?.inactiveReason ??
                  "尚未起运，当前仍按本命盘运行。"}
              </div>
            )}
          </div>

          <ZiweiChartBoard
            pattern={pattern}
            activePalace={activePalace}
            branchToSectorMap={activeFlowResult?.dynamicBranchToSectorMap}
            flowMarkers={flowMarkers}
          />

          {chartResult?.ok && (
            <div style={{ marginTop: 12, color: "#666", lineHeight: 1.8 }}>
              大运方向：{chartResult.data.debug.direction}；起运岁数：
              {chartResult.data.debug.startAge}；当前是否起运：
              {chartResult.data.debug.isDaYunStarted ? "是" : "否"}
            </div>
          )}

          {chartResult?.ok && (
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