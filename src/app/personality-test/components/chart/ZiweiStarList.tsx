/**
 * 当前文件负责：展示紫微宫格中的原生星曜。
 */

import type { StarId } from "../../../../ai/ziwei-core/schema"
import { getStarDisplay } from "../../utils"

export function ZiweiStarList({
  stars
}: {
  stars: StarId[]
}) {
  return (
    <div style={{ lineHeight: 1.6, marginBottom: 6 }}>
      {stars.length > 0 ? (
        <>
          <div style={{ color: "#333", marginBottom: 4 }}>原生星：</div>
          {stars.map((starId) => (
            <div key={starId}>{getStarDisplay(starId)}</div>
          ))}
        </>
      ) : (
        <div style={{ color: "#999" }}>原生：空宫</div>
      )}
    </div>
  )
}