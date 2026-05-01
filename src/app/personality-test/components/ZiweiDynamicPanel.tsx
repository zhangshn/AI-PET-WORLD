"use client"

/**
 * 当前文件负责：提供紫微动态运势测试面板。
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

import { ComboInput } from "./common/ComboInput"
import { InfoCard } from "./common/InfoCard"
import { ValueLine } from "./common/ValueLine"
import { ZiweiChartBoard } from "./ZiweiChartBoard"
import { ZiweiDynamicDetail } from "./ZiweiDynamicDetail"
import { ZiweiDynamicTabs } from "./ZiweiDynamicTabs"

function getActiveFlowResult(
  chart: ZiweiDynamicChart,
  activeFlow: ActiveDynamicFlow
): ZiweiFlowResult {
  return chart[activeFlow]
}

export function ZiweiDynamicPanel({
  pattern,
  hasBirthHour,
  currentYear,
  timelineDay,
  timelineHour
}: {
  pattern: BirthPattern
  hasBirthHour: boolean
  currentYear: number
  timelineDay: number
  timelineHour: number
}) {
  const [dynamicGender, setDynamicGender] = useState<DynamicGenderInput>("")
  const [activeFlow, setActiveFlow] = useState<ActiveDynamicFlow>("natal")

  const currentAge = useMemo(() => {
    return resolveCurrentAge(timelineDay)
  }, [timelineDay])

  const currentTimeBranch = useMemo(() => {
    return getTimeBranchFromHour(timelineHour)
  }, [timelineHour])

  const chartResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicChartOnly({
      pattern,
      gender: dynamicGender,
      currentAge,
      currentYear,
      currentLunarMonth: pattern.lunarInfo.lunarMonth,
      currentLunarDay: pattern.lunarInfo.lunarDay,
      currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    currentAge,
    currentYear,
    currentTimeBranch
  ])

  const influenceResult = useMemo(() => {
    if (!hasBirthHour) {
      return null
    }

    return buildZiweiDynamicInfluence({
      pattern,
      gender: dynamicGender,
      currentAge,
      currentYear,
      currentLunarMonth: pattern.lunarInfo.lunarMonth,
      currentLunarDay: pattern.lunarInfo.lunarDay,
      currentTimeBranch
    })
  }, [
    hasBirthHour,
    pattern,
    dynamicGender,
    currentAge,
    currentYear,
    currentTimeBranch
  ])

  let activePalace: BranchPalace | undefined
  let activeFlowResult: ZiweiFlowResult | null = null

  if (chartResult?.ok) {
    activeFlowResult = getActiveFlowResult(chartResult.data, activeFlow)
    activePalace = activeFlowResult.palace
  }

  return (
    <InfoCard title="🔮 紫微动态运势测试">
      {!hasBirthHour ? (
        <div style={{ color: "#a66", lineHeight: 1.8 }}>
          当前出生时间未知，无法生成完整紫微结构，因此不进入动态运势计算。
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              marginBottom: 16
            }}
          >
            <ComboInput
              label="动态性别"
              value={dynamicGender || "未选择"}
              width={120}
              options={["未选择", "male", "female"]}
              onChange={(value) => {
                if (value === "male" || value === "female") {
                  setDynamicGender(value)
                  return
                }

                setDynamicGender("")
              }}
            />

            <ValueLine
              label="五行局"
              value={`${pattern.elementGate}（${
                ELEMENT_GATE_LABELS[pattern.elementGate] ?? pattern.elementGate
              }）`}
            />
            <ValueLine label="五行局数" value={pattern.elementBase} />
            <ValueLine label="当前年龄" value={currentAge} />
            <ValueLine
              label="当前时辰"
              value={`${currentTimeBranch}（${BRANCH_LABELS[currentTimeBranch]}）`}
            />
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

          <ZiweiChartBoard
            pattern={pattern}
            activePalace={activePalace}
          />

          {chartResult?.ok && (
            <div style={{ marginTop: 12, color: "#666", lineHeight: 1.8 }}>
              大运方向：{chartResult.data.debug.direction}；起运岁数：
              {chartResult.data.debug.startAge}
            </div>
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