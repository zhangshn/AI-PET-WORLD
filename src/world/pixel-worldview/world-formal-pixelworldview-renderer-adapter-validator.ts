// 该文件用于校验正式 PixelWorldView 渲染器适配器数据包。

import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { WorldFormalPixelWorldRendererAdapterPacket } from "./world-formal-pixelworldview-renderer-adapter";

export function validateWorldFormalPixelWorldRendererAdapterPacket(
  packet: WorldFormalPixelWorldRendererAdapterPacket
): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!packet.id) messages.push("id 不能为空。");
  if (!packet.worldId) messages.push("worldId 不能为空。");
  if (!packet.sourceBufferId) messages.push("sourceBufferId 不能为空。");
  if (!packet.sourceContractId) messages.push("sourceContractId 不能为空。");
  if (!packet.sourceShellId) messages.push("sourceShellId 不能为空。");
  if (packet.sourceCellCount < 0) messages.push("sourceCellCount 不能小于 0。");
  if (packet.mode !== "readonly_adapter" && packet.mode !== "future_pixi_adapter") {
    messages.push(`不支持 renderer adapter mode: ${packet.mode}`);
  }
  if (packet.status !== "ready" && packet.status !== "blocked") {
    messages.push(`不支持 renderer adapter status: ${packet.status}`);
  }

  requiredLayers().forEach((layer, requiredOrder) => {
    const adapterLayer = packet.layers.find((candidate) => candidate.layer === layer);
    if (!adapterLayer) {
      messages.push(`layers 缺少 ${layer}。`);
      return;
    }

    if (adapterLayer.requiredOrder !== requiredOrder) {
      messages.push(`${layer}.requiredOrder 必须是 ${requiredOrder}。`);
    }
    if (!Array.isArray(adapterLayer.cells)) {
      messages.push(`${layer}.cells 必须是数组。`);
      return;
    }

    adapterLayer.cells.forEach((cell) => {
      if (!cell.id || !cell.sourceCellId || !cell.sourceCommandId || !cell.layer || !cell.kind) {
        messages.push("adapter cell 缺少必要标识。");
      }
      if (cell.width <= 0) messages.push(`${cell.id}.width 必须大于 0。`);
      if (cell.height <= 0) messages.push(`${cell.id}.height 必须大于 0。`);
      if (cell.opacity < 0 || cell.opacity > 1) messages.push(`${cell.id}.opacity 必须在 0 到 1 之间。`);
      if (typeof cell.visible !== "boolean") messages.push(`${cell.id}.visible 必须是 boolean。`);
    });
  });

  validateSafety(packet, messages);

  if (packet.adapterNotes.length === 0) messages.push("adapterNotes 不能为空。");

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["正式 PixelWorldView renderer adapter 校验通过。"] : messages,
  };
}

function requiredLayers(): PixelWorldLayerKind[] {
  return ["tile", "trace", "object", "sprite", "atmosphere", "ui"];
}

function validateSafety(packet: WorldFormalPixelWorldRendererAdapterPacket, messages: string[]): void {
  if (packet.safety.runtimeReadonly !== true) messages.push("safety.runtimeReadonly 必须是 true。");
  if (packet.safety.noDefaultPet !== true) messages.push("safety.noDefaultPet 必须是 true。");
  if (packet.safety.noSvg !== true) messages.push("safety.noSvg 必须是 true。");
  if (packet.safety.noCanvasDom !== true) messages.push("safety.noCanvasDom 必须是 true。");
  if (packet.safety.noCssGeometry !== true) messages.push("safety.noCssGeometry 必须是 true。");
  if (packet.safety.noDebugPanelImport !== true) messages.push("safety.noDebugPanelImport 必须是 true。");
  if (packet.safety.bufferOnlyInput !== true) messages.push("safety.bufferOnlyInput 必须是 true。");
}
