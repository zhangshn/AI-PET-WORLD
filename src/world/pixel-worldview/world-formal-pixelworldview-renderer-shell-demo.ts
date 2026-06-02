// 该文件用于创建正式 PixelWorldView 渲染器只读外壳的最小测试结果。

import { createMinimalWorldFormalPixelWorldRendererContract } from "./world-formal-pixelworldview-renderer-contract-demo";
import { buildWorldFormalPixelWorldRendererShellState } from "./world-formal-pixelworldview-renderer-shell";

export function createMinimalWorldFormalPixelWorldRendererShellState() {
  const contract = createMinimalWorldFormalPixelWorldRendererContract();

  return buildWorldFormalPixelWorldRendererShellState({ contract });
}
