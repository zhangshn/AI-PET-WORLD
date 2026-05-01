/**
 * 当前文件负责：展示出生年份输入。
 */

import { ComboInput } from "../common/ComboInput"
import { buildYearOptions } from "./birth-input-utils"

export function BirthYearInput({
  year,
  onChange
}: {
  year: number
  onChange: (year: number) => void
}) {
  return (
    <ComboInput
      label="年"
      value={String(year)}
      width={100}
      options={buildYearOptions()}
      onChange={(value) => {
        const nextYear = Number(value)

        if (!Number.isNaN(nextYear)) {
          onChange(nextYear)
        }
      }}
    />
  )
}