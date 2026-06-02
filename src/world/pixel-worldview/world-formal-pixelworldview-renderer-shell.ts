// 该文件用于定义正式 PixelWorldView 渲染器只读外壳状态。

import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { WorldFormalPixelWorldRendererContract } from "./world-formal-pixelworldview-renderer-contract";

export type WorldFormalPixelWorldRendererShellStatus = "ready" | "blocked";

export type WorldFormalPixelWorldRendererShellMode = "readonly_shell";

export type WorldFormalPixelWorldRendererShellLayerState = {
  layer: PixelWorldLayerKind;
  requiredOrder: number;
  acceptedCellKindCount: number;
  source: "WorldFormalPixelWorldRendererContract";
};

export type WorldFormalPixelWorldRendererShellSafetyState = {
  runtimeReadonly: true;
  noDefaultPet: true;
  noSvg: true;
  noCanvasDom: true;
  noCssGeometry: true;
  noDebugPanelImport: true;
};

export type WorldFormalPixelWorldRendererShellState = {
  id: string;
  status: WorldFormalPixelWorldRendererShellStatus;
  mode: WorldFormalPixelWorldRendererShellMode;
  worldId: string;
  tick: number;
  sourceContractId: string;
  sourceBufferId: string;
  sourceCellCount: number;
  layerStates: WorldFormalPixelWorldRendererShellLayerState[];
  safety: WorldFormalPixelWorldRendererShellSafetyState;
  readinessNotes: string[];
};

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SHELL_ID = "world_formal_pixelworldview_renderer_shell";

export function buildWorldFormalPixelWorldRendererShellState(input: {
  contract: WorldFormalPixelWorldRendererContract;
}): WorldFormalPixelWorldRendererShellState {
  return {
    id: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SHELL_ID,
    status: input.contract.status === "ready" ? "ready" : "blocked",
    mode: "readonly_shell",
    worldId: input.contract.worldId,
    tick: input.contract.tick,
    sourceContractId: input.contract.id,
    sourceBufferId: input.contract.sourceBufferId,
    sourceCellCount: input.contract.sourceCellCount,
    layerStates: input.contract.layerContracts.map((layerContract) => ({
      layer: layerContract.layer,
      requiredOrder: layerContract.requiredOrder,
      acceptedCellKindCount: layerContract.acceptsCellKinds.length,
      source: "WorldFormalPixelWorldRendererContract",
    })),
    safety: {
      runtimeReadonly: true,
      noDefaultPet: true,
      noSvg: true,
      noCanvasDom: true,
      noCssGeometry: true,
      noDebugPanelImport: true,
    },
    readinessNotes: [
      "正式 renderer shell 只展示 readiness，不绘制世界。",
      "真实 renderer 后续只能消费 PixelWorldPixelBufferFrame。",
      "正式 renderer shell 不读取 runtime，不生成默认宠物。",
    ],
  };
}
