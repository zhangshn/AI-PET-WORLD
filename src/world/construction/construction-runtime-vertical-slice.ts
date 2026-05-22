/**
 * 当前文件职责：提供建设系统可运行纵向闭环的统一入口。
 */

import { buildConstructionRuntimeAdapterResult } from "./construction-runtime-adapter"
import type {
  ConstructionRuntimeVerticalSliceInput,
  ConstructionRuntimeVerticalSliceResult,
} from "./construction-schema"

export function runConstructionRuntimeVerticalSlice(
  input: ConstructionRuntimeVerticalSliceInput
): ConstructionRuntimeVerticalSliceResult {
  return buildConstructionRuntimeAdapterResult(input)
}
