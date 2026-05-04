/**
 * 当前文件负责：展示当前性别视角下的最终人格映射结果。
 */

import type { ReactNode } from "react"

import type {
  LifePersonalityProfileBundle,
  PersonalityInterpretationProfile,
} from "../../../../ai/gateway"

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

function SectionTitle({ children }: { children: ReactNode }) {
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
    <InfoCard title="🧭 最终人格映射核心">
      <p
        style={{
          margin: 0,
          color: "#4b5563",
          lineHeight: 1.8,
        }}
      >
        请先选择男 / 女视角。当前核心逻辑是先确定性别视角，再进入紫微或八字映射，
        最后生成对应性格与行为偏置。
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
            gridTemplateColumns: "120px 1fr auto",
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
            gridTemplateColumns: "120px 1fr auto",
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

function BehaviorBiasPanel({
  bundle,
}: {
  bundle: LifePersonalityProfileBundle
}) {
  const bias = bundle.genderAwareBehaviorBias

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
        fontSize: 13,
      }}
    >
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f9fafb",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        {JSON.stringify(bias.petBehaviorBias, null, 2)}
      </pre>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f9fafb",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        {JSON.stringify(bias.butlerBehaviorBias, null, 2)}
      </pre>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#f9fafb",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        {JSON.stringify(bias.buildingBias, null, 2)}
      </pre>
    </div>
  )
}

export function PersonalityInterpretationPanel({
  dynamicGender,
  lifeProfileBundle,
}: {
  dynamicGender: DynamicGenderInput
  lifeProfileBundle: LifePersonalityProfileBundle | null
}) {
  if (dynamicGender !== "male" && dynamicGender !== "female") {
    return <EmptyGenderNotice />
  }

  if (lifeProfileBundle === null) {
    return <EmptyGenderNotice />
  }

  const interpretationProfile =
    lifeProfileBundle.personalityInterpretationProfile

  const viewpointText =
    lifeProfileBundle.genderPerspective === "male" ? "男命视角" : "女命视角"

  const modeText =
    interpretationProfile.mode === "ziwei_primary"
      ? "紫微主导人格映射"
      : "八字主导人格映射"

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
            <strong>映射顺序：</strong>
            先分性别，再映射性格
          </div>
        </div>

        <SectionTitle>五维性格结果</SectionTitle>
        <FiveDimensionList profile={interpretationProfile} />

        {interpretationProfile.mode === "ziwei_primary" ? (
          <>
            <SectionTitle>紫微生命功能映射</SectionTitle>
            <ZiweiLifeFunctionList profile={interpretationProfile} />
          </>
        ) : (
          <>
            <SectionTitle>八字男女动力映射</SectionTitle>
            <BaziGenderFunctionList profile={interpretationProfile} />
          </>
        )}

        <SectionTitle>最终行为偏置</SectionTitle>
        <BehaviorBiasPanel bundle={lifeProfileBundle} />

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
            {JSON.stringify(lifeProfileBundle.debug, null, 2)}
          </pre>
        </details>
      </div>
    </InfoCard>
  )
}