/**
 * 当前文件负责：展示当前选中的紫微动态流详情与动态行为影响。
 */

import type {
  ZiweiDynamicInfluence,
  ZiweiFlowResult
} from "../../../ai/ziwei-core/dynamic/dynamic-schema"

import {
  BRANCH_FULL_LABELS,
  DYNAMIC_BIAS_LABELS,
  DYNAMIC_FLOW_LABELS,
  OBSERVATION_DISTANCE_LABELS,
  POSITION_BIAS_LABELS,
  TONE_BIAS_LABELS
} from "../constants"

import {
  getSectorLabel,
  getStarDisplay
} from "../utils"

import { ScoreLine } from "./common/ScoreLine"
import { ValueLine } from "./common/ValueLine"
import type { SectorName } from "../../../ai/ziwei-core/schema"

export function ZiweiDynamicDetail({
  flow,
  influence
}: {
  flow: ZiweiFlowResult
  influence: ZiweiDynamicInfluence
}) {
  const biasKeys: Array<keyof Pick<
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

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 14,
        background: "#fafafa"
      }}
    >
      <h4 style={{ marginTop: 0 }}>当前动态详情</h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18
        }}
      >
        <div style={{ lineHeight: 1.9 }}>
          <ValueLine
            label="当前流"
            value={DYNAMIC_FLOW_LABELS[flow.type] ?? flow.type}
          />
          <ValueLine
            label="落宫"
            value={`${flow.palace}（${BRANCH_FULL_LABELS[flow.palace]}）`}
          />
          <ValueLine
            label="业务宫位"
            value={getSectorLabel(flow.sectorName as SectorName)}
          />
          <ValueLine label="权重" value={flow.influence} />
          <ValueLine
            label="星曜"
            value={
              flow.stars.length > 0
                ? flow.stars.map(getStarDisplay).join(" / ")
                : "空宫"
            }
          />
          <ValueLine
            label="组合"
            value={flow.pairIds.length > 0 ? flow.pairIds.join(" / ") : "无"}
          />
        </div>

        <div>
          <strong>动态行为影响</strong>
          <div style={{ marginTop: 10 }}>
            {biasKeys.map((key) => (
              <ScoreLine
                key={key}
                name={key}
                label={DYNAMIC_BIAS_LABELS[key]}
                value={influence[key]}
              />
            ))}
          </div>
        </div>
      </div>

      <hr
        style={{
          margin: "16px 0",
          border: "none",
          borderTop: "1px solid #eee"
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
          lineHeight: 1.9
        }}
      >
        <ValueLine
          label="站位倾向"
          value={POSITION_BIAS_LABELS[influence.positionBias] ?? influence.positionBias}
        />
        <ValueLine
          label="观察距离"
          value={
            OBSERVATION_DISTANCE_LABELS[influence.observationDistance] ??
            influence.observationDistance
          }
        />
        <ValueLine
          label="语气倾向"
          value={TONE_BIAS_LABELS[influence.toneBias] ?? influence.toneBias}
        />
        <ValueLine label="当前阶段" value={influence.currentPhaseLabel} />
        <ValueLine label="当前关注点" value={influence.currentFocusLabel} />
        <ValueLine
          label="Top Bias"
          value={influence.debug.topBiases.join(" / ")}
        />
      </div>
    </div>
  )
}