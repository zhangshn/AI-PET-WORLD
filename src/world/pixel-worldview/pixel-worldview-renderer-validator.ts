// 该文件用于校验正式像素主世界渲染器帧边界。
import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type {
  PixelWorldRendererFrame,
  PixelWorldRendererMode,
  PixelWorldRendererTargetKind,
} from "./pixel-worldview-renderer-types";

const REQUIRED_LAYERS: PixelWorldLayerKind[] = ["tile", "trace", "object", "sprite", "atmosphere", "ui"];
const ALLOWED_MODES: PixelWorldRendererMode[] = ["headless_plan", "pixel_buffer", "future_pixi"];
const ALLOWED_TARGETS: PixelWorldRendererTargetKind[] = ["debug_headless", "formal_world"];

export function validatePixelWorldRendererFrame(frame: PixelWorldRendererFrame): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!frame.frameId) messages.push("frameId 不能为空。");
  if (!frame.worldId) messages.push("worldId 不能为空。");
  if (frame.canvas.width <= 0) messages.push("canvas.width 必须大于 0。");
  if (frame.canvas.height <= 0) messages.push("canvas.height 必须大于 0。");
  if (frame.canvas.tileSize <= 0) messages.push("canvas.tileSize 必须大于 0。");
  if (frame.sourcePlanCommandCount < 0) messages.push("sourcePlanCommandCount 不能小于 0。");
  if (!ALLOWED_MODES.includes(frame.mode)) messages.push(`不支持 renderer mode: ${frame.mode}`);
  if (!ALLOWED_TARGETS.includes(frame.target)) messages.push(`不支持 renderer target: ${frame.target}`);

  REQUIRED_LAYERS.forEach((layer) => {
    if (!frame.layers.some((frameLayer) => frameLayer.layer === layer)) {
      messages.push(`layers 缺少 ${layer}。`);
    }
  });

  frame.layers.forEach((layer) => {
    if (!Array.isArray(layer.commandIds)) messages.push(`${layer.layer}.commandIds 必须是数组。`);
    if (layer.visibleCount < 0) messages.push(`${layer.layer}.visibleCount 不能小于 0。`);
    if (layer.hiddenCount < 0) messages.push(`${layer.layer}.hiddenCount 不能小于 0。`);
  });

  if (frame.safety.allowSvg !== false) messages.push("safety.allowSvg 必须是 false。");
  if (frame.safety.allowCanvasDom !== false) messages.push("safety.allowCanvasDom 必须是 false。");
  if (frame.safety.allowCssGeometry !== false) messages.push("safety.allowCssGeometry 必须是 false。");
  if (frame.safety.allowRuntimeWrite !== false) messages.push("safety.allowRuntimeWrite 必须是 false。");
  if (frame.safety.allowDefaultPet !== false) messages.push("safety.allowDefaultPet 必须是 false。");

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["PixelWorldView renderer frame 边界校验通过。"] : messages,
  };
}
