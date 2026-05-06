/**
 * 当前文件负责：展示紫微、八字、五维映射到未来游戏行为系统的当前结果。
 */

import { useMemo } from "react"

import {
  buildZiweiCurrentDynamicProfile
} from "../../../../ai/ziwei-core/ziwei-gateway"

import type {
  BirthPattern,
  PersonalityProfile,
  PersonalityTraits
} from "../../../../ai/ziwei-core/schema"

import {
  buildBaziCurrentTendencyProfile,
  buildBaziRuntimeProfile
} from "../../../../ai/bazi-core/bazi-gateway"

import type {
  BaziProfile,
  BaziRuntimeGender
} from "../../../../ai/bazi-core/bazi-gateway"

import type { DynamicGenderInput } from "../../types"
import type { PersonalityTestRuntimeTime } from "../../runtime-time/personality-test-runtime-time-types"

type ScoreMap = Record<string, number>

type MappingScoreItem = {
  key: string
  label: string
  score: number
  source: string
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 50
  }

  if (value < 0) {
    return 0
  }

  if (value > 100) {
    return 100
  }

  return Math.round(value)
}

function resolveGender(dynamicGender: DynamicGenderInput): BaziRuntimeGender {
  if (dynamicGender === "male" || dynamicGender === "female") {
    return dynamicGender
  }

  return "unknown"
}

function getTrait(traits: PersonalityTraits, key: string): number {
  return clampScore(traits[key] ?? 50)
}

function buildFiveDimensionScores(
  traits: PersonalityTraits | null
): ScoreMap {
  if (!traits) {
    return {
      explore: 50,
      observe: 50,
      approach: 50,
      recover: 50,
      care: 50,
      protect: 50,
      boundary: 50,
      routine: 50,
      action: 50,
      perception: 50,
      stability: 50,
    }
  }

  const activity = getTrait(traits, "activity")
  const curiosity = getTrait(traits, "curiosity")
  const discipline = getTrait(traits, "discipline")
  const stability = getTrait(traits, "stability")
  const caregiving = getTrait(traits, "caregiving")
  const restPreference = getTrait(traits, "restPreference")
  const emotionalSensitivity = getTrait(traits, "emotionalSensitivity")

  return {
    explore: clampScore(activity * 0.45 + curiosity * 0.55),
    observe: clampScore(
      curiosity * 0.45 +
        emotionalSensitivity * 0.35 +
        discipline * 0.2
    ),
    approach: clampScore(
      activity * 0.25 +
        stability * 0.35 +
        caregiving * 0.25 +
        (100 - emotionalSensitivity) * 0.15
    ),
    recover: clampScore(
      restPreference * 0.55 +
        stability * 0.3 +
        discipline * 0.15
    ),
    care: clampScore(
      caregiving * 0.6 +
        stability * 0.2 +
        restPreference * 0.2
    ),
    protect: clampScore(
      caregiving * 0.35 +
        stability * 0.35 +
        discipline * 0.3
    ),
    boundary: clampScore(
      discipline * 0.55 +
        stability * 0.25 +
        emotionalSensitivity * 0.2
    ),
    routine: clampScore(
      discipline * 0.65 +
        restPreference * 0.2 +
        stability * 0.15
    ),
    action: clampScore(
      activity * 0.5 +
        discipline * 0.3 +
        curiosity * 0.2
    ),
    perception: clampScore(
      curiosity * 0.4 +
        emotionalSensitivity * 0.45 +
        stability * 0.15
    ),
    stability: clampScore(
      stability * 0.55 +
        restPreference * 0.25 +
        discipline * 0.2
    ),
  }
}

function mixScores(params: {
  ziwei: number | null
  bazi: number
  five: number
}): number {
  if (params.ziwei === null) {
    return clampScore(params.bazi * 0.6 + params.five * 0.4)
  }

  return clampScore(
    params.ziwei * 0.55 +
      params.bazi * 0.3 +
      params.five * 0.15
  )
}

function getLevelLabel(score: number): string {
  if (score >= 70) {
    return "strong"
  }

  if (score >= 55) {
    return "medium_high"
  }

  if (score >= 45) {
    return "medium"
  }

  if (score >= 30) {
    return "medium_low"
  }

  return "low"
}

