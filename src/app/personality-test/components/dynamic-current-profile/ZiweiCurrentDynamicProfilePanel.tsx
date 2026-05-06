/**
 * 当前文件负责：展示紫微当前流动人格与行动趋向。
 */

import type {
  CurrentDynamicProfile
} from "../../../../ai/ziwei-core/ziwei-gateway"

import { NumericScoreList } from "../ziwei-output/NumericScoreList"

function InfoLine({
  label,
  value
}: {
  label: string
  value: string | number
}) {
  return (
    <div style={{ lineHeight: 1.8 }}>
      <span style={{ color: "#777" }}>{label}：</span>
      <strong>{value}</strong>
    </div>
  )
}

export function ZiweiCurrentDynamicProfilePanel({
  profile
}: {
  profile: CurrentDynamicProfile
}) {
  return (
    <div
      style={{
        border: "1px solid #e8e8e8",
        borderRadius: 10,
        padding: 14,
        background: "#fff"
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <strong>🧬 当前流动人格 / 行动趋向</strong>
        <div
          style={{
            marginTop: 8,
            color: "#555",
            lineHeight: 1.8
          }}
        >
          {profile.labels.summary}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18
        }}
      >
        <div>
          <strong>当前动态层</strong>
          <div style={{ marginTop: 10 }}>
            <InfoLine
              label="主底盘"
              value={profile.dominantFlow.type}
            />
            <InfoLine
              label="时间主偏移"
              value={profile.temporalDominantFlow?.type ?? "无"}
            />
            <InfoLine
              label="当前阶段"
              value={profile.labels.phase}
            />
            <InfoLine
              label="当前关注"
              value={profile.labels.focus}
            />
            <InfoLine
              label="表达位置"
              value={profile.currentPreference.positionBias}
            />
            <InfoLine
              label="观察距离"
              value={profile.currentPreference.observationDistance}
            />
            <InfoLine
              label="表达语气"
              value={profile.currentPreference.toneBias}
            />
          </div>
        </div>

        <div>
          <strong>当前行动趋向</strong>
          <div style={{ marginTop: 10 }}>
            <NumericScoreList values={profile.currentTendencies} />
          </div>
        </div>

        <div>
          <strong>当前核心人格</strong>
          <div style={{ marginTop: 10 }}>
            <NumericScoreList
              values={profile.currentCorePersonality}
              multiplier={100}
            />
          </div>
        </div>

        <div>
          <strong>当前动态 traits</strong>
          <div style={{ marginTop: 10 }}>
            <NumericScoreList values={profile.currentTraits} />
          </div>
        </div>
      </div>
    </div>
  )
}