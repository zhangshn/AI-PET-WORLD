/**
 * 当前文件负责：展示八字阴阳倾向。
 */

import { ScoreLine } from "../common/ScoreLine"
import { BAZI_YIN_YANG_LABELS } from "./bazi-panel-labels"

export function BaziYinYangLines({
  yinYangScores
}: {
  yinYangScores?: Record<string, number>
}) {
  if (!yinYangScores) {
    return null
  }

  return (
    <div style={{ marginTop: 14 }}>
      <strong>阴阳倾向</strong>
      <div style={{ marginTop: 10 }}>
        {Object.entries(BAZI_YIN_YANG_LABELS).map(([key, label]) => {
          return (
            <ScoreLine
              key={key}
              name={key}
              label={label}
              value={yinYangScores[key] ?? 0}
            />
          )
        })}
      </div>
    </div>
  )
}