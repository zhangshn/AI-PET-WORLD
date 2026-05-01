/**
 * 当前文件负责：展示人格测试页顶部的出生年月日时与性别输入栏。
 */

import type { DynamicGenderInput } from "../../types"
import { ComboInput } from "../common/ComboInput"

import {
  buildDayOptions,
  buildHourOptions,
  buildMonthOptions,
  buildYearOptions
} from "./birth-input-utils"

export function BirthInputBar({
  year,
  month,
  day,
  birthHourInput,
  dynamicGender,
  onDateChange,
  onBirthHourInputChange,
  onDynamicGenderChange
}: {
  year: number
  month: number
  day: number
  birthHourInput: string
  dynamicGender: DynamicGenderInput
  onDateChange: (nextInput: {
    year?: number
    month?: number
    day?: number
  }) => void
  onBirthHourInputChange: (value: string) => void
  onDynamicGenderChange: (value: DynamicGenderInput) => void
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 16,
        background: "#fff",
        marginBottom: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "center"
      }}
    >
      <ComboInput
        label="年"
        value={String(year)}
        width={100}
        options={buildYearOptions()}
        onChange={(value) => {
          const nextYear = Number(value)

          if (!Number.isNaN(nextYear)) {
            onDateChange({ year: nextYear })
          }
        }}
      />

      <ComboInput
        label="月"
        value={String(month)}
        width={70}
        options={buildMonthOptions()}
        onChange={(value) => {
          const nextMonth = Number(value)

          if (!Number.isNaN(nextMonth)) {
            onDateChange({ month: nextMonth })
          }
        }}
      />

      <ComboInput
        label="日"
        value={String(day)}
        width={70}
        options={buildDayOptions()}
        onChange={(value) => {
          const nextDay = Number(value)

          if (!Number.isNaN(nextDay)) {
            onDateChange({ day: nextDay })
          }
        }}
      />

      <ComboInput
        label="时"
        value={birthHourInput}
        width={120}
        placeholder="未知 / 0-23"
        options={buildHourOptions()}
        onChange={onBirthHourInputChange}
      />

      <ComboInput
        label="性别"
        value={dynamicGender || "未选择"}
        width={120}
        options={["未选择", "male", "female"]}
        onChange={(value) => {
          if (value === "male" || value === "female") {
            onDynamicGenderChange(value)
            return
          }

          onDynamicGenderChange("")
        }}
      />
    </div>
  )
}