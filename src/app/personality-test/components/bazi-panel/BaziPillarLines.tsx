/**
 * 当前文件负责：展示八字四柱基础信息。
 */

import { ValueLine } from "../common/ValueLine"
import type { BaziProfileView } from "./bazi-panel-types"

export function BaziPillarLines({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  return (
    <>
      <ValueLine label="年柱" value={baziProfile.chart.yearPillar.label} />
      <ValueLine label="月柱" value={baziProfile.chart.monthPillar.label} />
      <ValueLine label="日柱" value={baziProfile.chart.dayPillar.label} />

      {baziProfile.chart.hourPillar && (
        <ValueLine label="时柱" value={baziProfile.chart.hourPillar.label} />
      )}

      <ValueLine
        label="当前模式"
        value={baziProfile.chart.hasHour ? "四柱" : "三柱"}
      />
    </>
  )
}