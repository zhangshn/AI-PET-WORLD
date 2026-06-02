// 该文件用于创建像素主世界渲染器边界的最小测试结果。
import { createMinimalPixelWorldViewModel } from "./pixel-worldview-mock-snapshot";
import { buildPixelWorldRenderPlan } from "./pixel-worldview-render-planner";
import { buildPixelWorldRendererFrame } from "./pixel-worldview-renderer-boundary";

export function createMinimalPixelWorldRendererResult() {
  const model = createMinimalPixelWorldViewModel();
  const plan = buildPixelWorldRenderPlan(model);

  return buildPixelWorldRendererFrame({ plan });
}
