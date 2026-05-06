/**
 * 当前文件负责：展示 personality-test 页面的顶部总览区。
 */

import type { ActiveDynamicFlow } from "../../types"
import type { PersonalityTestRuntimeTime } from "../../runtime-time/personality-test-runtime-time-types"

function Chip({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 14,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.09)",
        color: "#fff",
        minWidth: 130,
      }}
    >
      <div
        style={{
          opacity: 0.72,
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <strong>{value}</strong>
    </div>
  )
}

export function TestDashboardHero({
  runtimeTime,
  activeFlow,
  hasBirthHour,
}: {
  runtimeTime: PersonalityTestRuntimeTime
  activeFlow: ActiveDynamicFlow
  hasBirthHour: boolean
}) {
  return (
    <section
      style={{
        borderRadius: 24,
        padding: 22,
        background:
          "linear-gradient(135deg, #111827 0%, #312e81 52%, #6d28d9 100%)",
        boxShadow: "0 22px 48px rgba(49, 46, 129, 0.28)",
        color: "#fff",
        marginBottom: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.7,
              fontWeight: 800,
            }}
          >
            AI-PET-WORLD
          </div>

          <h1
            style={{
              margin: "8px 0 8px",
              fontSize: 30,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
            }}
          >
            人格核心测试台
          </h1>

          <div
            style={{
              opacity: 0.82,
              lineHeight: 1.7,
              maxWidth: 780,
            }}
          >
            当前页面用于调试紫微主系统、八字辅助系统、五维性格映射，以及未来进入实际游戏的生命趋向链路。
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
            gap: 10,
            minWidth: 300,
          }}
        >
          <Chip
            label="当前层级"
            value={activeFlow}
          />
          <Chip
            label="出生时间"
            value={hasBirthHour ? "已知" : "未知"}
          />
          <Chip
            label="当前年龄"
            value={`${runtimeTime.currentAge} 岁`}
          />
          <Chip
            label="当前年份"
            value={runtimeTime.currentYear}
          />
        </div>
      </div>
    </section>
  )
}