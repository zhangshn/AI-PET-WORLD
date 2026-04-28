/**
 * 当前文件负责：定义世界舞台统一视觉配置。
 */

import type { WorldMapTileType } from "@/world/map/world-map"

export type StageVisualTone = {
  base: number
  light: number
  dark: number
  edge: number
  detail: number
}

export type StageTileVisualConfig = StageVisualTone

export type StageActorVisualConfig = {
  skin: number
  skinShadow: number
  hair: number
  cloth: number
  clothLight: number
  accent: number
  outline: number
  dark: number
  shadow: number
}

export type StageIncubatorVisualConfig = {
  shell: number
  panel: number
  glass: number
  stableGlow: number
  unstableGlow: number
  dark: number
}

export type StageEffectVisualConfig = {
  breeze: number
  coldLight: number
  leaf: number
  sparkle: number
  warmLight: number
}

export type StageWorldVisualConfig = {
  tileSizeFallback: number
  shadowColor: number
  highlightColor: number
  tiles: Record<WorldMapTileType, StageTileVisualConfig>
  actor: {
    petDefault: StageActorVisualConfig
    butlerDefault: StageActorVisualConfig
    incubatorDefault: StageActorVisualConfig

    /**
     * 兼容旧 renderer 的命名。
     * 后续可以统一迁移到 petDefault / butlerDefault / incubatorDefault。
     */
    pet: StageActorVisualConfig
    butler: StageActorVisualConfig
    incubator: StageIncubatorVisualConfig
  }
  entity: {
    tree: {
      trunk: number
      trunkLight: number
      trunkDark: number
      crown: number
      crownLight: number
      crownDark: number
      highlight: number
    }
    flower: {
      stem: number
      leaf: number
      blossoms: number[]
      center: number
    }
    water: {
      base: number
      light: number
      highlight: number
    }
    butterfly: {
      body: number
      wings: number[]
      wingLights: number[]
    }
  }
  effect: StageEffectVisualConfig
}

const PET_VISUAL: StageActorVisualConfig = {
  skin: 0xf2c28b,
  skinShadow: 0xc98655,
  hair: 0x6b3f2a,
  cloth: 0xf59cb6,
  clothLight: 0xffc1d4,
  accent: 0xffffff,
  outline: 0x5b3424,
  dark: 0x3b2418,
  shadow: 0x1c1917,
}

const BUTLER_VISUAL: StageActorVisualConfig = {
  skin: 0xf0c090,
  skinShadow: 0xc68655,
  hair: 0x2d3748,
  cloth: 0x334155,
  clothLight: 0x64748b,
  accent: 0xe2e8f0,
  outline: 0x111827,
  dark: 0x0f172a,
  shadow: 0x111827,
}

const INCUBATOR_ACTOR_VISUAL: StageActorVisualConfig = {
  skin: 0xd8f3ff,
  skinShadow: 0x7ccbe3,
  hair: 0x6bc7e8,
  cloth: 0x8be9fd,
  clothLight: 0xc8f7ff,
  accent: 0xffffff,
  outline: 0x075985,
  dark: 0x083344,
  shadow: 0x083344,
}

const INCUBATOR_VISUAL: StageIncubatorVisualConfig = {
  shell: 0x7dd3fc,
  panel: 0x164e63,
  glass: 0xa5f3fc,
  stableGlow: 0x67e8f9,
  unstableGlow: 0xfb7185,
  dark: 0x083344,
}

export const STAGE_VISUAL_CONFIG: StageWorldVisualConfig = {
  tileSizeFallback: 24,
  shadowColor: 0x172016,
  highlightColor: 0xf8fafc,

  tiles: {
    wild_grass: {
      base: 0x5f8f45,
      light: 0x7fac5c,
      dark: 0x3f6f35,
      edge: 0x315a2b,
      detail: 0x9ac66f,
    },
    short_grass: {
      base: 0x79a95b,
      light: 0x9cc878,
      dark: 0x527d43,
      edge: 0x3e6234,
      detail: 0xb2d98a,
    },
    flower_patch: {
      base: 0x82ad5d,
      light: 0xa8cf7a,
      dark: 0x5f8544,
      edge: 0x466837,
      detail: 0xf3a6c8,
    },
    forest_edge: {
      base: 0x426b37,
      light: 0x5f8a4b,
      dark: 0x274526,
      edge: 0x20381f,
      detail: 0x7ca95e,
    },
    path: {
      base: 0xb99a6a,
      light: 0xd6bb86,
      dark: 0x8b6d46,
      edge: 0x725737,
      detail: 0xe0c999,
    },
    town_path: {
      base: 0xc8a873,
      light: 0xe4c88f,
      dark: 0x92714a,
      edge: 0x6f5130,
      detail: 0xf1d9a6,
    },
    soil: {
      base: 0x8b5a35,
      light: 0xa86d42,
      dark: 0x5f3a24,
      edge: 0x4b2e1c,
      detail: 0xc18a5b,
    },
    garden_soil: {
      base: 0x9b6540,
      light: 0xbf8455,
      dark: 0x6b4128,
      edge: 0x54321f,
      detail: 0xd49b6a,
    },
    shelter_foundation: {
      base: 0xa98b69,
      light: 0xc8ab84,
      dark: 0x75604a,
      edge: 0x5f4c3a,
      detail: 0xd9c1a0,
    },
    mud: {
      base: 0x6f5940,
      light: 0x8a7354,
      dark: 0x4a3a2b,
      edge: 0x3c3024,
      detail: 0x9f8561,
    },
    stone: {
      base: 0x7c838a,
      light: 0xa0a7ad,
      dark: 0x555d63,
      edge: 0x434a50,
      detail: 0xc3c8cc,
    },
    water: {
      base: 0x4f9fbd,
      light: 0x76c8de,
      dark: 0x2f718d,
      edge: 0x21556e,
      detail: 0xb4efff,
    },
  },

  actor: {
    petDefault: PET_VISUAL,
    butlerDefault: BUTLER_VISUAL,
    incubatorDefault: INCUBATOR_ACTOR_VISUAL,

    pet: PET_VISUAL,
    butler: BUTLER_VISUAL,
    incubator: INCUBATOR_VISUAL,
  },

  entity: {
    tree: {
      trunk: 0x7a4d2b,
      trunkLight: 0x9b6a3d,
      trunkDark: 0x4c2f1d,
      crown: 0x3f7f3a,
      crownLight: 0x6aa84f,
      crownDark: 0x28542b,
      highlight: 0x8ccf65,
    },
    flower: {
      stem: 0x3f7f3a,
      leaf: 0x5f9f4a,
      blossoms: [0xf4a6c6, 0xf9d16b, 0xb9a7ff, 0xff9f80],
      center: 0xfff2a0,
    },
    water: {
      base: 0x4f9fbd,
      light: 0x7fd7ec,
      highlight: 0xd8fbff,
    },
    butterfly: {
      body: 0x3f2f28,
      wings: [0xf59cb6, 0xf9d16b, 0x93c5fd],
      wingLights: [0xffd6e7, 0xffec99, 0xbfdbfe],
    },
  },

  effect: {
    breeze: 0xdbeafe,
    coldLight: 0x93c5fd,
    leaf: 0x8fbf5a,
    sparkle: 0xfef3c7,
    warmLight: 0xfacc15,
  },
}

export function getStageTileVisual(
  tileType: WorldMapTileType
): StageTileVisualConfig {
  return STAGE_VISUAL_CONFIG.tiles[tileType]
}