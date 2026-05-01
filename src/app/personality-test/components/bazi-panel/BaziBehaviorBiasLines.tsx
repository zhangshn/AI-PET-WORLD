/**
 * 当前文件负责：展示八字映射出的行为偏置。
 */

import { ScoreLine } from "../common/ScoreLine"
import { BAZI_BEHAVIOR_BIAS_LABELS } from "./bazi-panel-labels"

export function BaziBehaviorBiasLines({
  behaviorBias
}: {
  behaviorBias?: Record<string, number>
}) {
  if (!behaviorBias) {
    return null
  }

  return (
    <div style={{ marginTop: 14 }}>
      <strong>行为偏置</strong>
      <div style={{ marginTop: 10 }}>
        {Object.entries(BAZI_BEHAVIOR_BIAS_LABELS).map(([key, label]) => {
          return (
            <ScoreLine
              key={key}
              name={key}
              label={label}
              value={behaviorBias[key] ?? 0}
            />
          )
        })}
      </div>
    </div>
  )
}