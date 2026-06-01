// 该文件用于校验正式像素主世界视图模型边界。

import type { PixelWorldViewModel } from "./pixel-worldview-types";

export function validatePixelWorldViewModel(model: PixelWorldViewModel): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!model.worldId) messages.push("worldId 不能为空。");
  if (model.canvas.width <= 0) messages.push("canvas.width 必须大于 0。");
  if (model.canvas.height <= 0) messages.push("canvas.height 必须大于 0。");
  if (model.canvas.tileSize <= 0) messages.push("canvas.tileSize 必须大于 0。");

  validateLayers(model.tiles, "tile", "tiles", messages);
  validateLayers(model.traces, "trace", "traces", messages);
  validateLayers(model.objects, "object", "objects", messages);
  validateLayers(model.actors, "sprite", "actors", messages);
  validateLayers(model.atmosphere, "atmosphere", "atmosphere", messages);
  validateLayers(model.overlays, "ui", "overlays", messages);

  if (model.actors.some((actor) => actor.kind === "pet" && actor.visible)) {
    messages.push("默认宠物 actor 必须保持不可见。");
  }

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["PixelWorldView 模型边界校验通过。"] : messages,
  };
}

function validateLayers<TItem extends { layer: string }>(
  items: TItem[],
  expectedLayer: string,
  collectionName: string,
  messages: string[]
): void {
  if (items.some((item) => item.layer !== expectedLayer)) {
    messages.push(`${collectionName} 包含错误 layer。`);
  }
}
