/**
 * 当前文件负责：展示八字动力底盘。
 */

import { WUXING_LABELS } from "../../constants"
import { InfoCard } from "../common/InfoCard"
import { ValueLine } from "../common/ValueLine"

type BaziPillarView = {
  label: string
}

type BaziProfileView = {
  chart: {
    yearPillar: BaziPillarView
    monthPillar: BaziPillarView
    dayPillar: BaziPillarView
    hourPillar?: BaziPillarView | null
    hasHour: boolean
  }
  dominantElements: string[]
}

export function BaziProfilePanel({
  baziProfile
}: {
  baziProfile: BaziProfileView
}) {
  return (
    <InfoCard title="☯ 八字动力底盘">
      <div style={{ lineHeight: 2 }}>
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

        <ValueLine
          label="主导五行"
          value={baziProfile.dominantElements
            .map((element) => {
              return WUXING_LABELS[element] ?? element
            })
            .join(" / ")}
        />
      </div>
    </InfoCard>
  )
}