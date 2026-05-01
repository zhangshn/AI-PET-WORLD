/**
 * 当前文件负责：展示对象形式的数值评分列表。
 */

import { ScoreLine } from "../common/ScoreLine"
import type { NumericObjectView } from "./ziwei-output-types"

export function NumericScoreList({
  values,
  multiplier = 1
}: {
  values: NumericObjectView
  multiplier?: number
}) {
  return (
    <>
      {Object.entries(values).map(([key, value]) => {
        return (
          <ScoreLine
            key={key}
            name={key}
            value={Number(value) * multiplier}
          />
        )
      })}
    </>
  )
}