/**
 * 当前文件负责：提供紫微动态时间表使用的时间计算工具。
 */

export function buildDaYunStartAges(startAge: number): number[] {
  return Array.from({ length: 10 }, (_, index) => {
    return startAge + index * 10
  })
}

export function getActiveDaYunStartAge(params: {
  startAge: number
  currentAge: number
}): number {
  if (params.currentAge < params.startAge) {
    return params.startAge
  }

  const offset = Math.floor((params.currentAge - params.startAge) / 10) * 10
  return params.startAge + offset
}

export function buildYearRange(params: {
  birthYear: number
  startAge: number
  currentAge: number
}): number[] {
  const baseAge =
    params.currentAge < params.startAge
      ? 1
      : getActiveDaYunStartAge({
          startAge: params.startAge,
          currentAge: params.currentAge
        })

  const startYear = params.birthYear + baseAge - 1

  return Array.from({ length: 12 }, (_, index) => {
    return startYear + index
  })
}

export function isSelectedDaYunAge(params: {
  startAge: number
  selectedStartAge: number
  currentAge: number
}): boolean {
  if (params.currentAge < params.startAge) {
    return false
  }

  return (
    params.currentAge >= params.selectedStartAge &&
    params.currentAge <= params.selectedStartAge + 9
  )
}