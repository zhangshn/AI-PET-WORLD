/**
 * 当前文件负责：展示出生小时输入。
 */

import { ComboInput } from "../common/ComboInput"
import { buildHourOptions } from "./birth-input-utils"

export function BirthHourInput({
  birthHourInput,
  onChange
}: {
  birthHourInput: string
  onChange: (value: string) => void
}) {
  return (
    <ComboInput
      label="时"
      value={birthHourInput}
      width={120}
      placeholder="未知 / 0-23"
      options={buildHourOptions()}
      onChange={onChange}
    />
  )
}