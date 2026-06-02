// 该组件用于展示正式像素主世界只读入口。
import type { WorldViewModel } from "@/world/world-view-model";
import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  mapPixelWorldViewModelFromSnapshot,
  mapWorldViewModelToPixelWorldSourceSnapshot,
  validatePixelWorldPixelBufferFrame,
  validatePixelWorldRenderPlan,
  validatePixelWorldRendererFrame,
  validatePixelWorldViewModel,
} from "@/world/pixel-worldview";

export function PixelWorldViewReadonlyEntry(input: { worldViewModel: WorldViewModel }) {
  const source = mapWorldViewModelToPixelWorldSourceSnapshot(input.worldViewModel);
  const pixelModel = mapPixelWorldViewModelFromSnapshot(source);
  const modelValidation = validatePixelWorldViewModel(pixelModel);
  const renderPlan = buildPixelWorldRenderPlan(pixelModel);
  const renderPlanValidation = validatePixelWorldRenderPlan(renderPlan);
  const rendererResult = buildPixelWorldRendererFrame({ plan: renderPlan });
  const rendererValidation = validatePixelWorldRendererFrame(rendererResult.frame);
  const bufferResult = buildPixelWorldPixelBufferFrame({
    plan: renderPlan,
    frame: rendererResult.frame,
  });
  const bufferValidation = validatePixelWorldPixelBufferFrame(bufferResult.buffer);

  return (
    <main style={styles.page}>
      <header>
        <h1>AI-PET-WORLD</h1>
        <p>PixelWorldView 正式只读入口</p>
        <p>当前页面只读世界事实，不推进 Tick，不写入 runtime，不生成默认宠物。</p>
        <p>非正式渲染器预览，后续将接入真正 PixelWorldView renderer。</p>
      </header>

      <section style={styles.card}>
        <h2>World Runtime Projection</h2>
        <p>worldId: {input.worldViewModel.worldId}</p>
        <p>tick: {input.worldViewModel.tick}</p>
        <p>savedAt: {input.worldViewModel.savedAt}</p>
        <p>ownerId: {input.worldViewModel.ownerId}</p>
        <p>
          canvas: {input.worldViewModel.canvas.width} x {input.worldViewModel.canvas.height}, tileSize{" "}
          {input.worldViewModel.canvas.tileSize}
        </p>
        <p>WorldViewModel tags: {input.worldViewModel.tags.length}</p>
      </section>

      <section style={styles.card}>
        <h2>PixelWorldView Model</h2>
        <p>
          tiles {pixelModel.tiles.length} | traces {pixelModel.traces.length} | objects {pixelModel.objects.length} |
          actors {pixelModel.actors.length} | atmosphere {pixelModel.atmosphere.length} | overlays{" "}
          {pixelModel.overlays.length}
        </p>
        <p>model validation: {modelValidation.status}</p>
      </section>

      <section style={styles.card}>
        <h2>Render Plan</h2>
        <p>render commands: {renderPlan.commands.length}</p>
        <p>renderPlan validation: {renderPlanValidation.status}</p>
        {renderPlan.layerSummaries.map((summary) => (
          <p key={summary.layer}>
            layer {summary.layer}: {summary.count}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Renderer Frame</h2>
        <p>frameId: {rendererResult.frame.frameId}</p>
        <p>mode: {rendererResult.frame.mode}</p>
        <p>target: {rendererResult.frame.target}</p>
        <p>sourcePlanCommandCount: {rendererResult.frame.sourcePlanCommandCount}</p>
        <p>renderer validation: {rendererValidation.status}</p>
        {rendererResult.frame.layers.map((layer) => (
          <p key={layer.layer}>
            layer {layer.layer}: commands {layer.commandIds.length}, visible {layer.visibleCount}, hidden{" "}
            {layer.hiddenCount}
          </p>
        ))}
        <h3>Safety</h3>
        <p>allowSvg: {String(rendererResult.frame.safety.allowSvg)}</p>
        <p>allowCanvasDom: {String(rendererResult.frame.safety.allowCanvasDom)}</p>
        <p>allowCssGeometry: {String(rendererResult.frame.safety.allowCssGeometry)}</p>
        <p>allowRuntimeWrite: {String(rendererResult.frame.safety.allowRuntimeWrite)}</p>
        <p>allowDefaultPet: {String(rendererResult.frame.safety.allowDefaultPet)}</p>
      </section>

      <section style={styles.card}>
        <h2>Pixel Buffer</h2>
        <p>bufferId: {bufferResult.buffer.bufferId}</p>
        <p>cellCount: {bufferResult.buffer.cellCount}</p>
        <p>buffer validation: {bufferValidation.status}</p>
        {bufferResult.buffer.layers.map((layer) => (
          <p key={layer.layer}>
            layer {layer.layer}: cells {layer.cells.length}, visible {layer.visibleCount}, hidden {layer.hiddenCount}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>P-Phone</h2>
        <p>{input.worldViewModel.pPhone.latestMessageTitle}</p>
        <p>{input.worldViewModel.pPhone.latestMessageBody}</p>
        <p>unreadCount: {input.worldViewModel.pPhone.unreadCount}</p>
      </section>

      <section style={styles.card}>
        <h2>Butler Explanation</h2>
        <p>{input.worldViewModel.butlerExplanation.title}</p>
        <p>{input.worldViewModel.butlerExplanation.body}</p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "#17231f",
    color: "#d8ead8",
    fontFamily: "monospace",
  },
  card: {
    marginTop: 16,
    padding: 16,
    border: "1px solid #3f6861",
    background: "#1f302a",
  },
} as const;
