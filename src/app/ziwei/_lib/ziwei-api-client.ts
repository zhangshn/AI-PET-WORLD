import type {
  FullZiweiDynamicChartInput,
  ZiweiApiResponse,
  ZiweiBirthInput,
  ZiweiFullChartApiData
} from "@/ai/destiny-core/ziwei-core/contracts"

export async function fetchZiweiFullChart(params: {
  birthInput: ZiweiBirthInput
  dynamicInput?: FullZiweiDynamicChartInput
}): Promise<ZiweiApiResponse<ZiweiFullChartApiData>> {
  const response = await fetch("/api/ziwei/full-chart", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(params)
  })
  const body = await response.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      code: "internal_error",
      message: "接口返回不是有效 JSON。"
    }
  }

  return body as ZiweiApiResponse<ZiweiFullChartApiData>
}
