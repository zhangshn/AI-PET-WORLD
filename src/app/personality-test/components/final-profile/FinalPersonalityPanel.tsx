/**
 * 当前文件负责：展示未进入男女映射前的基础人格底盘。
 */

import { InfoCard } from "../common/InfoCard"

import {
  FINAL_BIAS_LABELS,
  FINAL_VECTOR_LABELS,
} from "./final-profile-labels"

import type { FinalPersonalityProfileView } from "./final-profile-types"
import { FinalProfileSummary } from "./FinalProfileSummary"
import { FinalScoreGroup } from "./FinalScoreGroup"

export function FinalPersonalityPanel({
  hasBirthHour,
  basePersonalityProfile,
}: {
  hasBirthHour: boolean
  basePersonalityProfile: FinalPersonalityProfileView
}) {
  return (
    <InfoCard title="🧬 基础人格底盘（未进入男女映射）">
      <p
        style={{
          margin: "0 0 12px",
          color: "#4b5563",
          lineHeight: 1.8,
        }}
      >
        这里展示的是紫微结构与八字动力生成的基础向量。它只作为后续男女映射的校准底盘，
        不代表最终人格，也不直接决定最终行为偏置。
      </p>

      <FinalProfileSummary
        hasBirthHour={hasBirthHour}
        labels={basePersonalityProfile.labels}
        summary={basePersonalityProfile.summary}
      />

      <hr
        style={{
          margin: "16px 0",
          border: "none",
          borderTop: "1px solid #eee",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        <FinalScoreGroup
          title="基础人格向量"
          values={basePersonalityProfile.vector}
          labelMap={FINAL_VECTOR_LABELS}
        />

        <FinalScoreGroup
          title="旧宠物偏置参考"
          values={basePersonalityProfile.bias.petBehaviorBias}
          labelMap={FINAL_BIAS_LABELS}
        />

        <FinalScoreGroup
          title="旧管家偏置参考"
          values={basePersonalityProfile.bias.butlerBehaviorBias}
          labelMap={FINAL_BIAS_LABELS}
        />

        <FinalScoreGroup
          title="旧建筑 / 家园偏置参考"
          values={basePersonalityProfile.bias.buildingBias}
          labelMap={FINAL_BIAS_LABELS}
        />
      </div>
    </InfoCard>
  )
}