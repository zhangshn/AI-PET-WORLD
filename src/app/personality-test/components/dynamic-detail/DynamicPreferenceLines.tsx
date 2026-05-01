/**
 * 当前文件负责：展示紫微动态影响中的位置、观察距离、语气等偏好。
 */

import type { ZiweiDynamicInfluence } from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import { ValueLine } from "../common/ValueLine"
import {
  OBSERVATION_DISTANCE_LABELS,
  POSITION_BIAS_LABELS,
  TONE_BIAS_LABELS
} from "./dynamic-detail-labels"

export function DynamicPreferenceLines({
  influence
}: {
  influence: ZiweiDynamicInfluence
}) {
  return (
    <div style={{ lineHeight: 1.9 }}>
      <strong>动态偏好</strong>
      <div style={{ marginTop: 10 }}>
        <ValueLine
          label="当前位置偏好"
          value={
            POSITION_BIAS_LABELS[influence.positionBias] ??
            influence.positionBias
          }
        />
        <ValueLine
          label="观察距离"
          value={
            OBSERVATION_DISTANCE_LABELS[influence.observationDistance] ??
            influence.observationDistance
          }
        />
        <ValueLine
          label="语气偏好"
          value={TONE_BIAS_LABELS[influence.toneBias] ?? influence.toneBias}
        />
        <ValueLine
          label="当前阶段"
          value={influence.currentPhaseLabel}
        />
        <ValueLine
          label="当前关注"
          value={influence.currentFocusLabel}
        />
      </div>
    </div>
  )
}