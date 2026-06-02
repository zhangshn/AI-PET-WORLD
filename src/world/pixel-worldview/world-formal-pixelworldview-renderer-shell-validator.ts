// 该文件用于校验正式 PixelWorldView 渲染器只读外壳状态。

import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { WorldFormalPixelWorldRendererShellState } from "./world-formal-pixelworldview-renderer-shell";

export function validateWorldFormalPixelWorldRendererShellState(
  shell: WorldFormalPixelWorldRendererShellState
): {
  status: "pass" | "fail";
  messages: string[];
} {
  const messages: string[] = [];

  if (!shell.id) messages.push("id 不能为空。");
  if (!shell.worldId) messages.push("worldId 不能为空。");
  if (!shell.sourceContractId) messages.push("sourceContractId 不能为空。");
  if (!shell.sourceBufferId) messages.push("sourceBufferId 不能为空。");
  if (shell.sourceCellCount < 0) messages.push("sourceCellCount 不能小于 0。");
  if (shell.mode !== "readonly_shell") messages.push("mode 必须是 readonly_shell。");
  if (shell.status !== "ready" && shell.status !== "blocked") {
    messages.push(`不支持 renderer shell status: ${shell.status}`);
  }

  requiredLayers().forEach((layer, requiredOrder) => {
    const layerState = shell.layerStates.find((candidate) => candidate.layer === layer);
    if (!layerState) {
      messages.push(`layerStates 缺少 ${layer}。`);
      return;
    }

    if (layerState.requiredOrder !== requiredOrder) {
      messages.push(`${layer}.requiredOrder 必须是 ${requiredOrder}。`);
    }
    if (layerState.acceptedCellKindCount <= 0) {
      messages.push(`${layer}.acceptedCellKindCount 必须大于 0。`);
    }
  });

  validateSafety(shell, messages);

  if (shell.readinessNotes.length === 0) messages.push("readinessNotes 不能为空。");

  return {
    status: messages.length === 0 ? "pass" : "fail",
    messages: messages.length === 0 ? ["正式 PixelWorldView renderer shell 校验通过。"] : messages,
  };
}

function requiredLayers(): PixelWorldLayerKind[] {
  return ["tile", "trace", "object", "sprite", "atmosphere", "ui"];
}

function validateSafety(shell: WorldFormalPixelWorldRendererShellState, messages: string[]): void {
  if (shell.safety.runtimeReadonly !== true) messages.push("safety.runtimeReadonly 必须是 true。");
  if (shell.safety.noDefaultPet !== true) messages.push("safety.noDefaultPet 必须是 true。");
  if (shell.safety.noSvg !== true) messages.push("safety.noSvg 必须是 true。");
  if (shell.safety.noCanvasDom !== true) messages.push("safety.noCanvasDom 必须是 true。");
  if (shell.safety.noCssGeometry !== true) messages.push("safety.noCssGeometry 必须是 true。");
  if (shell.safety.noDebugPanelImport !== true) messages.push("safety.noDebugPanelImport 必须是 true。");
}
