/**
 * 当前文件负责：展示紫微人格 debug pair 命中信息。
 */

import { ValueLine } from "../common/ValueLine"
import type { ZiweiDebugView } from "./ziwei-output-types"

export function ZiweiDebugPairView({
  debug
}: {
  debug?: ZiweiDebugView
}) {
  if (!debug) {
    return null
  }

  return (
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
  )
}