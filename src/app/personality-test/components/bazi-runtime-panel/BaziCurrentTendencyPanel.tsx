/**
 * 当前文件负责：展示八字当前流动气质与行动趋向。
 */

import type {
  BaziCurrentTendencyProfile,
  WuXingElement
} from "../../../../ai/destiny-core/bazi-core/bazi-gateway"

import { NumericScoreList } from "../ziwei-output/NumericScoreList"

import {
  BAZI_RUNTIME_ELEMENT_LABELS,
  BAZI_RUNTIME_MODIFIER_LABELS,
  formatRuntimeScore
} from "./bazi-runtime-panel-labels"

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

function renderElements(elements: WuXingElement[]): string {
  return elements.map((element) => {
    return BAZI_RUNTIME_ELEMENT_LABELS[element]
  }).join(" / ")
}

export function BaziCurrentTendencyPanel({
  profile
}: {
  profile: BaziCurrentTendencyProfile
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
        <strong>🧭 八字当前流动气质 / 行动趋向</strong>
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
          <strong>当前气质状态</strong>
          <div style={{ marginTop: 10 }}>
            <InfoLine
              label="模式"
              value={profile.labels.modeLabel}
            />
            <InfoLine
              label="精度"
              value={profile.labels.precisionLabel}
            />
            <InfoLine
              label="能量调性"
              value={profile.currentTemperament.energyTone}
            />
            <InfoLine
              label="动态主导五行"
              value={renderElements(
                profile.currentTemperament.dominantRuntimeElements
              )}
            />
            <InfoLine
              label="动态偏弱五行"
              value={renderElements(
                profile.currentTemperament.weakRuntimeElements
              )}
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
          <strong>动态状态修正</strong>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
              marginTop: 10
            }}
          >
            <tbody>
              {Object.entries(profile.currentTemperament.modifiers).map(
                ([key, value]) => {
                  const labelKey = key as keyof typeof BAZI_RUNTIME_MODIFIER_LABELS

                  return (
                    <tr key={key}>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #e5e5e5",
                          background: "#fafafa",
                          color: "#666",
                          fontWeight: 700,
                          width: 120,
                          textAlign: "center"
                        }}
                      >
                        {BAZI_RUNTIME_MODIFIER_LABELS[labelKey]}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          border: "1px solid #e5e5e5",
                          textAlign: "center"
                        }}
                      >
                        {formatRuntimeScore(value)}
                      </td>
                    </tr>
                  )
                }
              )}
            </tbody>
          </table>
        </div>

        <div>
          <strong>动态调试</strong>
          <div style={{ marginTop: 10, lineHeight: 1.8 }}>
            <InfoLine
              label="使用动态柱"
              value={profile.debug.usedRuntimePillars.join(" / ")}
            />
            <div style={{ color: "#666", marginTop: 8 }}>
              {profile.debug.note}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}