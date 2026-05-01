/**
 * 当前文件负责：管理 personality-test 页面的出生输入状态。
 */

import { useMemo, useState } from "react"

import type { DynamicGenderInput } from "../types"
import { parseBirthHourInput } from "../components/birth-input/birth-input-utils"

export function useBirthInputState() {
  const [year, setYear] = useState(1900)
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [birthHourInput, setBirthHourInput] = useState("未知")
  const [dynamicGender, setDynamicGender] = useState<DynamicGenderInput>("")

  const parsedBirthHour = useMemo(() => {
    return parseBirthHourInput(birthHourInput)
  }, [birthHourInput])

  const hasBirthHour = parsedBirthHour !== null
  const ziweiHour = parsedBirthHour ?? 0

  function updateDate(nextInput: {
    year?: number
    month?: number
    day?: number
  }) {
    const nextYear = nextInput.year ?? year
    const nextMonth = nextInput.month ?? month
    const nextDay = nextInput.day ?? day

    setYear(nextYear)
    setMonth(nextMonth)
    setDay(nextDay)

    return {
      year: nextYear,
      month: nextMonth,
      day: nextDay,
      hour: parsedBirthHour
    }
  }

  function updateBirthHourInput(value: string) {
    const nextHour = parseBirthHourInput(value)
    setBirthHourInput(value)

    return {
      year,
      month,
      day,
      hour: nextHour
    }
  }

  return {
    birthInput: {
      year,
      month,
      day,
      birthHourInput,
      dynamicGender,
      parsedBirthHour,
      hasBirthHour,
      ziweiHour
    },

    birthInputActions: {
      setDynamicGender,
      updateDate,
      updateBirthHourInput
    }
  }
}