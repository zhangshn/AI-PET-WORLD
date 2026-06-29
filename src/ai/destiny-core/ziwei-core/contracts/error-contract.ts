import type { FullZiweiDynamicChart } from "./dynamic-chart-contract"
import type { FullZiweiChart } from "./full-chart-contract"
import type { ZiweiPageViewModel } from "./page-view-contract"

export type ZiweiApiErrorCode =
  | "invalid_birth_input"
  | "unsupported_calendar"
  | "missing_contract"
  | "placement_failed"
  | "validation_failed"
  | "internal_error"

export interface ZiweiApiError {
  ok: false
  code: ZiweiApiErrorCode
  message: string
}

export interface ZiweiApiSuccess<T> {
  ok: true
  data: T
}

export type ZiweiApiResponse<T> = ZiweiApiSuccess<T> | ZiweiApiError

export interface ZiweiFullChartApiData {
  chart: FullZiweiChart
  dynamicChart?: FullZiweiDynamicChart
  viewModel: ZiweiPageViewModel
}
