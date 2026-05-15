/**
 * 当前文件负责：定义 MVP 初始家园的角色坐标层。
 */

import type { InitialHomeLayoutLayer } from "../initial-home-map-schema"

export const INITIAL_HOME_ACTOR_LAYER: InitialHomeLayoutLayer = {
  id: "initial-home-actor-layer",
  name: "初始家园角色层",
  placements: [
    {
      id: "butler-near-shelter",
      assetId: "butlerBodyStandard01",
      label: "管家",
      x: 47,
      y: 24,
      scale: 0.78,
      layer: 120,
    },
    {
      id: "pet-near-arrival-point",
      assetId: "petPoseSkeletonIdleFront01",
      label: "宠物",
      x: 22,
      y: 23,
      scale: 0.62,
      layer: 121,
    },
  ],
}
