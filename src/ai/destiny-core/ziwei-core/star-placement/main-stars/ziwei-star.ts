import type { ElementBase } from "../../contracts"

import { mod12 } from "../../shared"

export function calculateZiweiIndex(
  lunarDay: number,
  elementBase: ElementBase
): number {
  const remainder = lunarDay % elementBase

  if (remainder === 0) {
    const quotient = lunarDay / elementBase
    return mod12(quotient - 1)
  }

  let add = 1
  while ((lunarDay + add) % elementBase !== 0) {
    add += 1
  }

  const quotient = (lunarDay + add) / elementBase

  if (add % 2 === 0) {
    return mod12(quotient - 1 + add)
  }

  return mod12(quotient - 1 - add)
}
