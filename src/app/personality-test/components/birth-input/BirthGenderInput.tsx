/**
 * 当前文件负责：展示动态层使用的性别输入。
 */

import type { DynamicGenderInput } from "../../types"
import { ComboInput } from "../common/ComboInput"

export function BirthGenderInput({
  dynamicGender,
  onChange
}: {
  dynamicGender: DynamicGenderInput
  onChange: (value: DynamicGenderInput) => void
}) {
  return (
    <ComboInput
      label="性别"
      value={dynamicGender || "未选择"}
      width={120}
      options={["未选择", "male", "female"]}
      onChange={(value) => {
        if (value === "male" || value === "female") {
          onChange(value)
          return
        }

        onChange("")
      }}
    />
  )
}