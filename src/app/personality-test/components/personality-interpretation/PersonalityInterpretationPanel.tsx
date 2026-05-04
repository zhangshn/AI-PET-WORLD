/**
 * 当前文件负责：展示同盘男女人格解释核心对照结果。
 */

import { useMemo } from "react"

import type {
  BaziProfile,
  FinalPersonalityProfile,
  GenderPerspectiveComparison,
  PersonalityProfile,
} from "../../../../ai/gateway"
import { buildAiPersonalityGenderComparison } from "../../../../ai/gateway"

import { InfoCard } from "../common/InfoCard"

function ScoreBadge({
  score,
  level,
}: {
  score: number
  level: string
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: "#f3f4f6",
        color: "#111827",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {score}
      <span style={{ color: "#6b7280" }}>{level}</span>
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        margin: "14px 0 8px",
        fontSize: 15,
        color: "#111827",
      }}
    >
      {children}
    </h4>
  )
}

function DimensionList({
  title,
  profile,
}: {
  title: string
  profile: GenderPerspectiveComparison["maleProfile"]
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 14,
        background: "#fafafa",
      }}
    >
      <h4
        style={{
          margin: "0 0 10px",
          fontSize: 15,
        }}
      >
        {title}
      </h4>

      <p
        style={{
          margin: "0 0 12px",
          color: "#4b5563",
          lineHeight: 1.7,
          fontSize: 13,
        }}
      >
        {profile.summary}
      </p>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {profile.fiveDimensionProfile.dimensions.map((dimension) => (
          <div
            key={dimension.key}
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #eee",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <strong>{dimension.label}</strong>
              <ScoreBadge
                score={dimension.score}
                level={dimension.level}
              />
            </div>

            <p
              style={{
                margin: "0 0 6px",
                color: "#374151",
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              {dimension.baseMeaning}
            </p>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              {dimension.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LifeFunctionList({
  title,
  profile,
}: {
  title: string
  profile: GenderPerspectiveComparison["maleProfile"]
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
      }}
    >
      <h4
        style={{
          margin: "0 0 10px",
          fontSize: 15,
        }}
      >
        {title}
      </h4>

      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        {profile.ziweiLifeFunctionProfile.functions.map((item) => (
          <div
            key={item.key}
            style={{
              display: "grid",
              gridTemplateColumns: "92px 1fr auto",
              gap: 10,
              alignItems: "start",
              padding: "8px 0",
              borderBottom: "1px dashed #e5e7eb",
            }}
          >
            <strong>{item.label}</strong>

            <span
              style={{
                color: "#4b5563",
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              {item.genderFocus}
            </span>

            <ScoreBadge score={item.score} level={item.level} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PersonalityInterpretationPanel({
  ziweiProfile,
  baziProfile,
  finalPersonalityProfile,
}: {
  ziweiProfile: PersonalityProfile
  baziProfile: BaziProfile
  finalPersonalityProfile: FinalPersonalityProfile
}) {
  const comparison = useMemo(() => {
    return buildAiPersonalityGenderComparison({
      ziweiProfile,
      baziProfile,
      finalPersonalityProfile,
    })
  }, [ziweiProfile, baziProfile, finalPersonalityProfile])

  return (
    <InfoCard title="🧭 同盘男女人格解释核心">
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#374151",
            lineHeight: 1.8,
          }}
        >
          {comparison.conclusion}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
            fontSize: 13,
          }}
        >
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            <strong>是否同一紫微结构：</strong>
            {comparison.sameBirthStructure ? "是" : "否"}
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            <strong>是否同一最终向量：</strong>
            {comparison.sameFinalVector ? "是" : "否"}
          </div>
        </div>

        <SectionTitle>五维性格对照</SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <DimensionList title="男命视角" profile={comparison.maleProfile} />
          <DimensionList title="女命视角" profile={comparison.femaleProfile} />
        </div>

        <SectionTitle>紫微生命功能解释对照</SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <LifeFunctionList title="男命视角" profile={comparison.maleProfile} />
          <LifeFunctionList title="女命视角" profile={comparison.femaleProfile} />
        </div>

        <details
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          <summary style={{ cursor: "pointer" }}>调试信息</summary>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f9fafb",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(comparison.debug, null, 2)}
          </pre>
        </details>
      </div>
    </InfoCard>
  )
}