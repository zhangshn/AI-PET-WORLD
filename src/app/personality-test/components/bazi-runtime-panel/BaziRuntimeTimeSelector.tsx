/**
 * 当前文件负责：展示八字大运、流年、流月、流日、流时选择器。
 */

import type {
  BaziDaYunItem,
  BaziRuntimeProfile
} from "../../../../ai/bazi-core/bazi-gateway"

import {
  BAZI_DAY_LABELS,
  BAZI_HOUR_OPTIONS,
  BAZI_MONTH_LABELS,
  BAZI_RUNTIME_LEVEL_LABELS,
  isRuntimeLevelActive
} from "./bazi-runtime-panel-labels"

import {
  baziRuntimeRowLabelStyle,
  baziRuntimeRowStyle,
  BaziRuntimeTimeCell
} from "./BaziRuntimeTimeCell"

import type {
  BaziRuntimeActiveLevel,
  BaziRuntimeTimeSelection
} from "./bazi-runtime-panel-types"

function getActiveDaYunItem(params: {
  runtimeProfile: BaziRuntimeProfile
  selection: BaziRuntimeTimeSelection
}): BaziDaYunItem | null {
  return params.runtimeProfile.daYun.daYunList.find((item) => {
    return (
      params.selection.currentYear >= item.startYear &&
      params.selection.currentYear <= item.endYear
    )
  }) ?? params.runtimeProfile.daYun.currentDaYun
}

function buildYearRange(params: {
  runtimeProfile: BaziRuntimeProfile
  selection: BaziRuntimeTimeSelection
}): number[] {
  const activeDaYun = getActiveDaYunItem({
    runtimeProfile: params.runtimeProfile,
    selection: params.selection,
  })

  if (!activeDaYun) {
    const birthYear = params.runtimeProfile.birthChart.input.year

    return Array.from({ length: 12 }, (_, index) => {
      return birthYear + index
    })
  }

  return Array.from({ length: 10 }, (_, index) => {
    return activeDaYun.startYear + index
  })
}

export function BaziRuntimeTimeSelector({
  runtimeProfile,
  activeLevel,
  selection,
  onActiveLevelChange,
  onSelectionChange
}: {
  runtimeProfile: BaziRuntimeProfile
  activeLevel: BaziRuntimeActiveLevel
  selection: BaziRuntimeTimeSelection
  onActiveLevelChange: (level: BaziRuntimeActiveLevel) => void
  onSelectionChange: (selection: BaziRuntimeTimeSelection) => void
}) {
  const yearRange = buildYearRange({
    runtimeProfile,
    selection,
  })

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 12,
        background: "#fafafa",
        marginTop: 12
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>
        八字动态时间表
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>大运</div>

        {runtimeProfile.daYun.daYunList.map((item) => (
          <BaziRuntimeTimeCell
            key={item.index}
            title={`${item.startAge}-${item.endAge}`}
            subtitle={`${item.startYear}-${item.endYear}`}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "daYun"
              }) &&
              selection.currentYear >= item.startYear &&
              selection.currentYear <= item.endYear
            }
            onClick={() => {
              onActiveLevelChange("daYun")
              onSelectionChange({
                ...selection,
                currentYear: item.startYear,
              })
            }}
          />
        ))}
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>流年</div>

        {yearRange.map((year) => (
          <BaziRuntimeTimeCell
            key={year}
            title={String(year)}
            subtitle={`${year - runtimeProfile.birthChart.input.year + 1}岁`}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "liuNian"
              }) &&
              selection.currentYear === year
            }
            onClick={() => {
              onActiveLevelChange("liuNian")
              onSelectionChange({
                ...selection,
                currentYear: year,
              })
            }}
          />
        ))}
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>流月</div>

        {BAZI_MONTH_LABELS.map((label, index) => {
          const month = index + 1

          return (
            <BaziRuntimeTimeCell
              key={month}
              title={label}
              selected={
                isRuntimeLevelActive({
                  activeLevel,
                  targetLevel: "liuYue"
                }) &&
                selection.currentMonth === month
              }
              onClick={() => {
                onActiveLevelChange("liuYue")
                onSelectionChange({
                  ...selection,
                  currentMonth: month,
                })
              }}
            />
          )
        })}
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>流日</div>

        {BAZI_DAY_LABELS.map((label, index) => {
          const day = index + 1

          return (
            <BaziRuntimeTimeCell
              key={day}
              title={label}
              selected={
                isRuntimeLevelActive({
                  activeLevel,
                  targetLevel: "liuRi"
                }) &&
                selection.currentDay === day
              }
              onClick={() => {
                onActiveLevelChange("liuRi")
                onSelectionChange({
                  ...selection,
                  currentDay: day,
                })
              }}
            />
          )
        })}
      </div>

      <div style={baziRuntimeRowStyle}>
        <div style={baziRuntimeRowLabelStyle}>流时</div>

        {BAZI_HOUR_OPTIONS.map((option) => (
          <BaziRuntimeTimeCell
            key={option.branch}
            title={option.label}
            subtitle={option.branch}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "liuShi"
              }) &&
              selection.currentHour === option.hour
            }
            onClick={() => {
              onActiveLevelChange("liuShi")
              onSelectionChange({
                ...selection,
                currentHour: option.hour,
              })
            }}
          />
        ))}
      </div>

      <div style={{ color: "#666", fontSize: 12, marginTop: 10 }}>
        当前选择：{BAZI_RUNTIME_LEVEL_LABELS[activeLevel]}；
        年份 {selection.currentYear}；
        月份 {selection.currentMonth}；
        日期 {selection.currentDay}；
        {selection.currentHour === null ? "时辰未知" : `小时 ${selection.currentHour}`}
      </div>
    </div>
  )
}