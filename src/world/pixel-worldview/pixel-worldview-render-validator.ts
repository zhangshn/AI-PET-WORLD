// 当前文件职责：校验正式像素主世界渲染命令计划边界。
import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { PixelWorldRenderPlan } from "./pixel-worldview-render-types";

const REQUIRED_LAYERS: PixelWorldLayerKind[] = ["tile", "trace", "object", "sprite", "atmosphere", "ui"];

export function validatePixelWorldRenderPlan(plan: PixelWorldRenderPlan): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!plan.worldId) messages.push("worldId 不能为空。");
  if (plan.canvas.width <= 0) messages.push("canvas.width 必须大于 0。");
  if (plan.canvas.height <= 0) messages.push("canvas.height 必须大于 0。");
  if (plan.canvas.tileSize <= 0) messages.push("canvas.tileSize 必须大于 0。");
  if (!Array.isArray(plan.commands)) messages.push("commands 必须是数组。");

  plan.commands.forEach((command) => {
    if (!command.id || !command.sourceId || !command.layer || !command.kind) {
      messages.push("render command 缺少必要标识。");
    }

    if (typeof command.visible !== "boolean") {
      messages.push(`render command ${command.id} 的 visible 必须是 boolean。`);
    }

    if (command.kind === "place_object_recipe" && !command.recipeId) {
      messages.push(`render command ${command.id} 缺少 recipeId。`);
    }

    if (
      (command.kind === "fill_tile" ||
        command.kind === "draw_trace_patch" ||
        command.kind === "place_object_recipe" ||
        command.kind === "draw_object_block" ||
        command.kind === "draw_actor_marker") &&
      !command.bounds
    ) {
      messages.push(`render command ${command.id} 缺少 bounds。`);
    }
  });

  REQUIRED_LAYERS.forEach((layer) => {
    if (!plan.layerSummaries.some((summary) => summary.layer === layer)) {
      messages.push(`layerSummaries 缺少 ${layer}。`);
    }
  });

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["PixelWorldView render plan 边界校验通过。"] : messages,
  };
}