function ScoreRow({
  item
}: {
  item: MappingScoreItem
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr 96px",
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
        {item.score} · {getLevelLabel(item.score)}
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

function buildGameMappingScores(params: {
  ziweiProfile: ReturnType<typeof buildZiweiCurrentDynamicProfile> | null
  baziTendency: ReturnType<typeof buildBaziCurrentTendencyProfile>
  fiveScores: ScoreMap
}): MappingScoreItem[] {
    const ziweiTendencies =
    params.ziweiProfile && params.ziweiProfile.ok
      ? params.ziweiProfile.data.currentTendencies
      : null

  const bazi = params.baziTendency.currentTendencies
  const five = params.fiveScores

  return [
    {
      key: "explore",
      label: "探索趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.exploreTendency ?? null,
        bazi: bazi.explorationTendency,
        five: five.explore,
      }),
      source: "紫微 explore + 八字 exploration + 五维探索性",
    },
    {
      key: "observe",
      label: "观察趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.observeTendency ?? null,
        bazi: bazi.perceptionTendency,
        five: five.observe,
      }),
      source: "紫微 observe + 八字 perception + 五维观察解释",
    },
    {
      key: "approach",
      label: "靠近趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.approachTendency ?? null,
        bazi: clampScore(
          bazi.adaptabilityTendency * 0.45 +
            bazi.actionTendency * 0.25 +
            (100 - bazi.cautionTendency) * 0.3
        ),
        five: five.approach,
      }),
      source: "紫微 approach + 八字适应/行动/谨慎修正 + 五维关系倾向",
    },
    {
      key: "recover",
      label: "恢复趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.recoverTendency ?? null,
        bazi: bazi.recoveryTendency,
        five: five.recover,
      }),
      source: "紫微 recover + 八字 recovery + 五维稳定/休息倾向",
    },
    {
      key: "care",
      label: "照护趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.careTendency ?? null,
        bazi: clampScore(
          bazi.stabilityTendency * 0.45 +
            bazi.recoveryTendency * 0.25 +
            bazi.perceptionTendency * 0.3
        ),
        five: five.care,
      }),
      source: "紫微 care + 八字稳定/感知辅助 + 五维照护性",
    },
    {
      key: "protect",
      label: "保护趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.protectTendency ?? null,
        bazi: clampScore(
          bazi.cautionTendency * 0.45 +
            bazi.stabilityTendency * 0.35 +
            bazi.perceptionTendency * 0.2
        ),
        five: five.protect,
      }),
      source: "紫微 protect + 八字谨慎/稳定辅助 + 五维保护性",
    },
    {
      key: "boundary",
      label: "边界趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.boundaryTendency ?? null,
        bazi: bazi.cautionTendency,
        five: five.boundary,
      }),
      source: "紫微 boundary + 八字 caution + 五维边界/执行解释",
    },
    {
      key: "routine",
      label: "秩序趋向",
      score: mixScores({
        ziwei: ziweiTendencies?.routineTendency ?? null,
        bazi: bazi.stabilityTendency,
        five: five.routine,
      }),
      source: "紫微 routine + 八字 stability + 五维执行/规律倾向",
    },
    {
      key: "action",
      label: "行动强度",
      score: mixScores({
        ziwei: ziweiTendencies?.exploreTendency ?? null,
        bazi: bazi.actionTendency,
        five: five.action,
      }),
      source: "紫微探索外显 + 八字 action + 五维活动/执行倾向",
    },
    {
      key: "perception",
      label: "感知深度",
      score: mixScores({
        ziwei: ziweiTendencies?.observeTendency ?? null,
        bazi: bazi.perceptionTendency,
        five: five.perception,
      }),
      source: "紫微观察 + 八字 perception + 五维敏感/好奇解释",
    },
  ]
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
  const mapping = useMemo(() => {
    const ziweiProfile =
      pattern && profile
        ? buildZiweiCurrentDynamicProfile({
            pattern,
            baseProfile: profile,
            gender: dynamicGender,
            currentAge: runtimeTime.currentAge,
            currentYear: runtimeTime.currentYear,
            currentLunarMonth: runtimeTime.currentLunarMonth,
            currentLunarDay: runtimeTime.currentLunarDay,
            currentTimeBranch: runtimeTime.currentTimeBranch,
          })
        : null

    const baziRuntimeProfile = buildBaziRuntimeProfile({
      birthChart: baziProfile.chart,
      gender: resolveGender(dynamicGender),
      currentYear: runtimeTime.currentYear,
      currentMonth: runtimeTime.currentMonth,
      currentDay: runtimeTime.currentDay,
      currentHour: runtimeTime.currentHour,
    })

    const baziTendency = buildBaziCurrentTendencyProfile({
      baseProfile: baziProfile,
      runtimeProfile: baziRuntimeProfile,
    })

    const dynamicTraits =
    ziweiProfile && ziweiProfile.ok
    ? ziweiProfile.data.currentTraits
    : profile?.traits ?? null

    const fiveScores = buildFiveDimensionScores(dynamicTraits)

    const scores = buildGameMappingScores({
      ziweiProfile,
      baziTendency,
      fiveScores,
    })

    const topScores = [...scores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)

    return {
      ziweiProfile,
      baziTendency,
      fiveScores,
      scores,
      topScores,
    }
  }, [
    pattern,
    profile,
    baziProfile,
    dynamicGender,
    runtimeTime,
  ])

  const ziweiSummary =
    mapping.ziweiProfile && mapping.ziweiProfile.ok
      ? mapping.ziweiProfile.data.labels.summary
      : "紫微动态数据暂不可用，当前映射将主要参考八字辅助与五维解释。"

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
          📌 当前动态映射结果
        </div>
        <div
          style={{
            marginTop: 6,
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          这里不是普通文字说明，而是把当前紫微动态、八字辅助和五维解释映射成未来游戏行为系统可以读取的生命趋向。
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
          text={ziweiSummary}
        />

        <FlowStep
          title="2. 八字辅助"
          text={mapping.baziTendency.labels.summary}
        />

        <FlowStep
          title="3. 五维解释"
          text="五维把紫微主导和八字辅助翻译成探索、依附、稳定、执行、照护等可读维度。当前这里先读取原始 traits，下一步会升级为动态五维。"
        />

        <FlowStep
          title="4. 游戏行为入口"
          text="这些分数不会直接输出 action，而是作为 drive / goal / behavior 前的生命趋向输入，影响宠物和管家的感知解释、记忆更新与行为表达。"
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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {mapping.topScores.map((item) => (
            <div
              key={item.key}
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
                {getLevelLabel(item.score)}
              </div>
            </div>
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
        {mapping.scores.map((item) => (
          <ScoreRow key={item.key} item={item} />
        ))}
      </div>

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
        紫微动态层更新
        {" → "}
        八字辅助场更新
        {" → "}
        五维映射
        {" → "}
        当前生命趋向 Top：
        {mapping.topScores.map((item) => item.label).join(" / ")}
        {" → "}
        drive / goal / behavior 读取。
      </div>
    </div>
  )
}