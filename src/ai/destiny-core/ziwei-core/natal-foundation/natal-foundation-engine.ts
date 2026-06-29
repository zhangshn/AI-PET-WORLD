import type { LunarBirthInfo, ZiweiNatalFoundation } from "../contracts"

import { calculateElementGate } from "./element-gate"
import { calculateLifeAndBodyPalace } from "./life-body-palace"
import {
  buildPalaceSectorMaps,
  calculatePalaceSequence
} from "./palace-sequence"
import { buildPalaceStemMap } from "./palace-stems"

export function buildZiweiNatalFoundation(
  lunarInfo: LunarBirthInfo
): ZiweiNatalFoundation {
  const { lifePalace, bodyPalace } = calculateLifeAndBodyPalace(
    lunarInfo.lunarMonth,
    lunarInfo.timeBranchNumber
  )

  const palaceSequence = calculatePalaceSequence(lifePalace)
  const { branchToSectorMap, sectorToBranchMap } =
    buildPalaceSectorMaps(palaceSequence)
  const palaceStemMap = buildPalaceStemMap(lunarInfo.yearStem)
  const { elementGate, elementBase } = calculateElementGate(
    lunarInfo.yearStem,
    lifePalace
  )

  return {
    lunarInfo,
    lifePalace,
    bodyPalace,
    palaceSequence,
    branchToSectorMap,
    sectorToBranchMap,
    palaceStemMap,
    elementGate,
    elementBase
  }
}
