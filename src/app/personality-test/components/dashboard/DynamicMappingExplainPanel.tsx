/**
 * 当前文件负责：展示当前生命趋向核心映射结果。
 */

import { useMemo } from "react"

import {
  buildCurrentLifeTendencyFromRuntime
} from "../../../../ai/life-tendency-core/life-tendency-gateway"

import type {
  CurrentLifeTendencyProfile,
  LifeTendencyRuntimeGender,
  LifeTendencyScoreItem
} from "../../../../ai/life-tendency-core/life-tendency-gateway"

import type {
  BirthPattern,
  PersonalityProfile
} from "../../../../ai/ziwei-core/schema"

import type {
  BaziProfile
} from "../../../../ai/bazi-core/bazi-gateway"

import type { DynamicGenderInput } from "../../types"
import type { PersonalityTestRuntimeTime } from "../../runtime-time/personality-test-runtime-time-types"

function resolveRuntimeGender(
  dynamicGender: DynamicGenderInput
): LifeTendencyRuntimeGender {
  if (dynamicGender === "male" || dynamicGender === "female") {
    return dynamicGender
  }

  return "unknown"
}

function ScoreRow({
  item
}: {
  item: LifeTendencyScoreItem
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr 118px",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #eef0f3",
      }}
    >
      <strong>{item.label}</strong>

      <div>
        <div
          style={{
            height: 9,
            borderRadius: 999,
            background: "#eef2f7",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${item.score}%`,
              height: "100%",
              borderRadius: 999,
              background: "#7c3aed",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 12,
            color: "#667085",
            lineHeight: 1.5,
          }}
        >
          {item.source}
        </div>
      </div>

      <div
        style={{
          justifySelf: "end",
          borderRadius: 999,
          padding: "4px 8px",
          background: "#f4f4f5",
          fontSize: 12,
          fontWeight: 800,
          color: "#334155",
        }}
      >
        {item.score} · {item.level}
      </div>
    </div>
  )
}

function FlowStep({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div
      style={{
        border: "1px solid #e8e8e8",
        borderRadius: 14,
        padding: 14,
        background: "#fff",
      }}
    >
      <strong>{title}</strong>
      <div
        style={{
          marginTop: 6,
          color: "#5f6673",
          lineHeight: 1.75,
        }}
      >
        {text}
      </div>
    </div>
  )
}

function TopTendencyCard({
  item
}: {
  item: LifeTendencyScoreItem
}) {
  return (
    <div
      style={{
        border: "1px solid #e7e7e7",
        borderRadius: 14,
        padding: 12,
        background: "#fff",
      }}
    >
      <div style={{ color: "#667085", fontSize: 13 }}>
        {item.label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        {item.score}
      </div>
      <div
        style={{
          marginTop: 2,
          color: "#7c3aed",
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        {item.level}
      </div>
    </div>
  )
}

function FiveDimensionDebugBlock({
  profile
}: {
  profile: CurrentLifeTendencyProfile
}) {
  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid #eef0f3",
        borderRadius: 16,
        padding: 14,
        background: "#fff",
      }}
    >
      <strong>五维动态映射分数</strong>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {Object.entries(profile.fiveDimensionScores).map(([key, value]) => (
          <div
            key={key}
            style={{
              border: "1px solid #e8e8e8",
              borderRadius: 12,
              padding: 10,
              background: "#fbfcff",
            }}
          >
            <div
              style={{
                color: "#667085",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              {key}
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DynamicMappingExplainPanel({
  pattern,
  profile,
  baziProfile,
  dynamicGender,
  runtimeTime,
}: {
  pattern: BirthPattern | null
  profile: PersonalityProfile | null
  baziProfile: BaziProfile
  dynamicGender: DynamicGenderInput
  runtimeTime: PersonalityTestRuntimeTime
}) {
  const lifeTendencyProfile = useMemo(() => {
    return buildCurrentLifeTendencyFromRuntime({
      pattern,
      baseProfile: profile,
      baziProfile,
      gender: resolveRuntimeGender(dynamicGender),
      runtimeTime,
    })
  }, [
    pattern,
    profile,
    baziProfile,
    dynamicGender,
    runtimeTime,
  ])

  return (
    <div
      style={{
        border: "1px solid #e8e8e8",
        borderRadius: 18,
        padding: 18,
        background: "#fff",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          📌 {lifeTendencyProfile.labels.title}
        </div>
        <div
          style={{
            marginTop: 6,
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          {lifeTendencyProfile.labels.gameUsage}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <FlowStep
          title="1. 紫微主导"
          text={lifeTendencyProfile.sourceProfile.ziweiSummary}
        />

        <FlowStep
          title="2. 八字辅助"
          text={lifeTendencyProfile.sourceProfile.baziSummary}
        />

        <FlowStep
          title="3. 五维动态映射"
          text={lifeTendencyProfile.sourceProfile.fiveDimensionSummary}
        />

        <FlowStep
          title="4. 游戏行为入口"
          text={lifeTendencyProfile.labels.gameUsage}
        />
      </div>

      <div
        style={{
          border: "1px solid #eef0f3",
          borderRadius: 16,
          padding: 14,
          background: "#fbfcff",
          marginBottom: 16,
        }}
      >
        <strong>当前生命趋向 Top 4</strong>

        <div
          style={{
            marginTop: 8,
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          {lifeTendencyProfile.labels.summary}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {lifeTendencyProfile.topTendencies.map((item) => (
            <TopTendencyCard
              key={item.key}
              item={item}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #eef0f3",
          borderRadius: 16,
          padding: "4px 14px",
          background: "#fff",
        }}
      >
        {lifeTendencyProfile.scoreItems.map((item) => (
          <ScoreRow key={item.key} item={item} />
        ))}
      </div>

      <FiveDimensionDebugBlock profile={lifeTendencyProfile} />

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: "#f8fafc",
          color: "#475467",
          lineHeight: 1.8,
          border: "1px dashed #cbd5e1",
        }}
      >
        <strong>当前实际链路：</strong>
        世界时间 {runtimeTime.currentYear}-{runtimeTime.currentMonth}-{runtimeTime.currentDay}
        {" → "}
        life-tendency-core 自动构建紫微动态层
        {" → "}
        life-tendency-core 自动构建八字辅助场
        {" → "}
        当前生命趋向 Top：
        {lifeTendencyProfile.labels.topSummary}
        {" → "}
        drive / goal / behavior 读取。
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: "#fff",
          color: "#475467",
          lineHeight: 1.8,
          border: "1px solid #eef0f3",
        }}
      >
        <strong>调试：</strong>
        <div>
          紫微动态可用：
          {lifeTendencyProfile.debug.hasZiweiProfile ? "是" : "否"}
        </div>
        <div>
          使用紫微动态 traits：
          {lifeTendencyProfile.debug.usedZiweiDynamicTraits ? "是" : "否"}
        </div>
        <div>
          八字能量调性：
          {lifeTendencyProfile.debug.baziEnergyTone}
        </div>
        <div>
          八字动态柱：
          {lifeTendencyProfile.debug.baziUsedRuntimePillars.join(" / ")}
        </div>
      </div>
    </div>
  )
}