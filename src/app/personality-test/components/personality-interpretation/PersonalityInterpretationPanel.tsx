/**
 * 当前文件负责：展示当前性别视角下的人格解释核心结果。
 */

import { useMemo } from "react"

import type {
  BaziProfile,
  FinalPersonalityProfile,
  GenderPerspective,
  PersonalityInterpretationProfile,
  PersonalityProfile,
} from "../../../../ai/gateway"
import { buildAiPersonalityInterpretation } from "../../../../ai/gateway"

import type { DynamicGenderInput } from "../../types"
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

function EmptyGenderNotice() {
  return (
    <InfoCard title="🧭 人格解释核心">
      <p
        style={{
          margin: 0,
          color: "#4b5563",
          lineHeight: 1.8,
        }}
      >
        请先选择男 / 女视角。男女不是简单展示文案，而是人格解释核心的一部分。
        有出生时辰时进入紫微结构解释；无出生时辰时进入八字动力解释。
      </p>
    </InfoCard>
  )
}

function FiveDimensionList({
  profile,
}: {
  profile: PersonalityInterpretationProfile
}) {
  return (
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
            <ScoreBadge score={dimension.score} level={dimension.level} />
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
  )
}

function ZiweiLifeFunctionList({
  profile,
}: {
  profile: PersonalityInterpretationProfile
}) {
  if (profile.ziweiLifeFunctionProfile === null) {
    return null
  }

  return (
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
  )
}

function BaziGenderFunctionList({
  profile,
}: {
  profile: PersonalityInterpretationProfile
}) {
  if (profile.baziGenderFunctionProfile === null) {
    return null
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
      }}
    >
      {profile.baziGenderFunctionProfile.functions.map((item) => (
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
  )
}

export function PersonalityInterpretationPanel({
  hasBirthHour,
  genderPerspective,
  ziweiProfile,
  baziProfile,
  finalPersonalityProfile,
}: {
  hasBirthHour: boolean
  genderPerspective: DynamicGenderInput
  ziweiProfile: PersonalityProfile
  baziProfile: BaziProfile
  finalPersonalityProfile: FinalPersonalityProfile
}) {
  const selectedGenderPerspective =
    genderPerspective === "male" || genderPerspective === "female"
      ? genderPerspective
      : null

  const interpretationProfile = useMemo(() => {
    if (selectedGenderPerspective === null) {
      return null
    }

    return buildAiPersonalityInterpretation({
      ziweiProfile: hasBirthHour ? ziweiProfile : null,
      baziProfile,
      finalPersonalityProfile,
      genderPerspective: selectedGenderPerspective as GenderPerspective,
      hasBirthHour,
    })
  }, [
    hasBirthHour,
    selectedGenderPerspective,
    ziweiProfile,
    baziProfile,
    finalPersonalityProfile,
  ])

  if (selectedGenderPerspective === null) {
    return <EmptyGenderNotice />
  }

  if (interpretationProfile === null) {
    return null
  }

  const viewpointText =
    selectedGenderPerspective === "male" ? "男命视角" : "女命视角"

  const modeText =
    interpretationProfile.mode === "ziwei_primary"
      ? "紫微主导人格解释核心"
      : "八字主导人格解释核心"

  return (
    <InfoCard title={`🧭 ${viewpointText}${modeText}`}>
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
          {interpretationProfile.principle}
        </p>

        <p
          style={{
            margin: 0,
            color: "#4b5563",
            lineHeight: 1.8,
          }}
        >
          {interpretationProfile.summary}
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
            <strong>解释模式：</strong>
            {interpretationProfile.mode === "ziwei_primary"
              ? "紫微主导"
              : "八字主导"}
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            <strong>出生时辰：</strong>
            {hasBirthHour ? "已知" : "未知"}
          </div>
        </div>

        <SectionTitle>五维性格解释</SectionTitle>
        <FiveDimensionList profile={interpretationProfile} />

        {interpretationProfile.mode === "ziwei_primary" ? (
          <>
            <SectionTitle>紫微生命功能解释</SectionTitle>
            <ZiweiLifeFunctionList profile={interpretationProfile} />
          </>
        ) : (
          <>
            <SectionTitle>八字男女动力解释</SectionTitle>
            <BaziGenderFunctionList profile={interpretationProfile} />
          </>
        )}

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
            {JSON.stringify(interpretationProfile.debug, null, 2)}
          </pre>
        </details>
      </div>
    </InfoCard>
  )
}