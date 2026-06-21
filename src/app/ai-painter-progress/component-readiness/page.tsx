import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import styles from "../detail.module.css"

type ChannelReport = { status: "ready" | "blocked"; uniqueSourceScenes: number; requiredUniqueScenes?: number; instanceCount: number; requiredInstances: number; averageComponentPixels: number; blockers: string[] }
type Report = { sourceSceneCount: number; requiredUniqueScenes: number; readyChannelCount: number; blockedChannelCount: number; canStartAutonomousTraining: boolean; channels: Record<string, ChannelReport> }

const labels: Record<string, string> = {
  grass: "草地区域", water_body: "水体内部", shoreline: "水岸过渡", road_center: "道路中心", road_edge: "道路边缘",
  tree_trunk: "树干落点", tree_crown: "树冠覆盖", rock: "岩石区域", shelter_foundation: "建筑地基", shelter_wall: "墙体立面",
  shelter_roof: "屋顶结构", construction_material: "施工材料", walkable: "可行走区域", depth: "空间深度",
}

export default async function ComponentReadinessPage() {
  const report = await readReport()
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.back} href="/ai-painter-progress">← 返回训练主页</Link>
      <p className={styles.kicker}>STAGE 07 / COMPONENT TRAINING GATE</p>
      <h1>部件实例与自主训练闸门</h1>
      <p>程序从同源 Target 与 Mask 中逐实例提取14类结构。只有独立场景和实例覆盖同时达到门槛，本地自主训练才会自动开放。</p>
      <dl className={styles.metrics}><div><dt>独立场景</dt><dd>{report?.sourceSceneCount ?? 0} / {report?.requiredUniqueScenes ?? 20}</dd></div><div><dt>结构通道</dt><dd>14 类</dd></div><div><dt>已就绪</dt><dd>{report?.readyChannelCount ?? 0} 类</dd></div><div><dt>训练状态</dt><dd>{report?.canStartAutonomousTraining ? "允许启动" : "自动阻断"}</dd></div></dl>
    </header>
    <section className={styles.resultGrid}>
      <article className={styles.resultCard}><span className={report?.canStartAutonomousTraining ? styles.pass : styles.fail}>{report?.canStartAutonomousTraining ? "允许自主训练" : "当前不可自主训练"}</span><h2>14 通道实例覆盖预览</h2><p>黄色区域是程序从真实同源 Mask 中提取的结构，不是从图片颜色猜测。</p><img src="/api/ai-painter/component-readiness/preview" alt="14通道部件实例覆盖预览" /></article>
      <article className={styles.resultCard}><h2>真实结论</h2><p className={styles.note}>当前不是缺少训练按钮，而是全部14类都未达到独立数据门槛。</p><p>树干、树冠、施工材料已有较多实例，但仍只来自12张场景。屋顶只有4个实例，水体和水岸只覆盖6张场景，直接训练会继续过拟合。</p></article>
    </section>
    <section className={styles.history}><h2>结构就绪表</h2><div className={styles.historyList}>{Object.entries(report?.channels ?? {}).map(([name, value]) => <article className={styles.historyItem} key={name}><strong>{labels[name] ?? name}</strong><span>场景 {value.uniqueSourceScenes}/{value.requiredUniqueScenes ?? report?.requiredUniqueScenes ?? 20}</span><span>实例 {value.instanceCount}/{value.requiredInstances}</span><span>{value.status === "ready" ? "可训练" : "阻断"}</span></article>)}</div></section>
    <section className={styles.panel}><h2>{report?.canStartAutonomousTraining ? "下一步" : "开放自主训练还缺什么"}</h2><p>{report?.canStartAutonomousTraining ? "数据闸门已经开放。下一步可以启动本地自主训练闭环：训练 → 推理 → Visual Judge → 不通过则继续补样或修正结构。" : "至少补到20张独立同源场景，并优先补齐屋顶、水体、水岸、建筑地基和墙体。达到闸门后，页面训练按钮才应自动进入训练闭环。"}</p></section>
  </main>
}

async function readReport(): Promise<Report | null> {
  try { return JSON.parse(await readFile(path.join(process.cwd(), ".runtime", "ai-painter", "component-instance-dataset", "report.json"), "utf8")) as Report } catch { return null }
}
