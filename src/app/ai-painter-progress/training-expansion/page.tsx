import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import styles from "../detail.module.css"

type Manifest = { sampleCount: number; trainCount: number; validationCount: number; sampleIds: string[] }
type Readiness = { readyChannelCount: number; blockedChannelCount: number; canStartAutonomousTraining: boolean; channels: Record<string, { status: string; uniqueSourceScenes: number; requiredUniqueScenes: number; instanceCount: number; requiredInstances: number }> }

export default async function TrainingExpansionPage() {
  const manifest = await readJson<Manifest>(".runtime/ai-painter/multiscene-dataset/dataset-manifest.json")
  const readiness = await readJson<Readiness>(".runtime/ai-painter/component-instance-dataset/report.json")
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.back} href="/ai-painter-progress">← 返回训练主页</Link>
      <p className={styles.kicker}>STAGE 08 / SAME-SOURCE TRAINING EXPANSION</p>
      <h1>同源训练数据扩展</h1>
      <p>新增 8 张项目已有原图的结构规格，重新编译为 target、blueprint.v1.json、14 通道 Mask 和训练索引。这里仍是训练数据，不代表最终世界画面通过审核。</p>
      <dl className={styles.metrics}><div><dt>场景总数</dt><dd>{manifest?.sampleCount ?? 0}</dd></div><div><dt>训练 / 验证</dt><dd>{manifest?.trainCount ?? 0} / {manifest?.validationCount ?? 0}</dd></div><div><dt>结构就绪</dt><dd>{readiness?.readyChannelCount ?? 0} / 14</dd></div><div><dt>训练闸门</dt><dd>{readiness?.canStartAutonomousTraining ? "开放" : "阻断"}</dd></div></dl>
    </header>
    <section className={styles.resultGrid}>
      <article className={styles.resultCard}><span className={readiness?.canStartAutonomousTraining ? styles.pass : styles.fail}>{readiness?.canStartAutonomousTraining ? "14类已就绪" : "仍有阻断"}</span><h2>部件覆盖预览</h2><p>预览来自重新编译后的20张同源场景。</p><img src="/api/ai-painter/component-readiness/preview" alt="补样后的部件覆盖预览" /></article>
      <article className={styles.resultCard}><h2>本轮新增内容</h2><p className={styles.note}>从12张扩展到20张，训练集16张，验证集4张。</p><p>新增样本重点覆盖屋顶、水岸、水体、建筑地基、墙体、施工材料、道路、树木和岩石，目的是让本地模型可以进入下一轮自主训练。</p></article>
    </section>
    <section className={styles.history}><h2>新增场景列表</h2><div className={styles.historyList}>{(manifest?.sampleIds ?? []).map((id) => <article className={styles.historyItem} key={id}><strong>{id}</strong><span>{id.includes("scene-world-1-4f3fd5de") || id.includes("scene-world-2-d16f635d") ? "原批次" : "训练数据"}</span><span>target + blueprint + masks</span><span>可训练</span></article>)}</div></section>
    <section className={styles.panel}><h2>阶段结论</h2><p>阶段 08 已把自主训练从“数据不足禁止启动”推进到“数据闸门允许启动”。下一步不是再讨论能不能训，而是启动新的本地训练闭环，并让 Visual Judge 决定输出是否进入世界展示。</p></section>
  </main>
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8")) as T
  } catch {
    return null
  }
}
