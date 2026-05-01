/**
 * 当前文件负责：展示八字动力底盘中的主导五行与弱项五行。
 */

import { ValueLine } from "../common/ValueLine"
import { getBaziElementLabel } from "./bazi-panel-labels"

export function BaziElementLine({
  dominantElements,
  weakElements
}: {
  dominantElements: string[]
  weakElements?: string[]
}) {
  return (
    <>
      <ValueLine
        label="主导五行"
        value={dominantElements.map(getBaziElementLabel).join(" / ")}
      />

      {weakElements && weakElements.length > 0 && (
        <ValueLine
          label="相对弱项"
          value={weakElements.map(getBaziElementLabel).join(" / ")}
        />
      )}
    </>
  )
}