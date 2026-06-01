// 该文件用于创建正式像素主世界视图模型的安全初始结构。

import type { PixelWorldViewModel } from "./pixel-worldview-types";

export function createEmptyPixelWorldViewModel(input: {
  worldId: string;
  tick?: number;
  width?: number;
  height?: number;
  tileSize?: number;
}): PixelWorldViewModel {
  return {
    worldId: input.worldId,
    tick: input.tick ?? 0,
    canvas: {
      width: input.width ?? 640,
      height: input.height ?? 360,
      tileSize: input.tileSize ?? 16,
    },
    tiles: [],
    traces: [],
    objects: [],
    actors: [],
    atmosphere: [],
    overlays: [
      {
        id: "overlay_p_phone",
        layer: "ui",
        kind: "p_phone",
        text: "P-Phone",
        visible: true,
      },
    ],
  };
}
