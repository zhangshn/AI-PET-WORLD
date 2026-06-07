export default function WorldVisualControlPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>World Visual Control</h1>
      <p>视觉链路开发控制台占位页。正式玩家画面仍然只读取 /world 的 ApprovedFrame。</p>
      <ul>
        <li><a href="/api/world/visual/status">Status</a></li>
        <li><a href="/api/world/visual/provider">Provider</a></li>
        <li><a href="/api/world/visual/approved">ApprovedFrame</a></li>
        <li><a href="/world">Open