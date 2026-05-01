/**
 * 当前文件负责：组装八字动力底盘展示面板。
 */

import { InfoCard } from "../common/InfoCard"
import { BaziElementLine } from "./BaziElementLine"
import { BaziPillarLines } from "./BaziPillarLines"
import type { BaziProfileView } from "./bazi-panel-types"

export function BaziProfilePanel({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  return (
    <InfoCard title="☯ 八字动力底盘">
      <div style={{ lineHeight: 2 }}>
        <BaziPillarLines baziProfile={baziProfile} />
        <BaziElementLine dominantElements={baziProfile.dominantElements} />
      </div>
    </InfoCard>
  )
}