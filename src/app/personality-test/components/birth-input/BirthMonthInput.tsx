/**
 * 当前文件负责：展示出生月份输入。
 */

import { ComboInput } from "../common/ComboInput"
import { buildMonthOptions } from "./birth-input-utils"

export function BirthMonthInput({
  month,
  onChange
}: {
  month: number
  onChange: (month: number) => void
}) {
  return (
    <ComboInput
      label="月"
      value={String(month)}
      width={70}
      options={buildMonthOptions()}
      onChange={(value) => {
        const nextMonth = Number(value)

        if (!Number.isNaN(nextMonth)) {
          onChange(nextMonth)
        }
      }}
    />
  )
}