// 该文件用于创建正式 PixelWorldView 渲染器适配器的最小测试结果。

import { createMinimalPixelWorldPixelBufferResult } from "./pixel-worldview-buffer-demo";
import { buildWorldFormalPixelWorldRendererAdapterPacket } from "./world-formal-pixelworldview-renderer-adapter";
import { buildWorldFormalPixelWorldRendererContract } from "./world-formal-pixelworldview-renderer-contract";
import { buildWorldFormalPixelWorldRendererShellState } from "./world-formal-pixelworldview-renderer-shell";

export function createMinimalWorldFormalPixelWorldRendererAdapterPacket() {
  const bufferResult = createMinimalPixelWorldPixelBufferResult();
  const contract = buildWorldFormalPixelWorldRendererContract({
    buffer: bufferResult.buffer,
  });
  const shell = buildWorldFormalPixelWorldRendererShellState({ contract });

  return buildWorldFormalPixelWorldRendererAdapterPacket({
    buffer: bufferResult.buffer,
    contract,
    shell,
  });
}
