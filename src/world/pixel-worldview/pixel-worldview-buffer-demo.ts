// 该文件用于创建像素主世界纯数据像素缓冲区的最小测试结果。
import { buildPixelWorldPixelBufferFrame } from "./pixel-worldview-buffer-builder";
import { createMinimalPixelWorldRendererResult } from "./pixel-worldview-renderer-demo";

export function createMinimalPixelWorldPixelBufferResult() {
  const rendererResult = createMinimalPixelWorldRendererResult();

  return buildPixelWorldPixelBufferFrame({
    plan: rendererResult.sourcePlan,
    frame: rendererResult.frame,
  });
}
