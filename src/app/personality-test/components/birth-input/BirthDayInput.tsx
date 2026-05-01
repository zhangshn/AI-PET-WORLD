/**
 * 当前文件负责：展示出生日期输入。
 */

import { ComboInput } from "../common/ComboInput"
import { buildDayOptions } from "./birth-input-utils"

export function BirthDayInput({
  day,
  onChange
}: {
  day: number
  onChange: (day: number) => void
}) {
  return (
    <ComboInput
      label="日"
      value={String(day)}
      width={70}
      options={buildDayOptions()}
      onChange={(value) => {
        const nextDay = Number(value)

        if (!Number.isNaN(nextDay)) {
          onChange(nextDay)
        }
      }}
    />
  )
}