/**
 * 当前文件负责：展示八字模式、精度与日主信息。
 */

import { ValueLine } from "../common/ValueLine"

export function BaziModeLine({
  mode,
  precision,
  hasHour,
  dayMaster
}: {
  mode?: string
  precision?: string
  hasHour?: boolean
  dayMaster?: string
}) {
  const modeLabel =
    mode === "FOUR_PILLARS"
      ? "四柱"
      : mode === "THREE_PILLARS"
        ? "三柱"
        : hasHour
          ? "四柱"
          : "三柱"

  const precisionLabel =
    precision === "high"
      ? "高"
      : precision === "medium"
        ? "中"
        : hasHour
          ? "高"
          : "中"

  return (
    <>
      <ValueLine label="当前模式" value={modeLabel} />
      <ValueLine label="能量精度" value={precisionLabel} />
      {dayMaster && <ValueLine label="日主" value={dayMaster} />}
    </>
  )
}