/**
 * 当前文件负责：展示紫微人格结构输出结果。
 */

import { InfoCard } from "../common/InfoCard"
import { ScoreLine } from "../common/ScoreLine"
import { ValueLine } from "../common/ValueLine"

type PairDebugItem = {
  pairLabel: string
}

type ZiweiDebugView = {
  hitPairs: PairDebugItem[]
  supportPairs: PairDebugItem[]
}

type NumericObjectView = object

function renderNumericEntries(value: NumericObjectView) {
  return Object.entries(value).map(([key, itemValue]) => {
    return (
      <ScoreLine
        key={key}
        name={key}
        value={Number(itemValue)}
      />
    )
  })
}

export function ZiweiPersonalityOutputPanel({
  corePersonality,
  traits,
  summaries,
  debug
}: {
  corePersonality: NumericObjectView
  traits: NumericObjectView
  summaries: string[]
  debug?: ZiweiDebugView
}) {
  return (
    <InfoCard title="🧩 紫微人格输出">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18
        }}
      >
        <div>
          <strong>核心人格</strong>
          <div style={{ marginTop: 10 }}>
            {Object.entries(corePersonality).map(([key, value]) => {
              return (
                <ScoreLine
                  key={key}
                  name={key}
                  value={Number(value) * 100}
                />
              )
            })}
          </div>
        </div>

        <div>
          <strong>行为 traits</strong>
          <div style={{ marginTop: 10 }}>
            {renderNumericEntries(traits)}
          </div>
        </div>
      </div>

      <hr
        style={{
          margin: "16px 0",
          border: "none",
          borderTop: "1px solid #eee"
        }}
      />

      <strong>摘要</strong>
      <div style={{ marginTop: 10, lineHeight: 1.8 }}>
        {summaries.length > 0 ? (
          summaries.map((summary) => {
            return <div key={summary}>- {summary}</div>
          })
        ) : (
          <div style={{ color: "#999" }}>暂无摘要</div>
        )}
      </div>

      {debug && (
        <>
          <hr
            style={{
              margin: "16px 0",
              border: "none",
              borderTop: "1px solid #eee"
            }}
          />

          <strong>Debug Pair</strong>
          <div style={{ marginTop: 10, lineHeight: 1.8 }}>
            <ValueLine
              label="命中组合"
              value={
                debug.hitPairs.length > 0
                  ? debug.hitPairs.map((item) => item.pairLabel).join(" / ")
                  : "无"
              }
            />
            <ValueLine
              label="support 组合"
              value={
                debug.supportPairs.length > 0
                  ? debug.supportPairs.map((item) => item.pairLabel).join(" / ")
                  : "无"
              }
            />
          </div>
        </>
      )}
    </InfoCard>
  )
}