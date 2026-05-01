/**
 * 当前文件负责：展示八字大运、流年、流月、流日、流时选择器。
 */

import type {
  BaziDaYunTimeOption,
  BaziHourTimeOption,
  BaziLiuNianTimeOption,
  BaziRuntimeProfile,
  BaziSimpleTimeOption
} from "../../../../ai/bazi-core/bazi-gateway"

import {
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
  const timeTable = runtimeProfile.timeTable

  function selectDaYun(option: BaziDaYunTimeOption) {
    onActiveLevelChange("daYun")
    onSelectionChange({
      ...selection,
      currentYear: option.startYear,
    })
  }

  function selectLiuNian(option: BaziLiuNianTimeOption) {
    onActiveLevelChange("liuNian")
    onSelectionChange({
      ...selection,
      currentYear: option.year,
    })
  }

  function selectLiuYue(option: BaziSimpleTimeOption) {
    onActiveLevelChange("liuYue")
    onSelectionChange({
      ...selection,
      currentMonth: option.value,
    })
  }

  function selectLiuRi(option: BaziSimpleTimeOption) {
    onActiveLevelChange("liuRi")
    onSelectionChange({
      ...selection,
      currentDay: option.value,
    })
  }

  function selectLiuShi(option: BaziHourTimeOption) {
    onActiveLevelChange("liuShi")
    onSelectionChange({
      ...selection,
      currentHour: option.hour,
    })
  }

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 12,
        background: "#fafafa",
        marginTop: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>
        八字动态时间表
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>大运</div>

        {timeTable.daYunOptions.map((option) => (
          <BaziRuntimeTimeCell
            key={option.index}
            title={`${option.title} · ${option.pillarLabel}`}
            subtitle={option.subtitle}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "daYun",
              }) && option.active
            }
            onClick={() => selectDaYun(option)}
          />
        ))}
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>流年</div>

        {timeTable.liuNianOptions.map((option) => (
          <BaziRuntimeTimeCell
            key={option.year}
            title={`${option.title} · ${option.pillarLabel}`}
            subtitle={option.subtitle}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "liuNian",
              }) && option.active
            }
            onClick={() => selectLiuNian(option)}
          />
        ))}
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>流月</div>

        {timeTable.liuYueOptions.map((option) => (
          <BaziRuntimeTimeCell
            key={option.value}
            title={`${option.title} · ${option.pillarLabel}`}
            subtitle={option.subtitle}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "liuYue",
              }) && option.active
            }
            onClick={() => selectLiuYue(option)}
          />
        ))}
      </div>

      <div style={{ ...baziRuntimeRowStyle, marginBottom: 10 }}>
        <div style={baziRuntimeRowLabelStyle}>流日</div>

        {timeTable.liuRiOptions.map((option) => (
          <BaziRuntimeTimeCell
            key={option.value}
            title={`${option.title} · ${option.pillarLabel}`}
            subtitle={option.subtitle}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "liuRi",
              }) && option.active
            }
            onClick={() => selectLiuRi(option)}
          />
        ))}
      </div>

      <div style={baziRuntimeRowStyle}>
        <div style={baziRuntimeRowLabelStyle}>流时</div>

        {timeTable.liuShiOptions.map((option) => (
          <BaziRuntimeTimeCell
            key={option.hour}
            title={`${option.title} · ${option.pillarLabel}`}
            subtitle={option.subtitle}
            selected={
              isRuntimeLevelActive({
                activeLevel,
                targetLevel: "liuShi",
              }) && option.active
            }
            onClick={() => selectLiuShi(option)}
          />
        ))}
      </div>

      <div style={{ color: "#666", fontSize: 12, marginTop: 10 }}>
        当前层级：{BAZI_RUNTIME_LEVEL_LABELS[activeLevel]}；
        {timeTable.selectedSummary}
      </div>
    </div>
  )
}