/**
 * 当前文件负责：定义世界舞台统一视觉风格配置。
 */

import type { WorldMapTileType } from "@/world/map/world-map"

export type StageVisualTone =
  | "grass"
  | "wildGrass"
  | "forest"
  | "path"
  | "soil"
  | "water"
  | "wood"
  | "stone"
  | "light"
  | "shadow"
  | "accent"

export type StageTileVisualConfig = {
  base: number
  light: number
  dark: number
  edge: number
  detail: number
}

export type StageActorVisualConfig = {
  shadow: number
  outline: number
  skin: number
  skinShadow: number
  cloth: number
  clothLight: number
  dark: number
}

export type StageWorldVisualConfig = {
  tileSizeFallback: number
  shadowColor: number
  highlightColor: number
  tiles: Record<WorldMapTileType, StageTileVisualConfig>
  actor: {
    butler: StageActorVisualConfig
    petDefault: StageActorVisualConfig
    incubator: {
      shell: number
      panel: number
      glass: number
      stableGlow: number
      unstableGlow: number
      dark: number
    }
  }
  entity: {
    tree: {
      trunk: number
      trunkLight: number
      trunkDark: number
      crownDark: number
      crown: number
      crownLight: number
      highlight: number
    }
    flower: {
      stem: number
      leaf: number
      center: number
      blossoms: number[]
    }
    water: {
      base: number
      light: number
      highlight: number
      dark: number
    }
    butterfly: {
      body: number
      wings: number[]
      wingLights: number[]
    }
  }
  effect: {
    breeze: number
    warmLight: number
    coldLight: number
    leaf: number
    sparkle: number
  }
}

export const STAGE_VISUAL_CONFIG: StageWorldVisualConfig = {
  tileSizeFallback: 24,
  shadowColor: 0x000000,
  highlightColor: 0xffffff,

  tiles: {
    wild_grass: {
      base: 0x5d9a43,
      light: 0x7ccf63,
      dark: 0x315f2f,
      edge: 0x2f6b2f,
      detail: 0x3f7f39,
    },
    short_grass: {
      base: 0x78b85a,
      light: 0x9bd26f,
      dark: 0x4f9142,
      edge: 0x315f2f,
      detail: 0x5f9f45,
    },
    flower_patch: {
      base: 0x75b65a,
      light: 0xa3d977,
      dark: 0x3f7f39,
      edge: 0x315f2f,
      detail: 0xf7a8c8,
    },
    forest_edge: {
      base: 0x3f7d3a,
      light: 0x5fa34b,
      dark: 0x245f2e,
      edge: 0x1f4f25,
      detail: 0x2f6b2f,
    },
    path: {
      base: 0xc58c51,
      light: 0xf2c07b,
      dark: 0x8a5a2b,
      edge: 0x6f4527,
      detail: 0xe7b36e,
    },
    soil: {
      base: 0xa87545,
      light: 0xd09860,
      dark: 0x70421f,
      edge: 0x6b3f22,
      detail: 0x98633a,
    },
    garden_soil: {
      base: 0x98633a,
      light: 0xc1844c,
      dark: 0x6b3f22,
      edge: 0x4a2c18,
      detail: 0x70421f,
    },
    shelter_foundation: {
      base: 0xb58b5d,
      light: 0xe0b977,
      dark: 0x7a512e,
      edge: 0x5a3b22,
      detail: 0x9a6f45,
    },
    mud: {
      base: 0x76553a,
      light: 0x9b6a42,
      dark: 0x3f2a18,
      edge: 0x5a3b22,
      detail: 0x5a3b22,
    },
    stone: {
      base: 0x8f927e,
      light: 0xd0d2b8,
      dark: 0x686b5a,
      edge: 0x565948,
      detail: 0xa6a990,
    },
    water: {
      base: 0x4e9fca,
      light: 0xb7e7f7,
      dark: 0x246f99,
      edge: 0xc9f0d2,
      detail: 0x8ed3ef,
    },
  },

  actor: {
    butler: {
      shadow: 0x000000,
      outline: 0x2f2419,
      skin: 0xf0c8a0,
      skinShadow: 0x7a4a34,
      cloth: 0x6366f1,
      clothLight: 0xa5b4fc,
      dark: 0x111827,
    },
    petDefault: {
      shadow: 0x000000,
      outline: 0x111827,
      skin: 0xf8fafc,
      skinShadow: 0x7a4a24,
      cloth: 0xf59e0b,
      clothLight: 0xfef3c7,
      dark: 0x111827,
    },
    incubator: {
      shell: 0x0f172a,
      panel: 0x111827,
      glass: 0x38bdf8,
      stableGlow: 0x67e8f9,
      unstableGlow: 0xfacc15,
      dark: 0x020617,
    },
  },

  entity: {
    tree: {
      trunk: 0x6b3f24,
      trunkLight: 0x9a6336,
      trunkDark: 0x3f2416,
      crownDark: 0x245f2e,
      crown: 0x2f7d32,
      crownLight: 0x4fa84a,
      highlight: 0x86d76a,
    },
    flower: {
      stem: 0x25743a,
      leaf: 0x4fbf5a,
      center: 0xfff3a3,
      blossoms: [0xf472b6, 0xfb7185, 0xfacc15, 0xa78bfa, 0x86efac],
    },
    water: {
      base: 0x38bdf8,
      light: 0x7dd3fc,
      highlight: 0xe0f2fe,
      dark: 0x246f99,
    },
    butterfly: {
      body: 0x1f2937,
      wings: [0xfacc15, 0xf472b6, 0x60a5fa],
      wingLights: [0xfef08a, 0xfbcfe8, 0xbfdbfe],
    },
  },

  effect: {
    breeze: 0xdbeafe,
    warmLight: 0xfff7ad,
    coldLight: 0x7dd3fc,
    leaf: 0x84cc16,
    sparkle: 0xfffbeb,
  },
}

export function getStageTileVisual(
  type: WorldMapTileType
): StageTileVisualConfig {
  return STAGE_VISUAL_CONFIG.tiles[type]
}