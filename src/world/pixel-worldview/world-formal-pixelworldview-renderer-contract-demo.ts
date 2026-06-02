// 该文件用于创建正式 PixelWorldView 渲染器契约的最小测试结果。

import { createMinimalPixelWorldPixelBufferResult } from "./pixel-worldview-buffer-demo";
import { buildWorldFormalPixelWorldRendererContract } from "./world-formal-pixelworldview-renderer-contract";

export function createMinimalWorldFormalPixelWorldRendererContract() {
  const bufferResult = createMinimalPixelWorldPixelBufferResult();

  return buildWorldFormalPixelWorldRendererContract({
    buffer: bufferResult.buffer,
  });
}
