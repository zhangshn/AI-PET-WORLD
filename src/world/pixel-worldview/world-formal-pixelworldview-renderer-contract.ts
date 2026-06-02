// 该文件用于定义正式 PixelWorldView 渲染器契约。

import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type {
  PixelWorldBufferCellKind,
  PixelWorldPixelBufferFrame,
} from "./pixel-worldview-buffer-types";

export type WorldFormalPixelWorldRendererContractStatus = "ready" | "blocked";

export type WorldFormalPixelWorldRendererContractMode = "readonly_contract" | "future_pixi_adapter";

export type WorldFormalPixelWorldRendererContractInputKind = "pixel_buffer_frame";

export type WorldFormalPixelWorldRendererContractOutputKind = "renderer_ready_state" | "future_scene_adapter";

export type WorldFormalPixelWorldRendererLayerContract = {
  layer: PixelWorldLayerKind;
  acceptsCellKinds: PixelWorldBufferCellKind[];
  requiredOrder: number;
  source: "PixelWorldPixelBufferFrame";
};

export type WorldFormalPixelWorldRendererSafetyContract = {
  allowSvg: false;
  allowCanvasDom: false;
  allowCssGeometry: false;
  allowRuntimeWrite: false;
  allowDefaultPet: false;
  allowDebugPanelImport: false;
};

export type WorldFormalPixelWorldRendererContract = {
  id: string;
  status: WorldFormalPixelWorldRendererContractStatus;
  mode: WorldFormalPixelWorldRendererContractMode;
  inputKind: WorldFormalPixelWorldRendererContractInputKind;
  outputKind: WorldFormalPixelWorldRendererContractOutputKind;
  worldId: string;
  tick: number;
  sourceBufferId: string;
  sourceCellCount: number;
  layerContracts: WorldFormalPixelWorldRendererLayerContract[];
  safety: WorldFormalPixelWorldRendererSafetyContract;
  notes: string[];
};

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_CONTRACT_ID = "world_formal_pixelworldview_renderer_contract";

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_LAYER_ORDER: PixelWorldLayerKind[] = [
  "tile",
  "trace",
  "object",
  "sprite",
  "atmosphere",
  "ui",
];

const CELL_KIND_BY_LAYER: Record<PixelWorldLayerKind, PixelWorldBufferCellKind> = {
  tile: "tile",
  trace: "trace",
  object: "object_marker",
  sprite: "actor_marker",
  atmosphere: "atmosphere",
  ui: "overlay_marker",
};

export function buildWorldFormalPixelWorldRendererContract(input: {
  buffer: PixelWorldPixelBufferFrame;
  mode?: WorldFormalPixelWorldRendererContractMode;
}): WorldFormalPixelWorldRendererContract {
  const mode = input.mode ?? "readonly_contract";

  return {
    id: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_CONTRACT_ID,
    status: "ready",
    mode,
    inputKind: "pixel_buffer_frame",
    outputKind: mode === "future_pixi_adapter" ? "future_scene_adapter" : "renderer_ready_state",
    worldId: input.buffer.worldId,
    tick: input.buffer.tick,
    sourceBufferId: input.buffer.bufferId,
    sourceCellCount: input.buffer.cellCount,
    layerContracts: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_LAYER_ORDER.map((layer, requiredOrder) => ({
      layer,
      acceptsCellKinds: [CELL_KIND_BY_LAYER[layer]],
      requiredOrder,
      source: "PixelWorldPixelBufferFrame",
    })),
    safety: {
      allowSvg: false,
      allowCanvasDom: false,
      allowCssGeometry: false,
      allowRuntimeWrite: false,
      allowDefaultPet: false,
      allowDebugPanelImport: false,
    },
    notes: [
      "正式 renderer contract 只消费 PixelWorldPixelBufferFrame。",
      "本阶段不绘制世界，只定义正式 renderer 输入输出边界。",
      "正式 renderer 不读取 runtime，不生成默认宠物。",
    ],
  };
}
