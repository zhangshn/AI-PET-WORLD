/**
 * 当前文件负责：展示八字五行能量分布。
 */

import { ScoreLine } from "../common/ScoreLine"
import { BAZI_ELEMENT_LABELS } from "./bazi-panel-labels"

export function BaziElementScoreLines({
  elementScores
}: {
  elementScores?: Record<string, number>
}) {
  if (!elementScores) {
    return null
  }

  return (
    <div style={{ marginTop: 14 }}>
      <strong>五行能量</strong>
      <div style={{ marginTop: 10 }}>
        {Object.entries(BAZI_ELEMENT_LABELS).map(([key, label]) => {
          return (
            <ScoreLine
              key={key}
              name={key}
              label={label}
              value={elementScores[key] ?? 0}
            />
          )
        })}
      </div>
    </div>
  )
}