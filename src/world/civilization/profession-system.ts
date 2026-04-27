/**
 * 当前文件负责：定义世界文明职业类型与系统 NPC 补位规则。
 */

export type WorldProfessionType =
  | "doctor"
  | "architect"
  | "merchant"
  | "gardener"
  | "caretaker"

export type ProfessionNeed = {
  type: WorldProfessionType
  urgency: number
  reason: string
}

export function resolveProfessionNeeds(input: {
  hasHospital: boolean
  hasShop: boolean
  hasPark: boolean
  homeLevel: number
  petCount: number
}): ProfessionNeed[] {
  const needs: ProfessionNeed[] = []

  if (!input.hasHospital && input.petCount >= 1) {
    needs.push({
      type: "doctor",
      urgency: 60,
      reason: "世界中已有宠物，但医疗设施尚未形成。",
    })
  }

  if (input.homeLevel <= 1) {
    needs.push({
      type: "architect",
      urgency: 72,
      reason: "家园仍处于早期，需要建筑师补足建设能力。",
    })
  }

  if (!input.hasShop) {
    needs.push({
      type: "merchant",
      urgency: 38,
      reason: "世界资源流通尚未建立。",
    })
  }

  if (!input.hasPark && input.petCount >= 2) {
    needs.push({
      type: "gardener",
      urgency: 45,
      reason: "多宠物世界需要公共活动与自然区域。",
    })
  }

  return needs
}