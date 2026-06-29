export type ZiweiCalendarType = "solar" | "lunar"

export type ZiweiGender = "male" | "female"

export interface ZiweiBirthInput {
  calendarType?: ZiweiCalendarType
  year: number
  month: number
  day: number
  hour: number
  minute?: number
  gender?: ZiweiGender
  timezone?: string
  currentDate?: string
  ruleSetVersion?: string
}

export interface NormalizedZiweiBirthInput {
  calendarType: ZiweiCalendarType
  year: number
  month: number
  day: number
  hour: number
  minute: number
  gender?: ZiweiGender
  timezone: string
  currentDate?: string
  ruleSetVersion: string
}
