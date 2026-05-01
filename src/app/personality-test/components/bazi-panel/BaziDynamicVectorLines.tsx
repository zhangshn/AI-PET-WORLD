/**
 * 当前文件负责：展示八字映射出的 AI 动力向量。
 */

import { ScoreLine } from "../common/ScoreLine"
import { BAZI_DYNAMIC_VECTOR_LABELS } from "./bazi-panel-labels"

export function BaziDynamicVectorLines({
  dynamicVector
}: {
  dynamicVector?: Record<string, number>
}) {
  if (!dynamicVector) {
    return null
  }

  return (
    <div style={{ marginTop: 14 }}>
      <strong>AI 动力向量</strong>
      <div style={{ marginTop: 10 }}>
        {Object.entries(BAZI_DYNAMIC_VECTOR_LABELS).map(([key, label]) => {
          return (
            <ScoreLine
              key={key}
              name={key}
              label={label}
              value={dynamicVector[key] ?? 0}
            />
          )
        })}
      </div>
    </div>
  )
}