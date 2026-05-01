/**
 * 当前文件负责：展示最终融合后的 AI 人格结果。
 */

import { InfoCard } from "../common/InfoCard"
import { ScoreLine } from "../common/ScoreLine"
import { ValueLine } from "../common/ValueLine"

import {
  FINAL_BIAS_LABELS,
  FINAL_VECTOR_LABELS
} from "./final-profile-labels"

type FinalPersonalityProfileView = {
  labels: string[]
  summary: string
  vector: Record<string, number>
  bias: {
    petBehaviorBias: Record<string, number>
    butlerBehaviorBias: Record<string, number>
    buildingBias: Record<string, number>
  }
}

function ScoreGroup({
  title,
  values,
  labelMap
}: {
  title: string
  values: Record<string, number>
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

export function FinalPersonalityPanel({
  hasBirthHour,
  finalPersonalityProfile
}: {
  hasBirthHour: boolean
  finalPersonalityProfile: FinalPersonalityProfileView
}) {
  return (
    <InfoCard title="🧬 最终 AI 人格结果（已融合）">
      <div style={{ lineHeight: 1.9 }}>
        <ValueLine
          label="当前模式"
          value={hasBirthHour ? "紫微结构 + 八字动力融合" : "八字三柱动力人格"}
        />
        <ValueLine
          label="人格标签"
          value={finalPersonalityProfile.labels.join(" / ")}
        />
        <div style={{ marginTop: 8, color: "#555" }}>
          {finalPersonalityProfile.summary}
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
          gap: 18
        }}
      >
        <ScoreGroup
          title="统一人格向量"
          values={finalPersonalityProfile.vector}
          labelMap={FINAL_VECTOR_LABELS}
        />

        <ScoreGroup
          title="宠物行为偏置"
          values={finalPersonalityProfile.bias.petBehaviorBias}
          labelMap={FINAL_BIAS_LABELS}
        />

        <ScoreGroup
          title="管家行为偏置"
          values={finalPersonalityProfile.bias.butlerBehaviorBias}
          labelMap={FINAL_BIAS_LABELS}
        />

        <ScoreGroup
          title="建筑 / 家园偏置"
          values={finalPersonalityProfile.bias.buildingBias}
          labelMap={FINAL_BIAS_LABELS}
        />
      </div>
    </InfoCard>
  )
}