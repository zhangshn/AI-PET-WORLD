import { mod12 } from "../../shared"

export function calculateTianfuIndex(ziweiIndex: number): number {
  return mod12(12 - ziweiIndex)
}
