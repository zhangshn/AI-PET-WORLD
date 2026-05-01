/**
 * 当前文件负责：组装人格测试页顶部的出生年月日时与性别输入栏。
 */

import type { DynamicGenderInput } from "../../types"

import { BirthDayInput } from "./BirthDayInput"
import { BirthGenderInput } from "./BirthGenderInput"
import { BirthHourInput } from "./BirthHourInput"
import { BirthMonthInput } from "./BirthMonthInput"
import { BirthYearInput } from "./BirthYearInput"

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
      <BirthYearInput
        year={year}
        onChange={(nextYear) => {
          onDateChange({ year: nextYear })
        }}
      />

      <BirthMonthInput
        month={month}
        onChange={(nextMonth) => {
          onDateChange({ month: nextMonth })
        }}
      />

      <BirthDayInput
        day={day}
        onChange={(nextDay) => {
          onDateChange({ day: nextDay })
        }}
      />

      <BirthHourInput
        birthHourInput={birthHourInput}
        onChange={onBirthHourInputChange}
      />

      <BirthGenderInput
        dynamicGender={dynamicGender}
        onChange={onDynamicGenderChange}
      />
    </div>
  )
}