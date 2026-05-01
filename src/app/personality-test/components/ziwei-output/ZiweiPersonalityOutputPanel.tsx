/**
 * 当前文件负责：组装紫微人格结构输出结果面板。
 */

import { InfoCard } from "../common/InfoCard"

import { NumericScoreList } from "./NumericScoreList"
import { ZiweiDebugPairView } from "./ZiweiDebugPairView"
import { ZiweiSummaryList } from "./ZiweiSummaryList"

import type {
  NumericObjectView,
  ZiweiDebugView
} from "./ziwei-output-types"

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
            <NumericScoreList
              values={corePersonality}
              multiplier={100}
            />
          </div>
        </div>

        <div>
          <strong>行为 traits</strong>
          <div style={{ marginTop: 10 }}>
            <NumericScoreList values={traits} />
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
      <ZiweiSummaryList summaries={summaries} />

      <ZiweiDebugPairView debug={debug} />
    </InfoCard>
  )
}