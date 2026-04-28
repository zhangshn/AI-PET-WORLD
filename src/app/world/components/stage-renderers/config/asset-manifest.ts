/**
 * 当前文件负责：定义世界舞台未来接入像素素材时使用的资源清单。
 */

import type { WorldMapTileType } from "@/world/map/world-map"

export type StageAssetCategory =
  | "tile"
  | "object"
  | "actor"
  | "effect"
  | "ui"

export type StageAssetDefinition = {
  id: string
  category: StageAssetCategory
  src: string
  pixelScale: number
  notes?: string
}

export type StageTileAssetManifest = Record<WorldMapTileType, string[]>

export type StageActorAssetManifest = {
  pet: {
    idle: string
    walk: string
    sleep: string
    eat: string
  }
  butler: {
    idle: string
    walk: string
    work: string
  }
  incubator: {
    stable: string
    unstable: string
  }
}

export type StageObjectAssetManifest = {
  tree: string[]
  flower: string[]
  water: string[]
  butterfly: string[]
  home: string[]
  shelter: string[]
  garden: string[]
}

export type StageEffectAssetManifest = {
  sparkle: string
  breeze: string
  leaf: string
  warmLight: string
  coldLight: string
}

export type StageAssetManifest = {
  basePath: string
  assets: StageAssetDefinition[]
  tiles: StageTileAssetManifest
  actors: StageActorAssetManifest
  objects: StageObjectAssetManifest
  effects: StageEffectAssetManifest
}

export const STAGE_ASSET_MANIFEST: StageAssetManifest = {
  basePath: "/assets/world",

  assets: [
    {
      id: "tile.grass.short.01",
      category: "tile",
      src: "/assets/world/tiles/grass_short_01.png",
      pixelScale: 1,
      notes: "未来短草地基础瓦片。",
    },
    {
      id: "tile.water.center.01",
      category: "tile",
      src: "/assets/world/tiles/water_center_01.png",
      pixelScale: 1,
      notes: "未来水面中心瓦片。",
    },
    {
      id: "tile.path.town.01",
      category: "tile",
      src: "/assets/world/tiles/path_town_01.png",
      pixelScale: 1,
      notes: "未来通往小镇的道路瓦片。",
    },
    {
      id: "actor.pet.idle.01",
      category: "actor",
      src: "/assets/world/actors/pet_idle_01.png",
      pixelScale: 1,
      notes: "未来宠物 idle sprite。",
    },
  ],

  tiles: {
    wild_grass: ["tile.grass.wild.01"],
    short_grass: ["tile.grass.short.01"],
    flower_patch: ["tile.flower.patch.01"],
    forest_edge: ["tile.forest.edge.01"],
    path: ["tile.path.center.01"],
    town_path: ["tile.path.town.01"],
    soil: ["tile.soil.center.01"],
    garden_soil: ["tile.garden.soil.01"],
    shelter_foundation: ["tile.foundation.shelter.01"],
    mud: ["tile.mud.center.01"],
    stone: ["tile.stone.center.01"],
    water: ["tile.water.center.01"],
  },

  actors: {
    pet: {
      idle: "actor.pet.idle.01",
      walk: "actor.pet.walk.01",
      sleep: "actor.pet.sleep.01",
      eat: "actor.pet.eat.01",
    },
    butler: {
      idle: "actor.butler.idle.01",
      walk: "actor.butler.walk.01",
      work: "actor.butler.work.01",
    },
    incubator: {
      stable: "actor.incubator.stable.01",
      unstable: "actor.incubator.unstable.01",
    },
  },

  objects: {
    tree: ["object.tree.01", "object.tree.02"],
    flower: ["object.flower.01", "object.flower.02"],
    water: ["object.water.01"],
    butterfly: ["object.butterfly.01", "object.butterfly.02"],
    home: ["object.home.under_construction.01"],
    shelter: ["object.shelter.temp.01"],
    garden: ["object.garden.01"],
  },

  effects: {
    sparkle: "effect.sparkle.01",
    breeze: "effect.breeze.01",
    leaf: "effect.leaf.01",
    warmLight: "effect.warm_light.01",
    coldLight: "effect.cold_light.01",
  },
}

export function getStageAssetDefinition(
  assetId: string
): StageAssetDefinition | null {
  return (
    STAGE_ASSET_MANIFEST.assets.find((asset) => asset.id === assetId) ?? null
  )
}