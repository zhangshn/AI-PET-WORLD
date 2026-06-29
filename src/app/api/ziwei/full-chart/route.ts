import { NextResponse } from "next/server"

import type {
  FullZiweiDynamicChartInput,
  ZiweiApiErrorCode,
  TimeBranch,
  ZiweiApiResponse,
  ZiweiBirthInput,
  ZiweiCalendarType,
  ZiweiFullChartApiData,
  ZiweiGender
} from "@/ai/destiny-core/ziwei-core/contracts"
import {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiPageViewModel
} from "@/ai/destiny-core/ziwei-core/public-api"
import { TIME_BRANCH_ORDER } from "@/ai/destiny-core/ziwei-core/shared"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const bodyObject = asRecord(body)
  const birthInputSource = asRecord(bodyObject?.birthInput) ?? bodyObject
  const birthInput = parseBirthInput(birthInputSource)

  if (!birthInput) {
    return jsonError(
      "invalid_birth_input",
      "出生参数无效，请检查 year、month、day、hour、minute、gender。",
      400
    )
  }

  if ((birthInput.calendarType ?? "solar") !== "solar") {
    return jsonError(
      "unsupported_calendar",
      "当前完整盘 API 暂只支持 solar 公历输入。",
      400
    )
  }

  const dynamicInputSource = asRecord(bodyObject?.dynamicInput)
  const dynamicInput = dynamicInputSource
    ? parseDynamicInput(dynamicInputSource)
    : null

  if (dynamicInputSource && !dynamicInput) {
    return jsonError(
      "invalid_birth_input",
      "动态盘参数无效，请检查 currentAge、currentYear、currentLunarMonth、currentLunarDay、currentTimeBranch。",
      400
    )
  }

  if (dynamicInput && !birthInput.gender) {
    return jsonError(
      "invalid_birth_input",
      "动态盘需要 gender，用于判断大限顺逆。",
      400
    )
  }

  try {
    const chart = buildFullZiweiChart(birthInput)
    const dynamicChart = dynamicInput
      ? buildFullZiweiDynamicChart({
          chart,
          input: dynamicInput
        })
      : undefined
    const viewModel = buildZiweiPageViewModel({
      chart,
      dynamicChart
    })

    return NextResponse.json({
      ok: true,
      data: {
        chart,
        dynamicChart,
        viewModel
      }
    } satisfies ZiweiApiResponse<ZiweiFullChartApiData>)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error."
    const isUnsupportedCalendar = message.includes("Only solar calendar")

    return jsonError(
      isUnsupportedCalendar ? "unsupported_calendar" : "placement_failed",
      message,
      isUnsupportedCalendar ? 400 : 500
    )
  }
}

function parseBirthInput(value: Record<string, unknown> | null): ZiweiBirthInput | null {
  if (!value) {
    return null
  }

  const year = readInteger(value.year)
  const month = readInteger(value.month)
  const day = readInteger(value.day)
  const hour = readInteger(value.hour)
  const minute = value.minute === undefined ? undefined : readInteger(value.minute)
  const calendarType = readCalendarType(value.calendarType ?? value.calendar)
  const gender = readGender(value.gender)
  const timezone = readOptionalString(value.timezone)
  const currentDate = readOptionalString(value.currentDate)
  const ruleSetVersion = readOptionalString(value.ruleSetVersion)

  if (
    year === null ||
    month === null ||
    day === null ||
    hour === null ||
    minute === null ||
    calendarType === null ||
    gender === null
  ) {
    return null
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    calendarType,
    gender,
    timezone,
    currentDate,
    ruleSetVersion
  }
}

function parseDynamicInput(
  value: Record<string, unknown>
): FullZiweiDynamicChartInput | null {
  const currentAge = readInteger(value.currentAge)
  const currentYear = readInteger(value.currentYear)
  const currentLunarMonth = readInteger(value.currentLunarMonth)
  const currentLunarDay = readInteger(value.currentLunarDay)
  const currentTimeBranch = readTimeBranch(value.currentTimeBranch)

  if (
    currentAge === null ||
    currentYear === null ||
    currentLunarMonth === null ||
    currentLunarDay === null ||
    currentTimeBranch === null
  ) {
    return null
  }

  return {
    currentAge,
    currentYear,
    currentLunarMonth,
    currentLunarDay,
    currentTimeBranch
  }
}

function jsonError(
  code: ZiweiApiErrorCode,
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message
    } satisfies ZiweiApiResponse<unknown>,
    { status }
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null
  }

  return value
}

function readCalendarType(value: unknown): ZiweiCalendarType | undefined | null {
  if (value === undefined) {
    return undefined
  }

  if (value === "solar" || value === "lunar") {
    return value
  }

  return null
}

function readGender(value: unknown): ZiweiGender | undefined | null {
  if (value === undefined) {
    return undefined
  }

  if (value === "male" || value === "female") {
    return value
  }

  return null
}

function readTimeBranch(value: unknown): TimeBranch | null {
  if (
    typeof value === "string" &&
    TIME_BRANCH_ORDER.includes(value as TimeBranch)
  ) {
    return value as TimeBranch
  }

  return null
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}
