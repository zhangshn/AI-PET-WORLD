/**
 * 当前文件负责：展示 personality-test 页面统一动态时间状态。
 */

import type { PersonalityTestRuntimeTime } from "./personality-test-runtime-time-types"

export function PersonalityTestRuntimeTimePanel({
  runtimeTime,
}: {
  runtimeTime: PersonalityTestRuntimeTime
}) {
  return (
    <div
      style={{
        border: "1px solid #e8e8e8",
        borderRadius: 12,
        padding: 14,
        background: "#fffdf7",
        lineHeight: 1.8,
      }}
    >
      <strong>⏱ 统一动态时间</strong>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
          gap: 10,
          marginTop: 10,
        }}
      >
        <div>
          <span style={{ color: "#777" }}>公历：</span>
          <strong>
            {runtimeTime.currentYear}-{runtimeTime.currentMonth}-
            {runtimeTime.currentDay}
          </strong>
        </div>

        <div>
          <span style={{ color: "#777" }}>小时：</span>
          <strong>
            {runtimeTime.currentHour === null
              ? "未知"
              : `${runtimeTime.currentHour}:00`}
          </strong>
        </div>

        <div>
          <span style={{ color: "#777" }}>年龄：</span>
          <strong>{runtimeTime.currentAge} 岁</strong>
        </div>

        <div>
          <span style={{ color: "#777" }}>紫微时辰：</span>
          <strong>{runtimeTime.currentTimeBranch}</strong>
        </div>

        <div>
          <span style={{ color: "#777" }}>紫微流月：</span>
          <strong>{runtimeTime.currentLunarMonth}</strong>
        </div>

        <div>
          <span style={{ color: "#777" }}>紫微流日：</span>
          <strong>{runtimeTime.currentLunarDay}</strong>
        </div>

        <div style={{ gridColumn: "1 / -1", color: "#777" }}>
          注意：紫微和八字只同步“当前时间点”，不会同步大运结果。两套系统会按各自起运规则独立落位。
        </div>
      </div>
    </div>
  )
}