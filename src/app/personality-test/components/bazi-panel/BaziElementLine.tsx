/**
 * 当前文件负责：展示八字动力底盘中的五行信息。
 */

import { WUXING_LABELS } from "../../constants"
import { ValueLine } from "../common/ValueLine"

export function BaziElementLine({
  dominantElements
}: {
  dominantElements: string[]
}) {
  return (
    <ValueLine
      label="主导五行"
      value={dominantElements
        .map((element) => {
          return WUXING_LABELS[element] ?? element
        })
        .join(" / ")}
    />
  )
}