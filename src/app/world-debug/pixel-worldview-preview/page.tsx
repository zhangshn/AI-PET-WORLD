// 该页面用于预览 PixelWorldView 的只读调试模型。

import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  createMinimalPixelWorldViewModel,
  validatePixelWorldPixelBufferFrame,
  validatePixelWorldRenderPlan,
  validatePixelWorldViewModel,
} from "@/world/pixel-worldview";

export const metadata = {
  title: "PixelWorldView Debug Preview",
};

export default function PixelWorldViewDebugPreviewPage() {
  const model = createMinimalPixelWorldViewModel();
  const modelValidation = validatePixelWorldViewModel(model);
  const renderPlan = buildPixelWorldRenderPlan(model);
  const renderValidation = validatePixelWorldRenderPlan(renderPlan);
  const rendererResult = buildPixelWorldRendererFrame({ plan: renderPlan });
  const bufferResult = buildPixelWorldPixelBufferFrame({
    plan: renderPlan,
    frame: rendererResult.frame,
  });
  const buffer = bufferResult.buffer;
  const bufferValidation = validatePixelWorldPixelBufferFrame(buffer);

  return (
    <main style={styles.page}>
      <header>
        <h1>PixelWorldView Debug Preview</h1>
        <p>只读 Debug 预览，不读取 runtime，不接正式 /world，不执行渲染。</p>
      </header>

      <section style={styles.card}>
        <h2>Model Summary</h2>
        <p>worldId: {model.worldId}</p>
        <p>tick: {model.tick}</p>
        <p>
          canvas: {model.canvas.width} x {model.canvas.height}, tileSize {model.canvas.tileSize}
        </p>
        <p>
          model validation: {renderStatusBadge(modelValidation.status)}
        </p>
        <ul>
          {modelValidation.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </section>

      <section style={styles.card}>
        <h2>Layer Summaries</h2>
        <ul>
          <li>tiles: {model.tiles.length}</li>
          <li>traces: {model.traces.length}</li>
          <li>objects: {model.objects.length}</li>
          <li>actors: {model.actors.length}</li>
          <li>atmosphere: {model.atmosphere.length}</li>
          <li>overlays: {model.overlays.length}</li>
        </ul>
      </section>

      <section style={styles.card}>
        <h2>Objects</h2>
        {renderEmptyText(model.objects.length)}
        {model.objects.map((object) => (
          <p key={object.id}>
            {object.id} | {object.kind} | {object.recipeId} | sortY {object.sortY} | visible {String(object.visible)}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Actors</h2>
        {renderEmptyText(model.actors.length)}
        {model.actors.map((actor) => (
          <p key={actor.id}>
            {actor.id} | {actor.kind} | sortY {actor.sortY} | visible {String(actor.visible)} | stateTags{" "}
            {(actor.stateTags ?? []).join(", ")}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Traces</h2>
        {renderEmptyText(model.traces.length)}
        {model.traces.map((trace) => (
          <p key={trace.id}>
            {trace.id} | {trace.kind} | strength {trace.strength} | opacity {trace.opacity}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Overlays</h2>
        {renderEmptyText(model.overlays.length)}
        {model.overlays.map((overlay) => (
          <p key={overlay.id}>
            {overlay.id} | {overlay.kind} | visible {String(overlay.visible)} | text {overlay.text ?? ""}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Render Plan</h2>
        <p>worldId: {renderPlan.worldId}</p>
        <p>tick: {renderPlan.tick}</p>
        <p>commands: {renderPlan.commands.length}</p>
        <p>
          render validation: {renderStatusBadge(renderValidation.status)}
        </p>
        <ul>
          {renderValidation.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </section>

      <section style={styles.card}>
        <h2>Layer Summaries</h2>
        {renderPlan.layerSummaries.map((summary) => (
          <p key={summary.layer}>
            {summary.layer} | count {summary.count}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Render Commands</h2>
        {renderEmptyText(renderPlan.commands.length)}
        {renderPlan.commands.map((command) => (
          <p key={command.id}>
            {command.id} | {command.layer} | {command.kind} | sourceId {command.sourceId} | visible{" "}
            {String(command.visible)} | sortY {displayOptional(command.sortY)} | recipeId{" "}
            {displayOptional(command.recipeId)} | opacity {displayOptional(command.opacity)} | text{" "}
            {displayOptional(command.text)} | stateTags {displayOptional(command.stateTags?.join(", "))}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Pixel Buffer</h2>
        <p>bufferId: {buffer.bufferId}</p>
        <p>worldId: {buffer.worldId}</p>
        <p>tick: {buffer.tick}</p>
        <p>
          canvas: {buffer.canvas.width} x {buffer.canvas.height}, tileSize {buffer.canvas.tileSize}
        </p>
        <p>cellCount: {buffer.cellCount}</p>
        <p>
          buffer validation: {renderStatusBadge(bufferValidation.status)}
        </p>
        <ul>
          {bufferValidation.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </section>

      <section style={styles.card}>
        <h2>Buffer Layers</h2>
        {buffer.layers.map((layer) => (
          <p key={layer.layer}>
            {layer.layer} | cells {layer.cells.length} | visibleCount {layer.visibleCount} | hiddenCount{" "}
            {layer.hiddenCount}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Buffer Cells</h2>
        {renderEmptyText(buffer.cellCount)}
        {buffer.layers.flatMap((layer) => layer.cells).map((cell) => (
          <p key={cell.id}>
            {cell.id} | {cell.layer} | {cell.kind} | sourceCommandId {cell.sourceCommandId} | visible{" "}
            {String(cell.visible)} | opacity {cell.opacity} | x {cell.x} | y {cell.y} | width {cell.width} | height{" "}
            {cell.height} | colorHint {displayOptional(cell.colorHint)} | recipeId {displayOptional(cell.recipeId)} |
            text {displayOptional(cell.text)} | stateTags {displayOptional(cell.stateTags?.join(", "))}
          </p>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Buffer Color Preview</h2>
        <p>使用 colorHint 展示纯数据像素缓冲区的调试色块；这不是正式渲染器，不使用 canvas / SVG。</p>
        {buffer.layers.map((layer) => (
          <div key={layer.layer} style={styles.colorLayer}>
            <h3>
              {layer.layer} | cells {layer.cells.length} | visibleCount {layer.visibleCount} | hiddenCount{" "}
              {layer.hiddenCount}
            </h3>
            <div style={styles.colorGrid}>
              {layer.cells.map((cell) => (
                <div key={cell.id} style={styles.colorCell}>
                  <div
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: cell.colorHint ?? "#ff00ff",
                    }}
                  />
                  <p>
                    {cell.kind} | {cell.layer} | sourceCommandId {cell.sourceCommandId} | colorHint{" "}
                    {displayOptional(cell.colorHint)} | recipeId {displayOptional(cell.recipeId)} | text{" "}
                    {displayOptional(cell.text)} | stateTags {displayOptional(cell.stateTags?.join(", "))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={styles.card}>
        <h2>Buffer Grid Preview</h2>
        <p>按纯数据缓冲区坐标展示调试网格信息；这不是正式渲染器，不使用 canvas / SVG。</p>
        {buffer.layers.map((layer) => (
          <div key={layer.layer} style={styles.gridLayer}>
            <h3>
              {layer.layer} | cells {layer.cells.length} | visibleCount {layer.visibleCount} | hiddenCount{" "}
              {layer.hiddenCount}
            </h3>
            <div style={styles.gridCards}>
              {layer.cells.map((cell) => (
                <div key={cell.id} style={styles.gridCard}>
                  <div
                    style={{
                      ...styles.gridSwatch,
                      backgroundColor: cell.colorHint ?? "#ff00ff",
                    }}
                  />
                  <p>
                    {cell.id} | {cell.kind} | {cell.layer} | sourceCommandId {cell.sourceCommandId} | x {cell.x} | y{" "}
                    {cell.y} | width {cell.width} | height {cell.height} | visible {String(cell.visible)} | opacity{" "}
                    {cell.opacity} | colorHint {displayOptional(cell.colorHint)} | recipeId{" "}
                    {displayOptional(cell.recipeId)} | text {displayOptional(cell.text)} | stateTags{" "}
                    {displayOptional(cell.stateTags?.join(", "))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function renderStatusBadge(status: "pass" | "fail") {
  return <strong style={status === "pass" ? styles.pass : styles.fail}>{status}</strong>;
}

function renderEmptyText(itemsLength: number) {
  return itemsLength === 0 ? <p>empty</p> : null;
}

function displayOptional(value: string | number | undefined) {
  return value ?? "-";
}

const styles = {
  page: {
    padding: 24,
    fontFamily: "monospace",
    background: "#17231f",
    color: "#d8ead8",
    minHeight: "100vh",
  },
  card: {
    marginTop: 16,
    padding: 16,
    border: "1px solid #3f6861",
    background: "#1f302a",
  },
  pass: {
    color: "#7fc360",
  },
  fail: {
    color: "#d7c08a",
  },
  colorLayer: {
    marginTop: 16,
  },
  colorGrid: {
    display: "grid",
    gap: 12,
  },
  colorCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    flexShrink: 0,
    border: "1px solid #d8ead8",
  },
  gridLayer: {
    marginTop: 16,
  },
  gridCards: {
    display: "grid",
    gap: 8,
  },
  gridCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 8,
    border: "1px solid #3f6861",
  },
  gridSwatch: {
    width: 16,
    height: 16,
    flexShrink: 0,
    border: "1px solid #d8ead8",
  },
} as const;
