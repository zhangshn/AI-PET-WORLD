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

type BiasItem = {
  label: string
  value: number
  description: string
}

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

function BiasValueBar({ value }: { value: number }) {
  const normalizedValue = Math.max(0, Math.min(100, value))

  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${normalizedValue}%`,
          height: "100%",
          borderRadius: 999,
          background: "#111827",
        }}
      />
    </div>
  )
}

function BiasGroup({
  title,
  items,
}: {
  title: string
  items: BiasItem[]
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
      }}
    >
      <h5
        style={{
          margin: "0 0 10px",
          fontSize: 14,
          color: "#111827",
        }}
      >
        {title}
      </h5>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {items.map((item) => (
          <div key={item.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 4,
                fontSize: 13,
              }}
            >
              <strong>{item.label}</strong>
              <span style={{ color: "#4b5563" }}>{item.value}</span>
            </div>

            <BiasValueBar value={item.value} />

            <p
              style={{
                margin: "4px 0 0",
                color: "#6b7280",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BehaviorBiasPanel({
  bundle,
}: {
  bundle: LifePersonalityProfileBundle
}) {
  const bias = bundle.genderAwareBehaviorBias

  const petBiasItems: BiasItem[] = [
    {
      label: "初生主动性",
      value: bias.petBehaviorBias.newbornActivity,
      description: "影响宠物通过领养审查进入世界后是否更容易主动活动、试探环境。",
    },
    {
      label: "观察需求",
      value: bias.petBehaviorBias.observationNeed,
      description: "影响宠物面对环境变化时，是否更倾向先观察。",
    },
    {
      label: "依附需求",
      value: bias.petBehaviorBias.attachmentNeed,
      description: "影响宠物对陪伴、安全连接和关系靠近的需求。",
    },
    {
      label: "探索范围",
      value: bias.petBehaviorBias.explorationRange,
      description: "影响宠物愿意离开安全区、接触未知区域的范围。",
    },
    {
      label: "休息需求",
      value: bias.petBehaviorBias.restNeed,
      description: "影响宠物恢复、安静、低刺激环境的需求。",
    },
  ]

  const butlerBiasItems: BiasItem[] = [
    {
      label: "照护优先级",
      value: bias.butlerBehaviorBias.carePriority,
      description: "影响管家对照护点、未来宠物关系和稳定照看的优先程度。",
    },
    {
      label: "建设驱动力",
      value: bias.butlerBehaviorBias.constructionDrive,
      description: "影响管家建设家园、整理空间和推进任务的倾向。",
    },
    {
      label: "规律偏好",
      value: bias.butlerBehaviorBias.routinePreference,
      description: "影响管家是否偏好稳定流程、固定节奏和重复秩序。",
    },
    {
      label: "风险容忍",
      value: bias.butlerBehaviorBias.riskTolerance,
      description: "影响管家面对不确定事件时的保守或冒险倾向。",
    },
    {
      label: "响应速度",
      value: bias.butlerBehaviorBias.responseSpeed,
      description: "影响管家对外部变化、宠物状态变化的反应速度。",
    },
  ]

  const buildingBiasItems: BiasItem[] = [
    {
      label: "扩张偏好",
      value: bias.buildingBias.expansionPreference,
      description: "影响家园是否更倾向扩大空间、解锁区域和外向建设。",
    },
    {
      label: "稳定偏好",
      value: bias.buildingBias.stabilityPreference,
      description: "影响家园是否更强调安全、结构、长期稳定。",
    },
    {
      label: "舒适偏好",
      value: bias.buildingBias.comfortPreference,
      description: "影响家园是否更重视恢复、柔和、可停留的空间氛围。",
    },
    {
      label: "秩序偏好",
      value: bias.buildingBias.orderPreference,
      description: "影响家园布局是否更偏规则、分区、可管理。",
    },
    {
      label: "适应偏好",
      value: bias.buildingBias.adaptabilityPreference,
      description: "影响家园是否更容易根据状态变化进行调整。",
    },
  ]

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      <BiasGroup title="宠物行为偏置" items={petBiasItems} />
      <BiasGroup title="管家行为偏置" items={butlerBiasItems} />
      <BiasGroup title="家园建设偏置" items={buildingBiasItems} />
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
