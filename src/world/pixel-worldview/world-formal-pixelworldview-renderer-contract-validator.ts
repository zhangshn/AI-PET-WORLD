// 该文件用于校验正式 PixelWorldView 渲染器契约。

import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { WorldFormalPixelWorldRendererContract } from "./world-formal-pixelworldview-renderer-contract";

export function validateWorldFormalPixelWorldRendererContract(
  contract: WorldFormalPixelWorldRendererContract
): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!contract.id) messages.push("id 不能为空。");
  if (!contract.worldId) messages.push("worldId 不能为空。");
  if (!contract.sourceBufferId) messages.push("sourceBufferId 不能为空。");
  if (contract.sourceCellCount < 0) messages.push("sourceCellCount 不能小于 0。");
  if (contract.inputKind !== "pixel_buffer_frame") messages.push("inputKind 必须是 pixel_buffer_frame。");
  if (contract.mode !== "readonly_contract" && contract.mode !== "future_pixi_adapter") {
    messages.push(`不支持 renderer contract mode: ${contract.mode}`);
  }

  requiredLayers().forEach((layer, requiredOrder) => {
    const layerContract = contract.layerContracts.find((candidate) => candidate.layer === layer);
    if (!layerContract) {
      messages.push(`layerContracts 缺少 ${layer}。`);
      return;
    }

    if (layerContract.requiredOrder !== requiredOrder) {
      messages.push(`${layer}.requiredOrder 必须是 ${requiredOrder}。`);
    }
    if (layerContract.acceptsCellKinds.length === 0) {
      messages.push(`${layer}.acceptsCellKinds 不能为空。`);
    }
  });

  validateSafety(contract, messages);

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["正式 PixelWorldView renderer contract 校验通过。"] : messages,
  };
}

function requiredLayers(): PixelWorldLayerKind[] {
  return ["tile", "trace", "object", "sprite", "atmosphere", "ui"];
}

function validateSafety(contract: WorldFormalPixelWorldRendererContract, messages: string[]): void {
  if (contract.safety.allowSvg !== false) messages.push("safety.allowSvg 必须是 false。");
  if (contract.safety.allowCanvasDom !== false) messages.push("safety.allowCanvasDom 必须是 false。");
  if (contract.safety.allowCssGeometry !== false) messages.push("safety.allowCssGeometry 必须是 false。");
  if (contract.safety.allowRuntimeWrite !== false) messages.push("safety.allowRuntimeWrite 必须是 false。");
  if (contract.safety.allowDefaultPet !== false) messages.push("safety.allowDefaultPet 必须是 false。");
  if (contract.safety.allowDebugPanelImport !== false) messages.push("safety.allowDebugPanelImport 必须是 false。");
}
