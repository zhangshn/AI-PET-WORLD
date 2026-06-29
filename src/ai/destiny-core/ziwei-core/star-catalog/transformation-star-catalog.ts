import type { ZiweiStarDefinition } from "../contracts"

export const TRANSFORMATION_STAR_IDS = {
  hualu: "ziwei.transformation.hualu",
  huaquan: "ziwei.transformation.huaquan",
  huake: "ziwei.transformation.huake",
  huaji: "ziwei.transformation.huaji"
} as const

export const transformationStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: TRANSFORMATION_STAR_IDS.hualu,
    label: "化禄",
    category: "transformation",
    enabled: true,
    displayOrder: 410
  },
  {
    starId: TRANSFORMATION_STAR_IDS.huaquan,
    label: "化权",
    category: "transformation",
    enabled: true,
    displayOrder: 420
  },
  {
    starId: TRANSFORMATION_STAR_IDS.huake,
    label: "化科",
    category: "transformation",
    enabled: true,
    displayOrder: 430
  },
  {
    starId: TRANSFORMATION_STAR_IDS.huaji,
    label: "化忌",
    category: "transformation",
    enabled: true,
    displayOrder: 440
  }
]
