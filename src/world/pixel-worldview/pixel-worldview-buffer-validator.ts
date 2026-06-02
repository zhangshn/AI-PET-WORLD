// 该文件用于校验正式像素主世界纯数据像素缓冲区边界。
import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { PixelWorldPixelBufferFrame } from "./pixel-worldview-buffer-types";

const REQUIRED_LAYERS: PixelWorldLayerKind[] = ["tile", "trace", "object", "sprite", "atmosphere", "ui"];

export function validatePixelWorldPixelBufferFrame(buffer: PixelWorldPixelBufferFrame): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!buffer.bufferId) messages.push("bufferId 不能为空。");
  if (!buffer.worldId) messages.push("worldId 不能为空。");
  if (buffer.canvas.width <= 0) messages.push("canvas.width 必须大于 0。");
  if (buffer.canvas.height <= 0) messages.push("canvas.height 必须大于 0。");
  if (buffer.canvas.tileSize <= 0) messages.push("canvas.tileSize 必须大于 0。");

  REQUIRED_LAYERS.forEach((layer) => {
    if (!buffer.layers.some((bufferLayer) => bufferLayer.layer === layer)) {
      messages.push(`layers 缺少 ${layer}。`);
    }
  });

  buffer.layers.forEach((layer) => {
    if (!Array.isArray(layer.cells)) {
      messages.push(`${layer.layer}.cells 必须是数组。`);
      return;
    }

    layer.cells.forEach((cell) => {
      if (!cell.id || !cell.sourceCommandId || !cell.layer || !cell.kind) {
        messages.push("buffer cell 缺少必要标识。");
      }
      if (cell.width <= 0) messages.push(`${cell.id}.width 必须大于 0。`);
      if (cell.height <= 0) messages.push(`${cell.id}.height 必须大于 0。`);
      if (cell.opacity < 0 || cell.opacity > 1) messages.push(`${cell.id}.opacity 必须在 0 到 1 之间。`);
      if (typeof cell.visible !== "boolean") messages.push(`${cell.id}.visible 必须是 boolean。`);
      if ((cell.kind as string) === "pet") messages.push("buffer cell 不允许使用 pet kind。");
      if (cell.colorHint !== undefined && typeof cell.colorHint !== "string") {
        messages.push(`${cell.id}.colorHint 必须是字符串。`);
      }
      if (cell.colorHint !== undefined && !cell.colorHint.startsWith("#")) {
        messages.push(`${cell.id}.colorHint 必须以 # 开头。`);
      }
    });
  });

  const actualCellCount = buffer.layers.reduce((sum, layer) => sum + layer.cells.length, 0);
  if (buffer.cellCount !== actualCellCount) messages.push("cellCount 必须等于所有 layer.cells.length 总和。");

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["PixelWorldView pixel buffer 边界校验通过。"] : messages,
  };
}
