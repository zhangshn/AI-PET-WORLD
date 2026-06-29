import type {
  NormalizedZiweiBirthInput,
  ZiweiBirthInput
} from "../contracts"

export const DEFAULT_ZIWEI_RULE_SET_VERSION = "ziwei-full-chart-v1"

export function normalizeZiweiBirthInput(
  input: ZiweiBirthInput
): NormalizedZiweiBirthInput {
  validateZiweiBirthInput(input)

  return {
    calendarType: input.calendarType ?? "solar",
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute ?? 0,
    gender: input.gender,
    timezone: input.timezone ?? "Asia/Shanghai",
    currentDate: input.currentDate,
    ruleSetVersion: input.ruleSetVersion ?? DEFAULT_ZIWEI_RULE_SET_VERSION
  }
}

export function validateZiweiBirthInput(input: ZiweiBirthInput): void {
  if (!Number.isInteger(input.year) || input.year <= 0) {
    throw new Error("Invalid birth year.")
  }

  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("Invalid birth month.")
  }

  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) {
    throw new Error("Invalid birth day.")
  }

  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("Invalid birth hour.")
  }

  if (
    input.minute !== undefined &&
    (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59)
  ) {
    throw new Error("Invalid birth minute.")
  }
}
