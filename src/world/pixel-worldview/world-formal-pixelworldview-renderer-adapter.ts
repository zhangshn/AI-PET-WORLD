// 该文件用于定义正式 PixelWorldView 渲染器适配器数据包。

import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type {
  PixelWorldBufferCell,
  PixelWorldBufferCellKind,
  PixelWorldPixelBufferFrame,
} from "./pixel-worldview-buffer-types";
import type { WorldFormalPixelWorldRendererContract } from "./world-formal-pixelworldview-renderer-contract";
import type { WorldFormalPixelWorldRendererShellState } from "./world-formal-pixelworldview-renderer-shell";

export type WorldFormalPixelWorldRendererAdapterStatus = "ready" | "blocked";

export type WorldFormalPixelWorldRendererAdapterMode = "readonly_adapter" | "future_pixi_adapter";

export type WorldFormalPixelWorldRendererAdapterCell = {
  id: string;
  layer: PixelWorldLayerKind;
  kind: PixelWorldBufferCellKind;
  sourceCellId: string;
  sourceCommandId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  colorHint?: string;
  recipeId?: string;
  text?: string;
  stateTags?: string[];
};

export type WorldFormalPixelWorldRendererAdapterLayer = {
  layer: PixelWorldLayerKind;
  requiredOrder: number;
  cells: WorldFormalPixelWorldRendererAdapterCell[];
  visibleCount: number;
  hiddenCount: number;
};

export type WorldFormalPixelWorldRendererAdapterSafety = {
  runtimeReadonly: true;
  noDefaultPet: true;
  noSvg: true;
  noCanvasDom: true;
  noCssGeometry: true;
  noDebugPanelImport: true;
  bufferOnlyInput: true;
};

export type WorldFormalPixelWorldRendererAdapterPacket = {
  id: string;
  status: WorldFormalPixelWorldRendererAdapterStatus;
  mode: WorldFormalPixelWorldRendererAdapterMode;
  worldId: string;
  tick: number;
  sourceBufferId: string;
  sourceContractId: string;
  sourceShellId: string;
  sourceCellCount: number;
  layers: WorldFormalPixelWorldRendererAdapterLayer[];
  safety: WorldFormalPixelWorldRendererAdapterSafety;
  adapterNotes: string[];
};

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_ADAPTER_ID = "world_formal_pixelworldview_renderer_adapter";

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_ADAPTER_LAYER_ORDER: PixelWorldLayerKind[] = [
  "tile",
  "trace",
  "object",
  "sprite",
  "atmosphere",
  "ui",
];

export function buildWorldFormalPixelWorldRendererAdapterPacket(input: {
  buffer: PixelWorldPixelBufferFrame;
  contract: WorldFormalPixelWorldRendererContract;
  shell: WorldFormalPixelWorldRendererShellState;
  mode?: WorldFormalPixelWorldRendererAdapterMode;
}): WorldFormalPixelWorldRendererAdapterPacket {
  return {
    id: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_ADAPTER_ID,
    status: input.contract.status === "ready" && input.shell.status === "ready" ? "ready" : "blocked",
    mode: input.mode ?? "readonly_adapter",
    worldId: input.buffer.worldId,
    tick: input.buffer.tick,
    sourceBufferId: input.buffer.bufferId,
    sourceContractId: input.contract.id,
    sourceShellId: input.shell.id,
    sourceCellCount: input.buffer.cellCount,
    layers: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_ADAPTER_LAYER_ORDER.map((layer, requiredOrder) => {
      const cells = (input.buffer.layers.find((bufferLayer) => bufferLayer.layer === layer)?.cells ?? []).map(
        mapBufferCell
      );

      return {
        layer,
        requiredOrder,
        cells,
        visibleCount: cells.filter((cell) => cell.visible).length,
        hiddenCount: cells.filter((cell) => !cell.visible).length,
      };
    }),
    safety: {
      runtimeReadonly: true,
      noDefaultPet: true,
      noSvg: true,
      noCanvasDom: true,
      noCssGeometry: true,
      noDebugPanelImport: true,
      bufferOnlyInput: true,
    },
    adapterNotes: [
      "正式 renderer adapter 只转换 PixelWorldPixelBufferFrame。",
      "本阶段不绘制世界，只生成未来 renderer 可消费的数据包。",
      "adapter 不读取 runtime，不生成默认宠物。",
    ],
  };
}

function mapBufferCell(cell: PixelWorldBufferCell): WorldFormalPixelWorldRendererAdapterCell {
  return {
    id: `adapter_cell_${cell.id}`,
    layer: cell.layer,
    kind: cell.kind,
    sourceCellId: cell.id,
    sourceCommandId: cell.sourceCommandId,
    x: cell.x,
    y: cell.y,
    width: cell.width,
    height: cell.height,
    visible: cell.visible,
    opacity: cell.opacity,
    colorHint: cell.colorHint,
    recipeId: cell.recipeId,
    text: cell.text,
    stateTags: cell.stateTags,
  };
}
