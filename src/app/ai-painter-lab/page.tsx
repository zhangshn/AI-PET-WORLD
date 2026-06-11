import type { Metadata } from "next"
import { BlueprintPreview, ConditionPreview } from "./condition-preview"
import { BLUEPRINT_JSON, CONDITION_CHANNELS, buildAiPainterLabStages } from "./ai-painter-lab-data"
import { readAiPainterDatasetStatus } from "./ai-painter-lab-status"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "AI Painter 数据实验室 | AI-PET-WORLD",
  description: "查看 Blueprint、Condition Mask 和本地训练数据准备状态。",
}

export default async function AiPainterLabPage() {
  const dataset = await readAiPainterDatasetStatus()
  const stages = buildAiPainterLabStages(dataset.accepted)
  const progress = Math.min(100, dataset.accepted)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AI-PET-WORLD / INTERNAL LAB</p>
          <h1>AI Painter 数据实验室</h1>
          <p className={styles.lead}>查看当前已经完成的数据协议、结构条件图和训练准备状态。</p>
        </div>
        <div className={styles.status}><span />模块 D 进行中</div>
      </header>

      <section className={styles.notice}>
        <strong>这不是最终世界画面。</strong>
        <span>这里展示的是模型训练前的 Blueprint 与 Condition Mask 调试结果；模型生成、VJ 审核通过前，不能作为玩家画面展示。</span>
      </section>

      <section className={styles.heroGrid}>
        <article className={styles.previewPanel}>
          <div className={styles.panelTitle}><div><small>STRUCTURE PREVIEW</small><h2>Blueprint v0</h2></div><b>256 × 192</b></div>
          <div className={styles.blueprint}><BlueprintPreview /></div>
          <div className={styles.legend}><span>草地</span><span>水岸</span><span>道路</span><span>树木</span><span>石块</span><span>临时住所</span></div>
        </article>

        <aside className={styles.detailPanel}>
          <div className={styles.panelTitle}><div><small>REAL STATUS</small><h2>训练准备</h2></div></div>
          <div className={styles.progressNumber}><strong>{dataset.accepted}</strong><span>/ 100</span></div>
          <div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div>
          <p>数据结构和导入工具已完成，数量直接读取本地数据集，不使用页面假数据。</p>
          <dl>
            <div><dt>工程验证目标</dt><dd>20-50 张</dd></div>
            <div><dt>最低训练目标</dt><dd>100 张</dd></div>
            <div><dt>Condition 通道</dt><dd>8 个</dd></div>
            <div><dt>在线绘图 API</dt><dd>禁止接入</dd></div>
            <div><dt>导入失败记录</dt><dd>{dataset.rejected} 条</dd></div>
          </dl>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><small>MODEL INPUT</small><h2>8 通道条件图</h2></div><p>白色或彩色区域代表该通道需要模型关注的空间结构。</p></div>
        <div className={styles.maskGrid}>
          {CONDITION_CHANNELS.map((channel, index) => (
            <article className={styles.maskCard} key={channel.id}>
              <div className={styles.maskPreview}><ConditionPreview channel={channel.id} color={channel.color} /></div>
              <div><b>{String(index + 1).padStart(2, "0")}</b><h3>{channel.zh}</h3><code>{channel.id}_mask</code></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.section}>
          <div className={styles.sectionHeading}><div><small>PIPELINE</small><h2>当前完成细节</h2></div></div>
          <div className={styles.stageList}>{stages.map((stage) => <div key={stage.name}><span className={stage.status === "完成" ? styles.done : styles.waiting}>{stage.status}</span><section><h3>{stage.name}</h3><p>{stage.detail}</p></section></div>)}</div>
        </article>
        <article className={styles.section}>
          <div className={styles.sectionHeading}><div><small>EXAMPLE CONTRACT</small><h2>结构数据示例</h2></div></div>
          <pre className={styles.code}>{BLUEPRINT_JSON}</pre>
          <p className={styles.footnote}>每个真实样本还必须包含目标 PNG、来源许可、三项人工审核、文件哈希及 8 张条件图。</p>
        </article>
      </section>
    </main>
  )
}
