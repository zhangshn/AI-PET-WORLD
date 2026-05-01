/**
 * 当前文件负责：展示最终人格面板中的一组评分条。
 */

import { ScoreLine } from "../common/ScoreLine"
import type { NumericObjectView } from "./final-profile-types"

export function FinalScoreGroup({
  title,
  values,
  labelMap
}: {
  title: string
  values: NumericObjectView
  labelMap: Record<string, string>
}) {
  return (
    <div>
      <strong>{title}</strong>
      <div style={{ marginTop: 10 }}>
        {Object.entries(values).map(([key, value]) => {
          return (
            <ScoreLine
              key={key}
              name={key}
              label={labelMap[key]}
              value={Number(value)}
            />
          )
        })}
      </div>
    </div>
  )
}