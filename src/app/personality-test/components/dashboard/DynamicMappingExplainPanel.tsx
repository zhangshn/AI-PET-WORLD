/**
 * 当前文件负责：说明紫微、八字、五维映射与未来游戏行为系统的关系。
 */

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

export function DynamicMappingExplainPanel() {
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
          📌 动态映射说明
        </div>
        <div
          style={{
            marginTop: 6,
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          这里不是普通文字说明，而是当前命理核心进入未来游戏行为系统的映射规则。
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 12,
        }}
      >
        <FlowStep
          title="1. 紫微主导"
          text="紫微负责生命底盘、宫位结构、主星倾向、大运、流年、流月、流日、流时。它决定生命体更容易如何理解世界，以及当前阶段更容易走向哪里。"
        />

        <FlowStep
          title="2. 八字辅助"
          text="八字负责五行气质、能量强弱、行动节奏、恢复倾向、谨慎倾向、感知深度等辅助修正。它不覆盖紫微，只提供当前环境场和气质修正。"
        />

        <FlowStep
          title="3. 五维映射"
          text="五维不是新的命理系统，而是解释层。它把紫微主导结果和八字辅助结果翻译成探索性、依附性、稳定性、执行性、照护性等可读维度。"
        />

        <FlowStep
          title="4. 游戏行为链路"
          text="未来进入实际游戏后，这些结果不会直接输出 action，而是进入生命趋向系统，影响宠物和管家的 drive、goal、感知解释、记忆更新和行为表达。"
        />
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
        <strong>正确链路：</strong>
        世界时间变化 → 紫微动态更新 → 八字辅助更新 → 五维动态映射 →
        当前生命趋向 → drive / goal → 行为表达。
      </div>
    </div>
  )
}