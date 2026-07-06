import {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiPageViewModel
} from "@/ai/destiny-core/ziwei-core/public-api"

import { ZiweiClientPage } from "./_components/ziwei-client-page"
import type { ZiweiFormState } from "./_components/birth-input-panel"

type ZiweiPageSearchParams = Record<string, string | string[] | undefined>

export const metadata = {
  title: "紫微斗数完整盘",
  description: "紫微斗数完整排盘、动态流与星曜总表"
}

const initialForm: ZiweiFormState = {
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  minute: 0,
  gender: "male",
  currentAge: 36,
  currentYear: 2026,
  currentLunarMonth: 5,
  currentLunarDay: 13,
  currentTimeBranch: "si"
}

export default async function ZiweiPage(props: {
  searchParams?: Promise<ZiweiPageSearchParams>
}) {
  const initialSearchParams = normalizeSearchParams(
    await props.searchParams
  )
  const chart = buildFullZiweiChart({
    calendarType: "solar",
    year: initialForm.year,
    month: initialForm.month,
    day: initialForm.day,
    hour: initialForm.hour,
    minute: initialForm.minute,
    gender: initialForm.gender
  })
  const dynamicChart = buildFullZiweiDynamicChart({
    chart,
    input: {
      currentAge: initialForm.currentAge,
      currentYear: initialForm.currentYear,
      currentLunarMonth: initialForm.currentLunarMonth,
      currentLunarDay: initialForm.currentLunarDay,
      currentTimeBranch: initialForm.currentTimeBranch
    }
  })
  const initialViewModel = buildZiweiPageViewModel({
    chart,
    dynamicChart
  })

  return (
    <ZiweiClientPage
      initialForm={initialForm}
      initialSearchParams={initialSearchParams}
      initialViewModel={initialViewModel}
    />
  )
}

function normalizeSearchParams(
  searchParams: ZiweiPageSearchParams | undefined
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(searchParams ?? {}).flatMap(([key, value]) => {
      if (typeof value === "string") {
        return [[key, value]]
      }

      if (Array.isArray(value) && typeof value[0] === "string") {
        return [[key, value[0]]]
      }

      return []
    })
  )
}
