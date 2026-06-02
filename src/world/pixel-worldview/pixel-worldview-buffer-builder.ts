// 该文件用于把像素主世界渲染命令计划转换成纯数据像素缓冲区。
import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { PixelWorldRenderCommand, PixelWorldRenderPlan } from "./pixel-worldview-render-types";
import type { PixelWorldRendererFrame } from "./pixel-worldview-renderer-types";
import { resolvePixelWorldBufferColorHint } from "./pixel-worldview-buffer-palette";
import type {
  PixelWorldBufferBuildResult,
  PixelWorldBufferCell,
  PixelWorldBufferCellKind,
  PixelWorldBufferLayer,
} from "./pixel-worldview-buffer-types";

const LAYER_ORDER: PixelWorldLayerKind[] = ["tile", "trace", "object", "sprite", "atmosphere", "ui"];

export function buildPixelWorldPixelBufferFrame(input: {
  plan: PixelWorldRenderPlan;
  frame: PixelWorldRendererFrame;
}): PixelWorldBufferBuildResult {
  const cells = input.plan.commands.map((command) => mapCommandToCell(command, input.plan));

  return {
    buffer: {
      bufferId: `pixel_world_buffer_${input.plan.worldId}_${input.plan.tick}`,
      worldId: input.frame.worldId,
      tick: input.frame.tick,
      canvas: input.frame.canvas,
      layers: buildBufferLayers(cells),
      cellCount: cells.length,
    },
  };
}

function mapCommandToCell(command: PixelWorldRenderCommand, plan: PixelWorldRenderPlan): PixelWorldBufferCell {
  const kind = resolveBufferCellKind(command);
  const bounds =
    command.bounds ??
    (kind === "overlay_marker"
      ? { x: 0, y: 0, width: 1, height: 1 }
      : { x: 0, y: 0, width: plan.canvas.width, height: plan.canvas.height });

  return {
    id: `buffer_cell_${command.id}`,
    layer: command.layer,
    kind,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    sourceCommandId: command.id,
    visible: command.visible,
    opacity: command.opacity ?? 1,
    colorHint: resolvePixelWorldBufferColorHint({
      layer: command.layer,
      kind,
      recipeId: command.recipeId,
      text: command.text,
    }),
    recipeId: command.recipeId,
    text: command.text,
    stateTags: command.stateTags,
  };
}

function resolveBufferCellKind(command: PixelWorldRenderCommand): PixelWorldBufferCellKind {
  if (command.kind === "fill_tile") return "tile";
  if (command.kind === "draw_trace_patch") return "trace";
  if (command.kind === "place_object_recipe") return "object_marker";
  if (command.kind === "draw_actor_marker") return "actor_marker";
  if (command.kind === "apply_atmosphere_tint") return "atmosphere";
  return "overlay_marker";
}

function buildBufferLayers(cells: PixelWorldBufferCell[]): PixelWorldBufferLayer[] {
  return LAYER_ORDER.map((layer) => {
    const layerCells = cells.filter((cell) => cell.layer === layer);

    return {
      layer,
      cells: layerCells,
      visibleCount: layerCells.filter((cell) => cell.visible).length,
      hiddenCount: layerCells.filter((cell) => !cell.visible).length,
    };
  });
}
