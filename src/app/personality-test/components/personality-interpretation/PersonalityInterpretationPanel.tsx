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
        请先选择男 / 女视角。男女不是单纯展示文案，而是进入紫微结构解释阶段的核心视角。
      </p>
    </InfoCard>
  )
}

function BaziOnlyNotice({
  baziProfile,
  finalPersonalityProfile,
}: {
  baziProfile: BaziProfile
  finalPersonalityProfile: FinalPersonalityProfile
}) {
  return (
    <InfoCard title="🧭 八字人格定义模式">
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
          当前出生时辰未知，紫微斗数无法生成完整命盘结构。本页不使用默认时辰强行解释紫微盘，
          而是改用八字作为主要人格定义来源。
        </p>

        <p
          style={{
            margin: 0,
            color: "#4b5563",
            lineHeight: 1.8,
          }}
        >
          八字模式下，系统主要读取五行动力、行动强度、稳定性、感知深度、持续力和适应力，
          用来定义当前生命的基础动力结构。
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
            <strong>八字模式：</strong>
            {baziProfile.mode}
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            <strong>精度：</strong>
            {baziProfile.precision}
          </div>
        </div>

        <SectionTitle>八字动力摘要</SectionTitle>

        <p
          style={{
            margin: 0,
            color: "#374151",
            lineHeight: 1.8,
          }}
        >
          {baziProfile.summary}
        </p>

        <SectionTitle>最终人格向量摘要</SectionTitle>

        <p
          style={{
            margin: 0,
            color: "#374151",
            lineHeight: 1.8,
          }}
        >
          {finalPersonalityProfile.summary}
        </p>
      </div>
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

function LifeFunctionList({
  profile,
}: {
  profile: PersonalityInterpretationProfile
}) {
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
    if (!hasBirthHour || selectedGenderPerspective === null) {
      return null
    }

    return buildAiPersonalityInterpretation({
      ziweiProfile,
      baziProfile,
      finalPersonalityProfile,
      genderPerspective: selectedGenderPerspective as GenderPerspective,
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

  if (!hasBirthHour) {
    return (
      <BaziOnlyNotice
        baziProfile={baziProfile}
        finalPersonalityProfile={finalPersonalityProfile}
      />
    )
  }

  if (interpretationProfile === null) {
    return null
  }

  const title =
    selectedGenderPerspective === "male"
      ? "🧭 男命视角人格解释核心"
      : "🧭 女命视角人格解释核心"

  return (
    <InfoCard title={title}>
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

        <SectionTitle>五维性格解释</SectionTitle>
        <FiveDimensionList profile={interpretationProfile} />

        <SectionTitle>紫微生命功能解释</SectionTitle>
        <LifeFunctionList profile={interpretationProfile} />

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