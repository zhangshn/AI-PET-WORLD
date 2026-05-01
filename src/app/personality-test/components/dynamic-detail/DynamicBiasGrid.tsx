/**
 * 当前文件负责：展示紫微动态影响中的行为偏置评分。
 */

import type { ZiweiDynamicInfluence } from "../../../../ai/ziwei-core/dynamic/dynamic-schema"

import { ScoreLine } from "../common/ScoreLine"
import { DYNAMIC_BIAS_LABELS } from "./dynamic-detail-labels"

const BIAS_KEYS: Array<keyof Pick<
  ZiweiDynamicInfluence,
  | "careBias"
  | "observeBias"
  | "protectBias"
  | "exploreBias"
  | "recordBias"
  | "routineBias"
  | "repairBias"
  | "boundaryBias"
>> = [
  "careBias",
  "observeBias",
  "protectBias",
  "exploreBias",
  "recordBias",
  "routineBias",
  "repairBias",
  "boundaryBias"
]

export function DynamicBiasGrid({
  influence
}: {
  influence: ZiweiDynamicInfluence
}) {
  return (
    <div>
      <strong>行为偏置</strong>
      <div style={{ marginTop: 10 }}>
        {BIAS_KEYS.map((key) => {
          return (
            <ScoreLine
              key={key}
              name={key}
              label={DYNAMIC_BIAS_LABELS[key]}
              value={Number(influence[key])}
            />
          )
        })}
      </div>
    </div>
  )
}