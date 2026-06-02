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
      </header>

      <section style={styles.card}>
        <h2>World Summary</h2>
        <p>worldId: {pixelModel.worldId}</p>
        <p>tick: {pixelModel.tick}</p>
        <p>
          canvas: {pixelModel.canvas.width} x {pixelModel.canvas.height}, tileSize {pixelModel.canvas.tileSize}
        </p>
        <p>
          tiles {pixelModel.tiles.length} | traces {pixelModel.traces.length} | objects {pixelModel.objects.length} |
          actors {pixelModel.actors.length} | atmosphere {pixelModel.atmosphere.length} | overlays{" "}
          {pixelModel.overlays.length}
        </p>
        <p>render commands: {renderPlan.commands.length}</p>
        <p>buffer cells: {bufferResult.buffer.cellCount}</p>
      </section>

      <section style={styles.card}>
        <h2>Readonly Chain Validation</h2>
        <p>model: {modelValidation.status}</p>
        <p>render plan: {renderPlanValidation.status}</p>
        <p>renderer frame: {rendererValidation.status}</p>
        <p>pixel buffer: {bufferValidation.status}</p>
      </section>

      <section style={styles.card}>
        <h2>P-Phone</h2>
        <p>{input.worldViewModel.pPhone.latestMessageTitle}</p>
        <p>{input.worldViewModel.pPhone.latestMessageBody}</p>
        <p>unreadCount: {input.worldViewModel.pPhone.unreadCount}</p>
      </section>

      <section style={styles.card}>
        <h2>管家解释</h2>
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
