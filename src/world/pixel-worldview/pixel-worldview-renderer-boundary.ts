import type { PixelWorldLayerKind } from "./pixel-worldview-types";
import type { PixelWorldRenderCommand } from "./pixel-worldview-render-types";
import type {
  PixelWorldRendererFrameLayer,
  PixelWorldRendererInput,
  PixelWorldRendererResult,
  PixelWorldRendererSafety,
} from "./pixel-worldview-renderer-types";

const LAYER_ORDER: PixelWorldLayerKind[] = ["tile", "trace", "object", "sprite", "atmosphere", "ui"];

export function buildPixelWorldRendererFrame(input: PixelWorldRendererInput): PixelWorldRendererResult {
  const mode = input.mode ?? "headless_plan";
  const target = input.target ?? "debug_headless";

  return {
    frame: {
      frameId: `pixel_world_renderer_frame_${input.plan.worldId}_${input.plan.tick}`,
      worldId: input.plan.worldId,
      tick: input.plan.tick,
      mode,
      target,
      canvas: input.plan.canvas,
      sourcePlanCommandCount: input.plan.commands.length,
      layers: buildRendererLayers(input.plan.commands),
      safety: createRendererSafety(),
    },
    sourcePlan: input.plan,
  };
}

function createRendererSafety(): PixelWorldRendererSafety {
  return {
    allowSvg: false,
    allowCanvasDom: false,
    allowCssGeometry: false,
    allowRuntimeWrite: false,
    allowDefaultPet: false,
  };
}

function buildRendererLayers(commands: PixelWorldRenderCommand[]): PixelWorldRendererFrameLayer[] {
  return LAYER_ORDER.map((layer) => {
    const layerCommands = commands.filter((command) => command.layer === layer);

    return {
      layer,
      commandIds: layerCommands.map((command) => command.id),
      visibleCount: layerCommands.filter((command) => command.visible).length,
      hiddenCount: layerCommands.filter((command) => !command.visible).length,
    };
  });
}
