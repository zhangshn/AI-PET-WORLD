/**
 * 当前文件负责：组装最终融合后的 AI 人格结果面板。
 */

import { InfoCard } from "../common/InfoCard"

import {
  FINAL_BIAS_LABELS,
  FINAL_VECTOR_LABELS
} from "./final-profile-labels"

import type { FinalPersonalityProfileView } from "./final-profile-types"
import { FinalProfileSummary } from "./FinalProfileSummary"
import { FinalScoreGroup } from "./FinalScoreGroup"

export function FinalPersonalityPanel({
  hasBirthHour,
  finalPersonalityProfile
}: {
  hasBirthHour: boolean
  finalPersonalityProfile: FinalPersonalityProfileView
}) {
  return (
    <InfoCard title="🧬 最终 AI 人格结果（已融合）">
      <FinalProfileSummary
        hasBirthHour={hasBirthHour}
        labels={finalPersonalityProfile.labels}
        summary={finalPersonalityProfile.summary}
      />

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
          gap: 18
        }}
      >
        <FinalScoreGroup
          title="统一人格向量"
          values={finalPersonalityProfile.vector}
          labelMap={FINAL_VECTOR_LABELS}
        />

        <FinalScoreGroup
          title="宠物行为偏置"
          values={finalPersonalityProfile.bias.petBehaviorBias}
          labelMap={FINAL_BIAS_LABELS}
        />

        <FinalScoreGroup
          title="管家行为偏置"
          values={finalPersonalityProfile.bias.butlerBehaviorBias}
          labelMap={FINAL_BIAS_LABELS}
        />

        <FinalScoreGroup
          title="建筑 / 家园偏置"
          values={finalPersonalityProfile.bias.buildingBias}
          labelMap={FINAL_BIAS_LABELS}
        />
      </div>
    </InfoCard>
  )
}