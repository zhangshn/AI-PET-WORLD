import type { ZiweiStarDefinition } from "../contracts"

export const LIFECYCLE_STAR_IDS = {
  changsheng: "ziwei.lifecycle.changsheng",
  muyu: "ziwei.lifecycle.muyu",
  guandai: "ziwei.lifecycle.guandai",
  linguan: "ziwei.lifecycle.linguan",
  diwang: "ziwei.lifecycle.diwang",
  shuai: "ziwei.lifecycle.shuai",
  bing: "ziwei.lifecycle.bing",
  si: "ziwei.lifecycle.si",
  mu: "ziwei.lifecycle.mu",
  jue: "ziwei.lifecycle.jue",
  tai: "ziwei.lifecycle.tai",
  yang: "ziwei.lifecycle.yang"
} as const

export const lifecycleStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: LIFECYCLE_STAR_IDS.changsheng,
    label: "长生",
    category: "lifecycle",
    enabled: true,
    displayOrder: 710
  },
  {
    starId: LIFECYCLE_STAR_IDS.muyu,
    label: "沐浴",
    category: "lifecycle",
    enabled: true,
    displayOrder: 720
  },
  {
    starId: LIFECYCLE_STAR_IDS.guandai,
    label: "冠带",
    category: "lifecycle",
    enabled: true,
    displayOrder: 730
  },
  {
    starId: LIFECYCLE_STAR_IDS.linguan,
    label: "临官",
    category: "lifecycle",
    enabled: true,
    displayOrder: 740
  },
  {
    starId: LIFECYCLE_STAR_IDS.diwang,
    label: "帝旺",
    category: "lifecycle",
    enabled: true,
    displayOrder: 750
  },
  {
    starId: LIFECYCLE_STAR_IDS.shuai,
    label: "衰",
    category: "lifecycle",
    enabled: true,
    displayOrder: 760
  },
  {
    starId: LIFECYCLE_STAR_IDS.bing,
    label: "病",
    category: "lifecycle",
    enabled: true,
    displayOrder: 770
  },
  {
    starId: LIFECYCLE_STAR_IDS.si,
    label: "死",
    category: "lifecycle",
    enabled: true,
    displayOrder: 780
  },
  {
    starId: LIFECYCLE_STAR_IDS.mu,
    label: "墓",
    category: "lifecycle",
    enabled: true,
    displayOrder: 790
  },
  {
    starId: LIFECYCLE_STAR_IDS.jue,
    label: "绝",
    category: "lifecycle",
    enabled: true,
    displayOrder: 800
  },
  {
    starId: LIFECYCLE_STAR_IDS.tai,
    label: "胎",
    category: "lifecycle",
    enabled: true,
    displayOrder: 810
  },
  {
    starId: LIFECYCLE_STAR_IDS.yang,
    label: "养",
    category: "lifecycle",
    enabled: true,
    displayOrder: 820
  }
]
