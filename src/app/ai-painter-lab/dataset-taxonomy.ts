export const DATASET_LAYERS = [
  { id: "scene", zh: "完整场景", size: "256×192", primary: true },
  { id: "object", zh: "完整对象", size: "128×128", primary: false },
  { id: "part", zh: "结构部件", size: "64×64", primary: false },
  { id: "material", zh: "材质纹理", size: "64×64", primary: false },
] as const

export const DATASET_DOMAINS = [
  { id: "world", zh: "世界场景" },
  { id: "building", zh: "建筑" },
  { id: "character", zh: "人物" },
  { id: "animal", zh: "动物" },
  { id: "vegetation", zh: "植被" },
  { id: "terrain", zh: "地形" },
  { id: "road", zh: "道路" },
  { id: "water", zh: "水体" },
  { id: "material", zh: "材料" },
  { id: "prop", zh: "道具" },
] as const

export type DatasetLayer = (typeof DATASET_LAYERS)[number]["id"]
export type DatasetDomain = (typeof DATASET_DOMAINS)[number]["id"]
