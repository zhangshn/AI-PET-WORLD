// 该页面用于预览 PixelWorldView 的只读调试模型。

import {
  buildPixelWorldRenderPlan,
  createMinimalPixelWorldViewModel,
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
} as const;
